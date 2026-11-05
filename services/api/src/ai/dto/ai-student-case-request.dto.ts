import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AiStudentCaseRequestDto {
  @IsUUID()
  studentId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  question!: string;
}
