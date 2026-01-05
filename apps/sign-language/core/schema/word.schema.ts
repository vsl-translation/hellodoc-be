import { Prop, SchemaFactory, Schema } from "@nestjs/mongoose";

@Schema({ collection: 'words', timestamps: true })
export class Word extends Document {
    @Prop({ required: true, unique: true })
    word: string;

    @Prop({ required: true })
    gestureCode: string;

    @Prop({ type: Object })
    gestures: Record<string, any>; // Lưu gesture data từ Colab

    @Prop({ type: [String], default: [] })
    synonyms: string[];

    @Prop({ default: 0 })
    usageCount: number;
}

export const WordSchema =
    SchemaFactory.createForClass(Word);