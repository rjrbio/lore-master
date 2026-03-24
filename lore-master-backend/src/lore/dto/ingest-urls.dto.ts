import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';

export class IngestUrlsDto {
    @IsString()
    @IsOptional()
    @IsUrl({}, { message: 'La URL proporcionada no es válida.' })
    url?: string;

    @IsArray()
    @IsString({ each: true })
    @IsUrl({}, { each: true, message: 'Cada URL debe ser válida.' })
    @IsOptional()
    @ArrayMaxSize(50)
    urls?: string[];

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    replaceExisting?: boolean;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ArrayMaxSize(20)
    tags?: string[];
}
