import { IsDateString, IsInt, IsString, Length, Min } from 'class-validator';

export class CreateTermDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
