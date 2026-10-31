import { IsUUID } from 'class-validator';

export class SelectSchoolDto {
  @IsUUID()
  schoolId!: string;
}
