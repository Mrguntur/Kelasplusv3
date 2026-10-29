import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateAssessmentDto {
  @IsUUID()
  teachingAssignmentId!: string;

  @IsString()
  @Length(2, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @IsIn(['QUIZ', 'TASK', 'MIDTERM', 'FINAL', 'PROJECT', 'PRACTICE', 'OTHER'])
  assessmentType?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000)
  maxScore!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
