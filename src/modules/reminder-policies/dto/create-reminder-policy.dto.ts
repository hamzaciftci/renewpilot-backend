import { IsArray, IsBoolean, IsObject, IsOptional, IsString, Length, ArrayMinSize, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChannelConfigDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  whatsapp?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  push?: boolean;
}

export class CreateReminderPolicyDto {
  @ApiProperty({ example: 'Standart yenileme politikası' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({
    description:
      'Bildirim günleri (negatif = son tarihten sonra). Örn: [60, 30, 14, 7, 3, 1, 0, -1, -3, -7]',
    type: [Number],
    example: [60, 30, 14, 7, 3, 1, 0, -1, -3, -7],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(-365, { each: true })
  @Max(365, { each: true })
  offsetDays!: number[];

  @ApiProperty({ type: ChannelConfigDto })
  @IsObject()
  channelConfig!: ChannelConfigDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
