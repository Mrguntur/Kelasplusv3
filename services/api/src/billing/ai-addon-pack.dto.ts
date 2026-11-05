import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateAiAddonPackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  requestUnits!: number;

  @IsInt()
  @Min(1)
  @Max(1000000000)
  priceAmount!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresAfterDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateAiAddonPackDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  requestUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000000)
  priceAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresAfterDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
