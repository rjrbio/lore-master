import {
    CanActivate,
    ExecutionContext,
    HttpException,
    Injectable,
    Logger,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const DAILY_QUOTA_KEY = 'dailyQuota';

/**
 * Decorador para marcar un endpoint con una quota diaria por IP.
 * @param limit Máximo de requests por IP al día para este endpoint/grupo.
 * @param group Nombre del grupo de quota (permite compartir quota entre endpoints).
 */
export const DailyQuota = (limit: number, group: string) =>
    SetMetadata(DAILY_QUOTA_KEY, { limit, group });

interface QuotaEntry {
    count: number;
    resetAt: number;
}

@Injectable()
export class DailyQuotaGuard implements CanActivate {
    private readonly logger = new Logger(DailyQuotaGuard.name);
    // Map<"group:ip", QuotaEntry>
    private readonly store = new Map<string, QuotaEntry>();
    private lastCleanup = Date.now();
    private readonly CLEANUP_INTERVAL = 3600000; // 1h

    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const quota = this.reflector.getAllAndOverride<{ limit: number; group: string } | undefined>(
            DAILY_QUOTA_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!quota) return true;

        const request = context.switchToHttp().getRequest<Request>();
        const ip = request.ip || request.socket.remoteAddress || 'unknown';
        const key = `${quota.group}:${ip}`;
        const now = Date.now();

        this.cleanupIfNeeded(now);

        const entry = this.store.get(key);
        if (!entry || now >= entry.resetAt) {
            // Nueva ventana de 24h
            this.store.set(key, { count: 1, resetAt: now + 86400000 });
            return true;
        }

        if (entry.count >= quota.limit) {
            this.logger.warn(`Quota diaria excedida: grupo=${quota.group}, ip=${ip}, count=${entry.count}/${quota.limit}`);
            throw new HttpException(
                {
                    statusCode: 429,
                    message: `Has superado el límite diario de ${quota.limit} peticiones para esta operación. Inténtalo mañana.`,
                    error: 'Too Many Requests',
                },
                429,
            );
        }

        entry.count++;
        return true;
    }

    private cleanupIfNeeded(now: number): void {
        if (now - this.lastCleanup < this.CLEANUP_INTERVAL) return;
        this.lastCleanup = now;

        for (const [key, entry] of this.store) {
            if (now >= entry.resetAt) {
                this.store.delete(key);
            }
        }
    }
}
