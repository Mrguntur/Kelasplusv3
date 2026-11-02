import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  studentNumber?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  preferredName?: string | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\\d{4}-\\d{2}-\\d{2}$/)
  birthDate?: string | null;
}