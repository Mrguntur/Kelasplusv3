import { IsString, MaxLength, MinLength } from 'class-validator';

export class AiRequestDto {
  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  question!: string;
}
