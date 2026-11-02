import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateStaffProfileDto {
  @IsString()
  @Length(2, 200)
  displayName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  employeeNumber?: string | null;

  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
