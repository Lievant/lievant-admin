import AppDataSource from '../data-source';
import { Role } from '../../modules/auth/entities/role.entity';
import { User } from '../../modules/auth/entities/user.entity';

const ADMIN_EMAIL = 'paulo@lievant.com';
const ADMIN_NAME = 'Paulo Ossa';
const ADMIN_ROLE = 'SUPER_ADMIN';

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const usersRepo = AppDataSource.getRepository(User);
  const rolesRepo = AppDataSource.getRepository(Role);

  const adminRole = await rolesRepo.findOneBy({ name: ADMIN_ROLE });
  if (!adminRole) {
    throw new Error(`Rol ${ADMIN_ROLE} no existe. Corre las migraciones primero.`);
  }

  const existing = await usersRepo.findOne({ where: { email: ADMIN_EMAIL }, withDeleted: true });
  if (existing) {
    console.log(`Usuario ${ADMIN_EMAIL} ya existe (${existing.id}). No se crea de nuevo.`);
    await AppDataSource.destroy();
    return;
  }

  const user = usersRepo.create({
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    cognitoId: null,
    isActive: true,
    roles: [adminRole],
  });

  const saved = await usersRepo.save(user);

  console.log(`Usuario ${saved.email} (${saved.id}) creado con rol ${ADMIN_ROLE}.`);

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
