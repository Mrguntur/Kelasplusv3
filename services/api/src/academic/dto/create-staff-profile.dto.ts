import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateStaffProfileDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(2, 200)
  displayName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  employeeNumber?: string;
}
