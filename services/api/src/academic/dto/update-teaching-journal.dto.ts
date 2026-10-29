import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateTeachingJournalDto {
  @IsOptional()
  @IsString()
  @Length(2, 250)
  topic?: string;

  @IsOptional()
  @IsString()
  @Length(2, 10000)
  learningActivity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  reflection?: string;
}
