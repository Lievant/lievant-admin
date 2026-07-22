import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'vacation_policies', schema: 'hr' })
export class VacationPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 3, default: 'MEX' })
  country!: string;

  @Column({ name: 'year_from', type: 'int' })
  yearFrom!: number;

  @Column({ name: 'year_to', type: 'int', nullable: true })
  yearTo!: number | null;

  @Column({ name: 'vacation_days', type: 'int' })
  vacationDays!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
