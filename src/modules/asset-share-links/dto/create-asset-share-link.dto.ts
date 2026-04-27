import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssetShareLinkDto {
  /** Optional human label so the creator can recognise the link in the list. */
  @ApiPropertyOptional({ example: 'For ABC Corp finance team' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  /** Optional expiry. Omit for a non-expiring link (still revocable). */
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}
