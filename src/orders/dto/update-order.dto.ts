import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export class UpdateOrderDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ORDER_STATUSES as unknown as string[])
  status: string;
}
