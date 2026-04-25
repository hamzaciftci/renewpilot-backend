import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class WhoisQueryDto {
  @ApiProperty({
    description: 'Fully qualified domain name (e.g. "example.com")',
    example: 'example.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  domain!: string;
}
