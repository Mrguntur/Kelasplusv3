import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeacherInvitationDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;
}
