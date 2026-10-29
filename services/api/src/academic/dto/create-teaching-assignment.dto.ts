import { IsOptional, IsUUID } from 'class-validator';

export class CreateTeachingAssignmentDto {
  @IsUUID()
  classId!: string;

  @IsUUID()
  subjectId!: string;

  @IsUUID()
  staffProfileId!: string;

  @IsOptional()
  @IsUUID()
  termId?: string;
}
