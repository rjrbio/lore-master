import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateLoreDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50000)
    content: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    category?: string;
}
