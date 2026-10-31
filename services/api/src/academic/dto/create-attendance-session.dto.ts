import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateAttendanceSessionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9 _.-]+$/)
  sessionLabel?: string;
}
