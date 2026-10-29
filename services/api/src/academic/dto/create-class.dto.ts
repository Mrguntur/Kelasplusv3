import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateClassDto {
  @IsUUID()
  academicYearId!: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel!: number;

  @IsOptional()
  @IsUUID()
  homeroomStaffProfileId?: string;
}
