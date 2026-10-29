import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';

export class AssessmentScoreEntryDto {
  @IsUUID()
  studentId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  score!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  feedback?: string;
}

export class UpsertAssessmentScoresDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AssessmentScoreEntryDto)
  scores!: AssessmentScoreEntryDto[];
}
