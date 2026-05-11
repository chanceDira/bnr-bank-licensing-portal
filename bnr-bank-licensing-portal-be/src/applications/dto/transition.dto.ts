import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecisionDto {
  @ApiPropertyOptional({
    example: 'Insufficient capital reserve documentation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}

export class RequestInfoDto {
  @ApiPropertyOptional({
    example:
      'Please provide audited financial statements for the last 3 years.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CompleteReviewDto {
  @ApiPropertyOptional({
    example:
      'Capital adequacy and supporting documents reviewed. Recommend approval.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewComment?: string;
}
