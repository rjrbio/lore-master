import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Lore extends Document {
    @Prop({ required: true })
    title: string; // Ejemplo: "Malenia, la Espada de Miquella"

    @Prop({ required: true })
    content: string; // El texto descriptivo del objeto/personaje

    @Prop()
    category: string; // "Boss", "Item", "Location"

    @Prop({ type: [Number] })
    embedding: number[]; // AQUÍ guardaremos el vector de 1536 números
}

export const LoreSchema = SchemaFactory.createForClass(Lore);