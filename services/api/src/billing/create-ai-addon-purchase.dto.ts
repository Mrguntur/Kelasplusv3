import { IsUUID } from 'class-validator';

export class CreateAiAddonPurchaseDto {
  @IsUUID()
  packId!: string;
}
