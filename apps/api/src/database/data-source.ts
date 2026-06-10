import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Permission } from '../modules/auth/entities/permission.entity';
import { Role } from '../modules/auth/entities/role.entity';
import { User } from '../modules/auth/entities/user.entity';

for (const envFile of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), envFile) });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definido');
}

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA ?? 'auth',
  entities: [User, Role, Permission],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
