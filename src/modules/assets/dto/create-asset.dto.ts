import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  assetType: AssetType;

  @ApiProperty({ example: 'example.com' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'GoDaddy' })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiProperty({ example: '2027-03-15', description: 'ISO 8601 date string — stored as UTC' })
  @IsDateString()
  renewalDate: string;

  @ApiPropertyOptional({ example: '29.99' })
  @IsOptional()
  @IsDecimal()
  priceAmount?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  priceCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Asset-type-specific extra fields' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
