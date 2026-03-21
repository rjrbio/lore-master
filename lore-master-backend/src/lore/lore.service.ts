import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { createHash } from 'crypto';
import type { Multer } from 'multer';
import { Lore } from './lore.schema';

type SourceType = 'web' | 'fandom' | 'wikipedia' | 'file';
type ExtractionMode = 'jina' | 'api' | 'html';

interface NormalizedDocumentUrl {
    originalUrl: string;
    canonicalUrl: string;
    locale: string;
    articleTitle: string;
    sourceType: SourceType;
    readerUrl: string;
    apiUrl?: string;
}

export interface IngestChunkInfo {
    index: number;
    reason: string;
    preview?: string;
}

export interface QuerySource {
    title: string;
    sourceUrl?: string;
    sourceType?: string;
}

export interface DocumentListItem {
    title: string;
    sourceUrl?: string;
    sourceType?: string;
    locale?: string;
    tags: string[];
    chunkCount: number;
    lastUpdated?: Date;
}

export interface IngestSourceResult {
    url: string;
    title: string;
    message: string;
    preview: string;
    sourceUrl: string;
    sourceType: SourceType;
    locale: string;
    extractionMode: ExtractionMode;
    replaceExisting: boolean;
    replacedChunks: number;
    totalChunks: number;
    savedChunks: number;
    duplicateChunks: number;
    droppedChunks: number;
    tags: string[];
    duplicateDetails: IngestChunkInfo[];
    failedChunks: IngestChunkInfo[];
}

export interface IngestBatchResult {
    message: string;
    processedUrls: number;
    successfulUrls: number;
    failedUrls: number;
    results: IngestSourceResult[];
    failures: Array<{ url: string; reason: string }>;
}

interface TextExtractionResult {
    content: string;
    mode: ExtractionMode;
    locale: string;
    sourceUrl: string;
    sourceType: SourceType;
}

interface DocumentChunkMetadata {
    sourceUrl?: string;
    sourceType?: SourceType;
    locale?: string;
    extractionMode?: ExtractionMode;
    chunkHash?: string;
    tags?: string[];
}

interface IngestOptions {
    replaceExisting?: boolean;
    tags?: string[];
}

@Injectable()
export class LoreService {
    private readonly openai: OpenAI;
    private readonly defaultLocale = 'en';
    private readonly minChunkLength = 120;
    private readonly maxChunkLength = 1900;

    constructor(
        @InjectModel(Lore.name) private readonly loreModel: Model<Lore>,
        private readonly configService: ConfigService,
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
            throw new InternalServerErrorException('OPENAI_API_KEY no está configurada');
        }
        this.openai = new OpenAI({ apiKey });
    }

    async createLore(title: string, content: string, category = 'Document', metadata?: DocumentChunkMetadata) {
        const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: content,
        });

        const embedding = response.data[0].embedding;
        const newLore = new this.loreModel({
            title,
            content,
            category,
            embedding,
            ...metadata,
        });
        return newLore.save();
    }

    async searchLore(question: string) {
        const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: question,
        });
        const questionEmbedding = response.data[0].embedding;

        return this.loreModel.aggregate([
            {
                $vectorSearch: {
                    index: 'vector_index',
                    path: 'embedding',
                    queryVector: questionEmbedding,
                    numCandidates: 10,
                    limit: 3,
                },
            },
            {
                $project: {
                    _id: 0,
                    content: 1,
                    title: 1,
                    sourceUrl: 1,
                    sourceType: 1,
                    score: { $meta: 'vectorSearchScore' },
                },
            },
        ]);
    }

    async findAll() {
        return this.loreModel.find().select('-embedding').sort({ updatedAt: -1 }).exec();
    }

    async listDocuments(): Promise<DocumentListItem[]> {
        const documents = await this.loreModel.aggregate([
            {
                $project: {
                    title: 1,
                    sourceUrl: 1,
                    sourceType: 1,
                    locale: 1,
                    tags: { $ifNull: ['$tags', []] },
                    updatedAt: 1,
                },
            },
            {
                $group: {
                    _id: '$sourceUrl',
                    title: { $first: '$title' },
                    sourceUrl: { $first: '$sourceUrl' },
                    sourceType: { $first: '$sourceType' },
                    locale: { $first: '$locale' },
                    tags: { $first: '$tags' },
                    chunkCount: { $sum: 1 },
                    lastUpdated: { $max: '$updatedAt' },
                },
            },
            {
                $sort: { lastUpdated: -1, title: 1 },
            },
        ]);

        return documents.map((document) => ({
            title: document.title,
            sourceUrl: document.sourceUrl,
            sourceType: document.sourceType,
            locale: document.locale,
            tags: document.tags ?? [],
            chunkCount: document.chunkCount,
            lastUpdated: document.lastUpdated,
        }));
    }

    async askQuestion(question: string) {
        const contextFiles = await this.searchLore(question);
        if (contextFiles.length === 0) {
            return {
                answer: 'No encontré contenido relevante en la base documental para responder esa consulta.',
                sources: [] as QuerySource[],
            };
        }

        const contextText = contextFiles
            .map((file, index) => {
                const sourceLabel = file.sourceUrl ? `Fuente: ${file.sourceUrl}` : 'Fuente no disponible';
                return `[Documento ${index + 1}]\nTítulo: ${file.title}\n${sourceLabel}\nContenido:\n${file.content}`;
            })
            .join('\n\n---\n\n');

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'Eres un asistente de análisis documental. Responde usando solo el contexto proporcionado. Si el contexto no basta, dilo de forma explícita.',
                },
                {
                    role: 'user',
                    content: `Pregunta: ${question}\n\nContexto:\n${contextText}`,
                },
            ],
        });

        return {
            answer: response.choices[0].message.content,
            sources: contextFiles.map((file) => ({
                title: file.title,
                sourceUrl: file.sourceUrl,
                sourceType: file.sourceType,
            })),
        };
    }

    async ingestUrls(urls: string[], options?: IngestOptions): Promise<IngestBatchResult> {
        const sanitizedUrls = urls.map((url) => url.trim()).filter(Boolean);
        if (sanitizedUrls.length === 0) {
            throw new BadRequestException('Debes proporcionar al menos una URL válida para ingerir.');
        }

        const results: IngestSourceResult[] = [];
        const failures: Array<{ url: string; reason: string }> = [];

        for (const url of sanitizedUrls) {
            try {
                const result = await this.ingestFromUrl(url, options);
                results.push(result);
            } catch (error) {
                const reason = error instanceof Error ? error.message : 'Error desconocido';
                failures.push({ url, reason });
            }
        }

        const successfulUrls = results.length;
        const failedUrls = failures.length;
        const message =
            failedUrls === 0
                ? `Ingesta completada para ${successfulUrls} fuente(s).`
                : `Ingesta completada con incidencias: ${successfulUrls} fuente(s) correctas, ${failedUrls} fallidas.`;

        return {
            message,
            processedUrls: sanitizedUrls.length,
            successfulUrls,
            failedUrls,
            results,
            failures,
        };
    }

    async ingestFromUrl(url: string, options?: IngestOptions): Promise<IngestSourceResult> {
        try {
            const normalized = this.normalizeDocumentUrl(url);
            const extraction = await this.fetchTextWithFallback(normalized);
            const cleanText = extraction.content.trim();
            const replaceExisting = Boolean(options?.replaceExisting);
            const tags = (options?.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

            if (!cleanText) {
                throw new ServiceUnavailableException('No se pudo extraer texto útil de la URL indicada.');
            }

            const titleMatch = cleanText.match(/^#\s+(.+)$/m);
            const title = titleMatch?.[1]?.trim() || normalized.articleTitle || 'Documento sin título';
            const rawChunks = this.buildSemanticChunks(cleanText, this.maxChunkLength);

            const chunks = rawChunks.filter((chunk, index) => {
                const text = chunk.trim();
                if (text.length < this.minChunkLength) {
                    return false;
                }

                if (/^(##?\s*)?(Additional Links|We Care About Your Privacy|Cookie Notice|Fandom Apps)/i.test(text)) {
                    return false;
                }

                const lines = text.split('\n').filter(Boolean);
                const shortLineRatio = lines.length ? lines.filter((line) => line.length < 40).length / lines.length : 0;
                if (shortLineRatio > 0.8 && lines.length > 6) {
                    return false;
                }

                if (index > 0 && /^#\s+/.test(text)) {
                    return text.replace(/^#\s+.+\n?/m, '').trim().length >= this.minChunkLength;
                }

                return true;
            });

            if (chunks.length === 0) {
                throw new BadRequestException('No se encontraron fragmentos utilizables tras procesar la fuente.');
            }

            let saved = 0;
            let duplicateCount = 0;
            let replacedChunks = 0;
            const failed: IngestChunkInfo[] = [];
            const duplicateDetails: IngestChunkInfo[] = [];

            if (replaceExisting) {
                const deletionResult = await this.loreModel.deleteMany({ sourceUrl: normalized.canonicalUrl });
                replacedChunks = deletionResult.deletedCount ?? 0;
            }

            for (const [index, chunk] of chunks.entries()) {
                try {
                    const chunkHash = this.buildChunkHash(normalized.canonicalUrl, chunk);
                    const alreadyExists = !replaceExisting
                        ? await this.loreModel.exists({
                            sourceUrl: normalized.canonicalUrl,
                            chunkHash,
                        })
                        : null;

                    if (alreadyExists) {
                        duplicateCount++;
                        duplicateDetails.push({
                            index: index + 1,
                            reason: 'Fragmento duplicado detectado para la misma fuente.',
                            preview: chunk.slice(0, 80),
                        });
                        continue;
                    }

                    await this.createLore(`${title} (Parte ${index + 1})`, chunk, 'Document', {
                        sourceUrl: normalized.canonicalUrl,
                        sourceType: extraction.sourceType,
                        locale: extraction.locale,
                        extractionMode: extraction.mode,
                        chunkHash,
                        tags,
                    });
                    saved++;
                } catch (error) {
                    failed.push({
                        index: index + 1,
                        reason: error instanceof Error ? error.message : 'Error desconocido',
                        preview: chunk.slice(0, 80),
                    });
                }
            }

            if (saved === 0 && duplicateCount === 0) {
                throw new ServiceUnavailableException(
                    `No se pudo guardar ningún fragmento. Primer error: ${failed[0]?.reason ?? 'desconocido'}`,
                );
            }

            const summaryMessage =
                saved > 0
                    ? `Ingesta completada: ${saved}/${chunks.length} fragmentos guardados.`
                    : `Sin cambios: ${duplicateCount}/${chunks.length} fragmentos ya existían para esta fuente.`;
            const replaceMessage = replaceExisting
                ? ` Reemplazo activo: ${replacedChunks} fragmentos previos eliminados.`
                : '';

            return {
                url,
                title,
                message: `${summaryMessage}${replaceMessage}`,
                preview: chunks[0].slice(0, 120) + '...',
                sourceUrl: normalized.canonicalUrl,
                sourceType: extraction.sourceType,
                locale: extraction.locale,
                extractionMode: extraction.mode,
                replaceExisting,
                replacedChunks,
                totalChunks: chunks.length,
                savedChunks: saved,
                duplicateChunks: duplicateCount,
                droppedChunks: rawChunks.length - chunks.length,
                tags,
                duplicateDetails: duplicateDetails.slice(0, 5),
                failedChunks: failed.slice(0, 5),
            };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
                throw error;
            }

            const axiosError = error as AxiosError;
            const detail = axiosError.response?.status
                ? `HTTP ${axiosError.response.status}`
                : error instanceof Error
                    ? error.message
                    : 'Error desconocido';

            throw new InternalServerErrorException(`No se pudo procesar la URL: ${detail}`);
        }
    }

    async ingestFiles(files: Multer.File[], options?: IngestOptions): Promise<IngestBatchResult> {
        if (!files || files.length === 0) {
            throw new BadRequestException('Debes proporcionar al menos un archivo para ingerir.');
        }

        const results: IngestSourceResult[] = [];
        const failures: Array<{ url: string; reason: string }> = [];

        for (const file of files) {
            try {
                const result = await this.ingestFile(file, options);
                results.push(result);
            } catch (error) {
                const reason = error instanceof Error ? error.message : 'Error desconocido';
                failures.push({ url: file.originalname, reason });
            }
        }

        const successfulFiles = results.length;
        const failedFiles = failures.length;
        const message =
            failedFiles === 0
                ? `Ingesta completada para ${successfulFiles} archivo(s).`
                : `Ingesta completada con incidencias: ${successfulFiles} archivo(s) correctos, ${failedFiles} fallidos.`;

        return {
            message,
            processedUrls: files.length,
            successfulUrls: successfulFiles,
            failedUrls: failedFiles,
            results,
            failures,
        };
    }

    private async ingestFile(file: Multer.File, options?: IngestOptions): Promise<IngestSourceResult> {
        try {
            if (!file.originalname) {
                throw new BadRequestException('El archivo debe tener un nombre.');
            }

            const ext = file.originalname.split('.').pop()?.toLowerCase();
            if (!['txt', 'md', 'pdf'].includes(ext || '')) {
                throw new BadRequestException('Solo se permiten archivos TXT, MD o PDF.');
            }

            let contentText: string;
            if (ext === 'pdf') {
                const parser = new PDFParse({ data: file.buffer });
                try {
                    const data = await parser.getText();
                    contentText = data.text;
                } finally {
                    await parser.destroy();
                }
            } else {
                contentText = file.buffer.toString('utf-8');
            }

            if (!contentText.trim()) {
                throw new ServiceUnavailableException('El archivo está vacío o no contiene texto válido.');
            }

            const replaceExisting = Boolean(options?.replaceExisting);
            const tags = (options?.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

            // Usar el nombre del archivo como sourceUrl
            const sourceUrl = `file://${file.originalname}`;
            const title = file.originalname.replace(/\.[^.]+$/, '');
            const rawChunks = this.buildSemanticChunks(contentText, this.maxChunkLength);

            const chunks = rawChunks.filter((chunk) => chunk.trim().length >= this.minChunkLength);

            if (chunks.length === 0) {
                throw new BadRequestException('No se encontraron fragmentos utilizables tras procesar el archivo.');
            }

            let saved = 0;
            let duplicateCount = 0;
            let replacedChunks = 0;
            const failed: IngestChunkInfo[] = [];
            const duplicateDetails: IngestChunkInfo[] = [];

            if (replaceExisting) {
                const deletionResult = await this.loreModel.deleteMany({ sourceUrl });
                replacedChunks = deletionResult.deletedCount ?? 0;
            }

            for (const [index, chunk] of chunks.entries()) {
                try {
                    const chunkHash = this.buildChunkHash(sourceUrl, chunk);
                    const alreadyExists = !replaceExisting
                        ? await this.loreModel.exists({ sourceUrl, chunkHash })
                        : null;

                    if (alreadyExists) {
                        duplicateCount++;
                        duplicateDetails.push({
                            index: index + 1,
                            reason: 'Fragmento duplicado detectado para el mismo archivo.',
                            preview: chunk.slice(0, 80),
                        });
                        continue;
                    }

                    await this.createLore(`${title} (Parte ${index + 1})`, chunk, 'Document', {
                        sourceUrl,
                        sourceType: 'file' as SourceType,
                        locale: this.defaultLocale,
                        extractionMode: 'html' as ExtractionMode,
                        chunkHash,
                        tags,
                    });
                    saved++;
                } catch (error) {
                    failed.push({
                        index: index + 1,
                        reason: error instanceof Error ? error.message : 'Error desconocido',
                        preview: chunk.slice(0, 80),
                    });
                }
            }

            if (saved === 0 && duplicateCount === 0) {
                throw new ServiceUnavailableException(
                    `No se pudo guardar ningún fragmento. Primer error: ${failed[0]?.reason ?? 'desconocido'}`,
                );
            }

            const summaryMessage =
                saved > 0
                    ? `Ingesta completada: ${saved}/${chunks.length} fragmentos guardados.`
                    : `Sin cambios: ${duplicateCount}/${chunks.length} fragmentos ya existían para este archivo.`;
            const replaceMessage = replaceExisting ? ` Reemplazo activo: ${replacedChunks} fragmentos previos eliminados.` : '';

            return {
                url: sourceUrl,
                title,
                message: `${summaryMessage}${replaceMessage}`,
                preview: chunks[0].slice(0, 120) + '...',
                sourceUrl,
                sourceType: 'file' as SourceType,
                locale: this.defaultLocale,
                extractionMode: 'html' as ExtractionMode,
                replaceExisting,
                replacedChunks,
                totalChunks: chunks.length,
                savedChunks: saved,
                duplicateChunks: duplicateCount,
                droppedChunks: rawChunks.length - chunks.length,
                tags,
                duplicateDetails: duplicateDetails.slice(0, 5),
                failedChunks: failed.slice(0, 5),
            };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
                throw error;
            }

            throw new InternalServerErrorException(
                `No se pudo procesar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            );
        }
    }

    private normalizeDocumentUrl(rawUrl: string): NormalizedDocumentUrl {
        let parsed: URL;
        try {
            parsed = new URL(rawUrl.trim());
        } catch {
            throw new BadRequestException('La URL no es válida.');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new BadRequestException('La URL debe usar http o https.');
        }

        parsed.hash = '';
        parsed.search = '';

        const hostname = parsed.hostname.toLowerCase();
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const sourceType = this.detectSourceType(hostname);
        const locale = this.detectLocale(hostname, pathParts, sourceType);
        const canonicalUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '') || '/'}`;
        const articleTitle = this.extractArticleTitle(pathParts, hostname);

        let apiUrl: string | undefined;
        if (sourceType === 'fandom') {
            const apiPath = this.detectLocaleFromPath(pathParts) ? `/${locale}/api.php` : '/api.php';
            apiUrl = `${parsed.protocol}//${parsed.host}${apiPath}?action=parse&page=${encodeURIComponent(articleTitle)}&prop=displaytitle|text&formatversion=2&format=json`;
        }

        if (sourceType === 'wikipedia') {
            apiUrl = `${parsed.protocol}//${parsed.host}/w/api.php?action=parse&page=${encodeURIComponent(articleTitle)}&prop=displaytitle|text&formatversion=2&format=json`;
        }

        return {
            originalUrl: rawUrl,
            canonicalUrl,
            locale,
            articleTitle,
            sourceType,
            readerUrl: `https://r.jina.ai/${canonicalUrl}`,
            apiUrl,
        };
    }

    private detectSourceType(hostname: string): SourceType {
        if (hostname.includes('fandom.com')) {
            return 'fandom';
        }

        if (hostname.endsWith('.wikipedia.org')) {
            return 'wikipedia';
        }

        return 'web';
    }

    private detectLocale(hostname: string, pathParts: string[], sourceType: SourceType): string {
        if (sourceType === 'wikipedia') {
            return hostname.split('.')[0] || this.defaultLocale;
        }

        if (sourceType === 'fandom') {
            return this.detectLocaleFromPath(pathParts) ?? this.defaultLocale;
        }

        return 'und';
    }

    private detectLocaleFromPath(pathParts: string[]): string | null {
        const candidate = pathParts[0]?.toLowerCase();
        if (candidate && /^[a-z]{2}(-[a-z]{2})?$/.test(candidate) && candidate !== 'wiki') {
            return candidate;
        }

        return null;
    }

    private extractArticleTitle(pathParts: string[], hostname: string): string {
        const wikiIndex = pathParts.findIndex((part) => part.toLowerCase() === 'wiki');
        const articleParts = wikiIndex >= 0 ? pathParts.slice(wikiIndex + 1) : pathParts;

        if (articleParts.length === 0) {
            return hostname;
        }

        return decodeURIComponent(articleParts[articleParts.length - 1].replace(/[-_]+/g, ' '));
    }

    private async fetchTextWithFallback(urlData: NormalizedDocumentUrl): Promise<TextExtractionResult> {
        const acceptLanguage = this.buildAcceptLanguage(urlData.locale);
        const jinaResponse = await axios.get<string>(urlData.readerUrl, {
            timeout: 30000,
            responseType: 'text',
            validateStatus: () => true,
            headers: {
                'Accept-Language': acceptLanguage,
            },
        });

        const jinaText = String(jinaResponse.data ?? '').trim();
        if (jinaResponse.status < 400 && jinaText) {
            return {
                content: jinaText,
                mode: 'jina',
                locale: urlData.locale,
                sourceUrl: urlData.canonicalUrl,
                sourceType: urlData.sourceType,
            };
        }

        if (urlData.apiUrl && ([403, 429, 451].includes(jinaResponse.status) || jinaResponse.status >= 500 || !jinaText)) {
            const apiText = await this.fetchTextFromWikiApi(urlData);
            if (apiText) {
                return {
                    content: apiText,
                    mode: 'api',
                    locale: urlData.locale,
                    sourceUrl: urlData.canonicalUrl,
                    sourceType: urlData.sourceType,
                };
            }
        }

        if ([403, 429, 451].includes(jinaResponse.status) || jinaResponse.status >= 500 || !jinaText) {
            const htmlResponse = await axios.get<string>(urlData.canonicalUrl, {
                timeout: 30000,
                responseType: 'text',
                validateStatus: () => true,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': acceptLanguage,
                },
            });

            if (htmlResponse.status >= 400) {
                throw new ServiceUnavailableException(
                    `No se pudo leer la página. r.jina.ai = ${jinaResponse.status}, origen = ${htmlResponse.status}`,
                );
            }

            const parsed = this.extractTextFromPageHtml(String(htmlResponse.data ?? ''), urlData.articleTitle, urlData.locale);
            if (!parsed.trim()) {
                throw new ServiceUnavailableException(
                    `La fuente respondió pero no se pudo extraer texto útil. r.jina.ai = ${jinaResponse.status}`,
                );
            }

            return {
                content: parsed,
                mode: 'html',
                locale: urlData.locale,
                sourceUrl: urlData.canonicalUrl,
                sourceType: urlData.sourceType,
            };
        }

        throw new ServiceUnavailableException(`r.jina.ai devolvió ${jinaResponse.status} para la URL solicitada.`);
    }

    private async fetchTextFromWikiApi(urlData: NormalizedDocumentUrl): Promise<string | null> {
        if (!urlData.apiUrl) {
            return null;
        }

        const apiResponse = await axios.get<{
            parse?: { displaytitle?: string; text?: string; title?: string };
        }>(urlData.apiUrl, {
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                Accept: 'application/json',
                'Accept-Language': this.buildAcceptLanguage(urlData.locale),
            },
        });

        if (apiResponse.status >= 400 || !apiResponse.data?.parse?.text) {
            return null;
        }

        const title = this.cleanTitle(
            apiResponse.data.parse.displaytitle || apiResponse.data.parse.title || urlData.articleTitle,
            urlData.locale,
        );

        return this.extractTextFromRenderedHtml(apiResponse.data.parse.text, title, urlData.locale);
    }

    private buildAcceptLanguage(locale: string): string {
        const normalized = locale.toLowerCase();
        if (normalized === 'und') {
            return 'en-US,en;q=0.8';
        }

        if (normalized === 'es') {
            return 'es-ES,es;q=0.9,en;q=0.8';
        }

        if (normalized.includes('-')) {
            const [base] = normalized.split('-');
            return `${normalized};q=1.0,${base};q=0.9,en;q=0.8`;
        }

        return `${normalized};q=1.0,en;q=0.8`;
    }

    private extractTextFromPageHtml(html: string, fallbackTitle: string, locale: string): string {
        const $ = cheerio.load(html);
        $('script, style, noscript, nav, footer, header, aside').remove();
        $('.global-navigation, .WikiaRail, .page__right-rail, .toc, .ad-slot, .navbox, .portable-infobox').remove();

        const titleCandidates = [
            $('h1').first().text().trim(),
            $('meta[property="og:title"]').attr('content')?.trim() ?? '',
            $('title').first().text().trim(),
            fallbackTitle,
        ].filter(Boolean);

        const title = this.cleanTitle(titleCandidates[0] ?? fallbackTitle, locale);
        const contentSelectors = [
            'article',
            '.mw-parser-output',
            '.page-content',
            '.article-content',
            'main article',
            '[role="main"]',
            'main',
        ];

        let articleText = '';
        for (const selector of contentSelectors) {
            const text = $(selector).first().text().trim();
            if (text.length > 200) {
                articleText = text;
                break;
            }
        }

        if (!articleText) {
            articleText = $('body').text();
        }

        return `# ${title}\n\n${this.normalizeContent(articleText)}`;
    }

    private extractTextFromRenderedHtml(html: string, title: string, locale: string): string {
        const $ = cheerio.load(html);
        $('script, style, noscript, .reference, .toc, .navbox, .portable-infobox, table').remove();
        const content = this.normalizeContent($.root().text());
        const safeTitle = this.cleanTitle(title, locale);

        if (!content.trim()) {
            return '';
        }

        return `# ${safeTitle}\n\n${content}`;
    }

    private cleanTitle(rawTitle: string, locale: string): string {
        const fallback = locale === 'es' ? 'Documento' : 'Document';
        const decodedTitle = cheerio.load(`<span>${rawTitle}</span>`).text();
        const cleaned = decodedTitle
            .replace(/\s*\|\s*Fandom.*$/i, '')
            .replace(/\s*\|\s*Wikipedia.*$/i, '')
            .replace(/\s*\|\s*Wiki.*$/i, '')
            .trim();

        return cleaned || fallback;
    }

    private normalizeContent(content: string): string {
        return content
            .replace(/\r/g, '')
            .replace(/\t/g, ' ')
            .replace(/[ ]{2,}/g, ' ')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => {
                if (!line) {
                    return false;
                }
                if (/^(advertisement|privacy|cookies?|follow us|share this article)$/i.test(line)) {
                    return false;
                }
                return true;
            })
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    private buildSemanticChunks(text: string, maxChars: number): string[] {
        const sections = text
            .split(/\n(?=#)/)
            .map((section) => section.trim())
            .filter(Boolean);

        const chunks: string[] = [];
        for (const section of sections) {
            if (section.length <= maxChars) {
                chunks.push(section);
                continue;
            }

            const paragraphs = section
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean);

            let buffer = '';
            for (const paragraph of paragraphs) {
                if ((buffer + '\n\n' + paragraph).trim().length <= maxChars) {
                    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
                    continue;
                }

                if (buffer) {
                    chunks.push(buffer.trim());
                    buffer = '';
                }

                if (paragraph.length <= maxChars) {
                    buffer = paragraph;
                    continue;
                }

                const sentences = paragraph
                    .split(/(?<=[.!?])\s+/)
                    .map((sentence) => sentence.trim())
                    .filter(Boolean);

                let sentenceBuffer = '';
                for (const sentence of sentences) {
                    if ((sentenceBuffer + ' ' + sentence).trim().length <= maxChars) {
                        sentenceBuffer = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence;
                        continue;
                    }

                    if (sentenceBuffer) {
                        chunks.push(sentenceBuffer.trim());
                    }

                    if (sentence.length > maxChars) {
                        for (let i = 0; i < sentence.length; i += maxChars) {
                            const slice = sentence.slice(i, i + maxChars).trim();
                            if (slice) {
                                chunks.push(slice);
                            }
                        }
                        sentenceBuffer = '';
                        continue;
                    }

                    sentenceBuffer = sentence;
                }

                if (sentenceBuffer) {
                    buffer = sentenceBuffer;
                }
            }

            if (buffer) {
                chunks.push(buffer.trim());
            }
        }

        return chunks.filter(Boolean);
    }

    private buildChunkHash(sourceUrl: string, content: string): string {
        return createHash('sha256')
            .update(sourceUrl)
            .update('\n')
            .update(content.trim())
            .digest('hex');
    }
}
