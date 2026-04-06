import { BadRequestException, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';

const logger = new Logger('UrlSafety');

/**
 * Rangos de IP privados/reservados que nunca deben ser accedidos
 * desde el servidor (protección SSRF).
 */
const BLOCKED_IP_PREFIXES = [
    '127.',       // loopback
    '10.',        // clase A privada
    '0.',         // "this" network
    '169.254.',   // link-local (AWS metadata endpoint)
    '192.168.',   // clase C privada
];

const BLOCKED_IPV6 = ['::1', '::ffff:127.0.0.1', 'fe80::'];

function isBlockedIpv4(ip: string): boolean {
    if (BLOCKED_IP_PREFIXES.some((prefix) => ip.startsWith(prefix))) return true;
    // 172.16.0.0 – 172.31.255.255
    if (ip.startsWith('172.')) {
        const second = parseInt(ip.split('.')[1], 10);
        if (second >= 16 && second <= 31) return true;
    }
    return false;
}

function isBlockedIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase();
    return BLOCKED_IPV6.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Valida que una URL sea segura para hacer fetch desde el servidor.
 * - Solo permite http/https
 * - Resuelve DNS y bloquea IPs privadas/internas
 * - Si la resolución DNS falla, permite la request (dominios CDN como Fandom
 *   pueden no resolver desde ciertos entornos)
 */
export async function validateUrlSafety(rawUrl: string): Promise<void> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        throw new BadRequestException('La URL proporcionada no es válida.');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('Solo se permiten URLs con protocolo http o https.');
    }

    // Bloquear IPs literales en el hostname
    const hostname = parsed.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        if (isBlockedIpv4(hostname)) {
            throw new BadRequestException('No se permite acceder a direcciones IP privadas o reservadas.');
        }
        return; // IP pública literal → OK
    }

    // Resolver DNS y verificar que la IP resultante no sea interna.
    // Si DNS falla (timeout, NXDOMAIN transitorio), dejamos pasar con warning
    // en lugar de bloquear — muchos CDN (Fandom/Cloudflare) pueden fallar
    // en resolución desde ciertos entornos.
    try {
        const result = await lookup(hostname);
        const ip = result.address;
        const family = result.family;

        if (family === 4 && isBlockedIpv4(ip)) {
            throw new BadRequestException('La URL apunta a una dirección de red interna y no está permitida.');
        }
        if (family === 6 && isBlockedIpv6(ip)) {
            throw new BadRequestException('La URL apunta a una dirección de red interna y no está permitida.');
        }
    } catch (error) {
        if (error instanceof BadRequestException) throw error;
        // DNS falló pero no es IP privada → permitir con warning
        logger.warn(`DNS lookup falló para ${hostname}: ${error instanceof Error ? error.message : 'desconocido'} — permitiendo request`);
    }
}
