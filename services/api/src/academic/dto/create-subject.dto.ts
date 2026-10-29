import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateSubjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code?: string;

  @IsString()
  @Length(2, 120)
  name!: string;
}
