import { IsString, IsNotEmpty, IsArray, IsOptional, IsIn, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryItemDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(['user', 'assistant'])
    role: 'user' | 'assistant';

    @IsString()
    @IsNotEmpty()
    @MaxLength(8000)
    content: string;
}

export class AskDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    question: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ChatHistoryItemDto)
    history?: ChatHistoryItemDto[];
}
