import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Permission } from '../modules/auth/entities/permission.entity';
import { Role } from '../modules/auth/entities/role.entity';
import { User } from '../modules/auth/entities/user.entity';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definido');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA ?? 'auth',
  entities: [User, Role, Permission],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
