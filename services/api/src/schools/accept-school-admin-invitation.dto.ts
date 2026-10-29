import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptSchoolAdminInvitationDto {
  @IsString()
  @MinLength(43)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;
}
