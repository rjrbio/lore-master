import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoreController } from './lore.controller';
import { Lore, LoreSchema } from './lore.schema';
import { LoreService } from './lore.service';

@Module({
	imports: [MongooseModule.forFeature([{ name: Lore.name, schema: LoreSchema }])],
	controllers: [LoreController],
	providers: [LoreService],
	exports: [LoreService],
})
export class LoreModule { }
