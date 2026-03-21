import { Body, Controller, Get, Header, Post, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { LoreService } from './lore.service';

@Controller()
export class LoreController {
    constructor(private readonly loreService: LoreService) { }

    @Post(['lore', 'documents/manual'])
    async addLore(
        @Body('title') title: string,
        @Body('content') content: string,
        @Body('category') category?: string,
    ) {
        return await this.loreService.createLore(title, content, category);
    }

    @Get(['lore/search', 'documents/search'])
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async search(@Query('q') question: string) {
        return await this.loreService.searchLore(question);
    }

    @Get('lore/all')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async getAll() {
        return await this.loreService.findAll();
    }

    @Get('documents')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async listDocuments() {
        return await this.loreService.listDocuments();
    }

    @Get(['lore/ask', 'documents/query'])
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async ask(@Query('q') question: string) {
        return await this.loreService.askQuestion(question);
    }

    @Post(['lore/ingest', 'documents/ingest'])
    async ingest(
        @Body('url') url?: string,
        @Body('urls') urls?: string[],
        @Body('replaceExisting') replaceExisting?: boolean,
        @Body('tags') tags?: string[],
    ) {
        const resolvedUrls = urls?.length ? urls : url ? [url] : [];
        return await this.loreService.ingestUrls(resolvedUrls, { replaceExisting, tags });
    }

    @Post('documents/ingest-files')
    @UseInterceptors(FilesInterceptor('files', 10, {
        fileFilter: (_req, file, cb) => {
            const allowed = /\.(txt|md|pdf)$/i.test(file.originalname);
            cb(null, allowed);
        },
    }))
    async ingestFiles(
        @UploadedFiles() files: Multer.File[],
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