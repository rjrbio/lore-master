import { Injectable, InternalServerErrorException, BadRequestException, ServiceUnavailableException, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lore } from './lore.schema';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

@Injectable()
export class LoreService {
    private readonly openai: OpenAI;

    constructor(
        @InjectModel(Lore.name) private loreModel: Model<Lore>,
        private readonly configService: ConfigService,
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
            throw new InternalServerErrorException('OPENAI_API_KEY no está configurada');
        }
        this.openai = new OpenAI({ apiKey });
    }

    // 1. FUNCIÓN DE INGESTA: Guarda lore en la DB con su vector
    async createLore(title: string, content: string, category: string) {
        // Generamos el embedding (el vector) usando el modelo de OpenAI
        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: content,
        });

        const embedding = response.data[0].embedding;

        // Guardamos todo en MongoDB
        const newLore = new this.loreModel({ title, content, category, embedding });
        return newLore.save();
    }

    async searchLore(question: string) {
        // 1. Convertimos la PREGUNTA en un vector (igual que hicimos con el texto)
        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: question,
        });
        const questionEmbedding = response.data[0].embedding;

        // 2. Buscamos en MongoDB usando "Vector Search"
        // Nota: Esto requiere que hayas creado el índice en Atlas
        const results = await this.loreModel.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index", // El nombre que le diste al índice en Atlas
                    path: "embedding",
                    queryVector: questionEmbedding,
                    numCandidates: 10,
                    limit: 3, // Traemos los 3 párrafos más parecidos
                },
            },
            {
                $project: {
                    _id: 0,
                    content: 1,
                    title: 1,
                    score: { $meta: "vectorSearchScore" }, // Qué tan parecidos son
                },
            },
        ]);

        return results;
    }
    async findAll() {
        return await this.loreModel.find().select('-embedding').exec();
    }
    async askQuestion(question: string) {
        // 1. Buscamos el lore relevante (lo que ya teníamos)
        const contextFiles = await this.searchLore(question);

        // 2. Unimos los textos encontrados en un solo string
        const contextText = contextFiles.map(f => f.content).join('\n---\n');

        // 3. Le pedimos a la IA que responda usando ESE contexto
        const response = await this.openai.chat.completions.create({
            model: "gpt-4o", // O "gpt-3.5-turbo" si quieres ahorrar
            messages: [
                {
                    role: "system",
                    content: `Eres un erudito de Elden Ring. Responde a la pregunta del usuario usando SOLO el siguiente contexto: \n${contextText}`
                },
                { role: "user", content: question }
            ],
        });

        return {
            answer: response.choices[0].message.content,
            sources: contextFiles.map(f => f.title) // Para saber de dónde sacó la info
        };
    }
    async ingestFromUrl(url: string, category: string) {
        try {
            const cleanText = await this.fetchTextWithFallback(url);
            if (!cleanText) {
                throw new ServiceUnavailableException('r.jina.ai devolvió texto vacío.');
            }

            // Título principal.
            const titleMatch = cleanText.match(/^#\s+(.+)$/m);
            const title = titleMatch?.[1]?.trim() || 'Artículo de Elden Ring';

            // Chunking robusto:
            // 1) Divide por párrafos/tamaño
            // 2) Descarta basura muy corta o de navegación
            const rawChunks = this.splitBySize(cleanText, 1800);

            const chunks = rawChunks.filter((p) => {
                const t = p.trim();
                if (t.length < 120) return false;
                if (/^##?\s*(Additional Links|We Care About Your Privacy|Página de inicio de Fandom)/i.test(t)) return false;
                return true;
            });

            if (chunks.length === 0) {
                throw new BadRequestException(
                    'No se encontraron fragmentos útiles para ingerir (contenido vacío o bloqueado por consentimiento/plantilla).',
                );
            }

            let saved = 0;
            const failed: Array<{ index: number; reason: string }> = [];

            for (const [index, chunk] of chunks.entries()) {
                try {
                    await this.createLore(`${title}(Parte ${index + 1})`, chunk, category);
                    saved++;
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Error desconocido';
                    failed.push({ index: index + 1, reason: msg });
                }
            }

            if (saved === 0) {
                throw new ServiceUnavailableException(
                    `No se pudo guardar ningún fragmento. Primer error: ${failed[0]?.reason ?? 'desconocido'}`,
                );
            }

            return {
                message: `Ingest completado: ${saved}/${chunks.length} fragmentos guardados.`,
                title,
                preview: chunks[0].slice(0, 120) + '...',
                failedChunks: failed.slice(0, 5),
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof ServiceUnavailableException
            ) {
                throw error;
            }

            const err = error as AxiosError;
            const detail =
                err.response?.status
                    ? `HTTP ${err.response.status}`
                    : (error instanceof Error ? error.message : 'Error desconocido');

            throw new InternalServerErrorException(
                `No se pudo procesar la URL: ${detail}`,
            );
        }
    }

    private buildReaderUrl(rawUrl: string) {
        let parsed: URL;
        try {
            parsed = new URL(rawUrl);
        } catch {
            throw new BadRequestException('La URL no es válida.');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new BadRequestException('La URL debe usar http o https.');
        }

        return `https://r.jina.ai/${parsed.toString()}`;
    }

    private async fetchTextWithFallback(url: string): Promise<string> {
        const readerUrl = this.buildReaderUrl(url);

        // 1) Intento principal: r.jina.ai
        const jinaRes = await axios.get<string>(readerUrl, {
            timeout: 30000,
            responseType: 'text',
            validateStatus: () => true,
        });

        if (jinaRes.status < 400) {
            const txt = String(jinaRes.data ?? '').trim();
            if (txt) return txt;
        }

        // 2) Si r.jina.ai bloquea (451) o falla, intento directo al HTML de Fandom
        if (jinaRes.status === 451 || jinaRes.status >= 500 || !String(jinaRes.data ?? '').trim()) {
            const htmlRes = await axios.get<string>(url, {
                timeout: 30000,
                responseType: 'text',
                validateStatus: () => true,
                headers: {
                    // Simula navegador básico para evitar respuestas mínimas
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                },
            });

            if (htmlRes.status >= 400) {
                throw new ServiceUnavailableException(
                    `No se pudo leer la página. r.jina.ai = ${jinaRes.status}, origen = ${htmlRes.status}`,
                );
            }

            const parsed = this.extractTextFromFandomHtml(String(htmlRes.data ?? ''));
            if (!parsed.trim()) {
                throw new ServiceUnavailableException(
                    `La página respondió pero no se pudo extraer texto útil. r.jina.ai = ${jinaRes.status}`,
                );
            }

            return parsed;
        }

        throw new ServiceUnavailableException(
            `r.jina.ai devolvió ${jinaRes.status} para la URL solicitada.`,
        );
    }

    private extractTextFromFandomHtml(html: string): string {
        const $ = cheerio.load(html);

        // Elimina ruido típico de layout
        $('script, style, noscript, nav, footer, header, aside').remove();
        $('.global-navigation, .WikiaRail, .page__right-rail, .toc, .ad-slot').remove();

        // Zona principal de contenido (Fandom)
        const title =
            $('h1.page-header__title').first().text().trim() ||
            $('h1').first().text().trim() ||
            $('title').first().text().replace(' | Elden Ring Wiki | Fandom', '').trim() ||
            'Artículo de Elden Ring';

        const articleText =
            $('.mw-parser-output').first().text() ||
            $('.page-content').first().text() ||
            $('main').first().text() ||
            $('body').text();

        const normalized = articleText
            .replace(/\r/g, '')
            .replace(/\t/g, ' ')
            .replace(/[ ]{2,}/g, ' ')
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
            .join('\n\n');

        return `# ${title}\n\n${normalized}`;
    }

    private splitBySize(text: string, maxChars = 1800): string[] {
        const paragraphs = text
            .split('\n\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);
        const chunks: string[] = [];

        for (const p of paragraphs) {
            if (p.length <= maxChars) {
                chunks.push(p);
                continue;
            }
            for (let i = 0; i < p.length; i += maxChars) {
                const slice = p.slice(i, i + maxChars).trim();
                if (slice.length > 0) chunks.push(slice);
            }
        }

        return chunks;
    }

}