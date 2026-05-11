import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ example: 'First Bank of Rwanda Ltd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  institutionName: string;

  @ApiProperty({ example: 'Commercial Bank License' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  licenseType: string;

  @ApiPropertyOptional({ example: 'Additional context about the application.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
