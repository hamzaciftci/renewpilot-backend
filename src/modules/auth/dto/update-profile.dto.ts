import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ description: 'http(s):// URL veya data:image/...;base64 verisi. Max ~500KB.' })
  @IsOptional()
  @IsString()
  @MaxLength(700_000)
  @Matches(/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp|gif);base64,)/, {
    message: 'avatarUrl must be an http(s) URL or a data:image/... base64 string',
  })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: '+905551234567', description: 'E.164 formatında telefon numarası (SMS/WhatsApp için)' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Geçersiz telefon numarası. +905551234567 formatında girin.' })
  phoneNumber?: string;
}
