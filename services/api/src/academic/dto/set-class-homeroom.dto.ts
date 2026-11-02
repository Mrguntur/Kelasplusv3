import { IsOptional, IsUUID } from 'class-validator';

export class SetClassHomeroomDto {
  @IsOptional()
  @IsUUID()
  staffProfileId?: string | null;
}
