import { IsUUID } from 'class-validator';

export class TransferEnrollmentDto {
  @IsUUID()
  targetClassId!: string;
}