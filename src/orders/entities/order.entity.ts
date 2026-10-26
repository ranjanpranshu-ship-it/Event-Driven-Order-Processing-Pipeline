import { Column, Entity, ObjectIdColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @ObjectIdColumn()
  id: string;

  @Column({ type: 'string' })
  productId: string;

  @Column({ type: 'number' })
  quantity: number;

  @Column({ type: 'string', default: 'pending' })
  status: string;

  @Column({ type: 'date', default: () => new Date() })
  createdAt: Date;
}
