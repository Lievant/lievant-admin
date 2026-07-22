import AppDataSource from '../data-source';
import { UserLocation } from '../../modules/auth/constants/locations.constant';
import { Role } from '../../modules/auth/entities/role.entity';
import { User } from '../../modules/auth/entities/user.entity';

/**
 * cognito_id real obtenido del User Pool: el intento de login con
 * "Continuar con Microsoft" creó este usuario federado en Cognito
 * (Username Microsoft_..., sub b4888408-1071-70d0-4806-1b2b55c82938)
 * con email "paulo@lievant.com", que es el email real en Azure AD.
 */
const SUPER_ADMIN_EMAIL = 'paulo@lievant.com';
const SUPER_ADMIN_NAME = 'Paulo Ossa';
const SUPER_ADMIN_COGNITO_ID = 'b4888408-1071-70d0-4806-1b2b55c82938';
const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const usersRepo = AppDataSource.getRepository(User);
  const rolesRepo = AppDataSource.getRepository(Role);

  const superAdminRole = await rolesRepo.findOneBy({ name: SUPER_ADMIN_ROLE });
  if (!superAdminRole) {
    throw new Error(`Rol ${SUPER_ADMIN_ROLE} no existe. Corre las migraciones primero.`);
  }

  let user = await usersRepo.findOne({
    where: [{ email: SUPER_ADMIN_EMAIL }, { cognitoId: SUPER_ADMIN_COGNITO_ID }],
    relations: { roles: true },
  });

  if (!user) {
    user = usersRepo.create({
      email: SUPER_ADMIN_EMAIL,
      name: SUPER_ADMIN_NAME,
      cognitoId: SUPER_ADMIN_COGNITO_ID,
      isActive: true,
      roles: [],
    });
  }

  if (!user.cognitoId) {
    user.cognitoId = SUPER_ADMIN_COGNITO_ID;
  }

  user.email = SUPER_ADMIN_EMAIL;
  user.location = user.location ?? UserLocation.LEON;

  if (!user.roles?.some((role) => role.name === SUPER_ADMIN_ROLE)) {
    user.roles = [...(user.roles ?? []), superAdminRole];
  }

  const saved = await usersRepo.save(user);

  console.log(`Usuario ${saved.email} (${saved.id}) configurado como ${SUPER_ADMIN_ROLE}.`);

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
