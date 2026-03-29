import { Body, Controller, Get, Header, Post, Query, Res, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor, } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { LoreService } from './lore.service';
import { AskDto } from './dto/ask.dto.js';
import { IngestUrlsDto } from './dto/ingest-urls.dto.js';
import { CreateLoreDto } from './dto/create-lore.dto.js';

@Controller()
export class LoreController {
    constructor(private readonly loreService: LoreService) { }

    @Post('documents/manual')
    async addLore(@Body() dto: CreateLoreDto) {
        return await this.loreService.createLore(dto.title, dto.content, dto.category);
    }

    @Get('documents/search')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async search(@Query('q') question: string) {
        return await this.loreService.searchLore(question);
    }

    @Get('documents')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async listDocuments(
        @Query('skip') skip?: string,
        @Query('limit') limit?: string,
    ) {
        return await this.loreService.listDocuments(
            Math.max(0, parseInt(skip || '0', 10) || 0),
            Math.min(500, Math.max(1, parseInt(limit || '50', 10) || 50)),
        );
    }

    @Get('documents/all')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async getAll(
        @Query('skip') skip?: string,
        @Query('limit') limit?: string,
    ) {
        return await this.loreService.findAll(
            Math.max(0, parseInt(skip || '0', 10) || 0),
            Math.min(1000, Math.max(1, parseInt(limit || '100', 10) || 100)),
        );
    }

    @Post('documents/query')
    async ask(@Body() dto: AskDto) {
        return await this.loreService.askQuestion(dto.question, dto.history);
    }

    @Post('documents/query/stream')
    askStream(@Body() dto: AskDto, @Res() res: Response) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const stream$ = this.loreService.askQuestionStream(dto.question, dto.history);
        stream$.subscribe({
            next: (event) => {
                res.write(`data: ${event.data}\n\n`);
            },
            complete: () => {
                res.end();
            },
            error: () => {
                res.end();
            },
        });
    }

    @Post('documents/ingest')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    async ingest(@Body() dto: IngestUrlsDto) {
        const resolvedUrls = dto.urls?.length ? dto.urls : dto.url ? [dto.url] : [];
        return await this.loreService.ingestUrls(resolvedUrls, {
            replaceExisting: dto.replaceExisting,
            tags: dto.tags,
        });
    }

    @Post('documents/ingest-files')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @UseInterceptors(FilesInterceptor('files', 10, {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = /\.(txt|md|pdf|docx)$/i.test(file.originalname);
            if (!allowed) {
                cb(new BadRequestException('Tipo de archivo no permitido. Usa TXT, MD, PDF o DOCX.'), false);
                return;
            }
            cb(null, true);
        },
    }))
    async ingestFiles(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('tags') tagsStr?: string,
        @Body('replaceExisting') replaceExistingRaw?: string | boolean,
    ) {
        const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
        const replaceExisting =
            typeof replaceExistingRaw === 'boolean'
                ? replaceExistingRaw
                : String(replaceExistingRaw).toLowerCase() === 'true';

        return await this.loreService.ingestFiles(files, { replaceExisting, tags });
    }
}