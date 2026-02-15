// apps/sign-language/core/schema/word.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'words' })
export class Word extends Document {
    @Prop({ required: true, unique: true, index: true })
    word: string;

    @Prop({ required: true })
    code: string; // Media JSON URL

    @Prop()
    originalVideoUrl: string;

    @Prop()
    accuracy: number;

    @Prop()
    gross: string;

    @Prop({ type: [String] })
    tags: string[];

    @Prop({ default: 0 })
    usageCount: number;
}

export const WordSchema = SchemaFactory.createForClass(Word);