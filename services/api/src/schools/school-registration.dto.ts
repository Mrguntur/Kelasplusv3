import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SchoolRegistrationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  schoolName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug harus berupa huruf kecil, angka, dan tanda hubung.',
  })
  requestedSlug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  contactName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
