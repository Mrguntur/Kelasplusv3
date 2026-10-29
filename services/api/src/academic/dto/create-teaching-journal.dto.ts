import { IsDateString, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class CreateTeachingJournalDto {
  @IsUUID()
  teachingAssignmentId!: string;

  @IsDateString()
  journalDate!: string;

  @IsString()
  @Length(2, 250)
  topic!: string;

  @IsString()
  @Length(2, 10000)
  learningActivity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  reflection?: string;
}
