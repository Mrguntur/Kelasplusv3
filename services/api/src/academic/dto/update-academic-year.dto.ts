import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @Length(4, 40)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['PLANNED', 'ACTIVE', 'COMPLETED'])
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}