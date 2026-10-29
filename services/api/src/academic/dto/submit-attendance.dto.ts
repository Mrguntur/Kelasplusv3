import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const attendanceStatuses = ['PRESENT', 'LATE', 'SICK', 'EXCUSED', 'ABSENT'] as const;

export class AttendanceEntryDto {
  @IsUUID()
  studentId!: string;

  @IsIn(attendanceStatuses)
  status!: (typeof attendanceStatuses)[number];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class SubmitAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records!: AttendanceEntryDto[];
}
