import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { LoreService } from './lore.service';
@Controller('lore') // Esto significa que la URL será http://localhost:3000/lore
export class LoreController {
    constructor(private readonly loreService: LoreService) { }

    @Post() // Metodo POST para enviar datos
    async addLore(
        @Body('title') title: string,
        @Body('content') content: string,
        @Body('category') category: string,
    ) {
        return await this.loreService.createLore(title, content, category);
    }

    @Get('search') // La URL será: http://localhost:3000/lore/search?q=tu_pregunta
    async search(@Query('q') question: string) {
        return await this.loreService.searchLore(question);
    }
    @Get('all') // La URL será: http://localhost:3000/lore/all
    async getAll() {
        return await this.loreService.findAll();
    }
    @Get('ask') // URL: http://localhost:3000/lore/ask?q=¿Quién es Malenia?
    async ask(@Query('q') question: string) {
        return await this.loreService.askQuestion(question);
    }
    @Post('ingest')
    async ingest(@Body('url') url: string, @Body('category') category: string) {
        return await this.loreService.ingestFromUrl(url, category);
    }
}