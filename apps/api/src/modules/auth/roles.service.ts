import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionsRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find({ relations: { permissions: true } });
  }

  async findById(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });

    if (!role) {
      throw new NotFoundException(`Rol ${id} no encontrado`);
    }

    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.rolesRepository.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Ya existe un rol con el nombre ${dto.name}`);
    }

    const role = this.rolesRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      color: dto.color ?? null,
      isSystem: dto.isSystem ?? false,
    });

    return this.rolesRepository.save(role);
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto): Promise<Role> {
    const role = await this.findById(id);

    role.permissions = dto.permissionIds.length
      ? await this.permissionsRepository.findBy({ id: In(dto.permissionIds) })
      : [];

    return this.rolesRepository.save(role);
  }
}
