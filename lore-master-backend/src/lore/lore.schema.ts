import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Lore extends Document {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    content: string;

    @Prop()
    category?: string;

    @Prop()
    sourceUrl?: string;

    @Prop()
    sourceType?: string;

    @Prop()
    locale?: string;

    @Prop()
    extractionMode?: string;

    @Prop()
    chunkHash?: string;

    @Prop({ type: [String], default: [] })
    tags?: string[];

    @Prop({ type: [Number] })
    embedding: number[];

    createdAt?: Date;
    updatedAt?: Date;
}

export const LoreSchema = SchemaFactory.createForClass(Lore);
LoreSchema.index({ sourceUrl: 1, chunkHash: 1 });