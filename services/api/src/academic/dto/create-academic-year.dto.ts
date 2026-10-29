import { IsDateString, IsIn, IsString, Length } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString()
  @Length(4, 40)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIn(['PLANNED', 'ACTIVE', 'COMPLETED'])
  status!: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}
