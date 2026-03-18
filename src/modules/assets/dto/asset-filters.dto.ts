import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus, AssetType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssetFiltersDto {
  @ApiPropertyOptional({ enum: AssetType })
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({ description: 'Filter renewals from this date' })
  @IsOptional()
  @IsDateString()
  renewalFrom?: string;

  @ApiPropertyOptional({ description: 'Filter renewals up to this date' })
  @IsOptional()
  @IsDateString()
  renewalTo?: string;

  @ApiPropertyOptional({ description: 'Search by asset name or vendor' })
  @IsOptional()
  @IsString()
  search?: string;
}
