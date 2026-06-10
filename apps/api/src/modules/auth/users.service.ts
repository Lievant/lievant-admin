import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: { roles: true } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { roles: { permissions: true } },
    });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }

    return user;
  }

  async findByCognitoId(cognitoId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { cognitoId },
      relations: { roles: { permissions: true } },
    });
  }

  async linkCognitoIdByEmail(email: string, cognitoId: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: { roles: { permissions: true } },
    });

    if (!user) {
      return null;
    }

    if (!user.cognitoId) {
      user.cognitoId = cognitoId;
      await this.usersRepository.save(user);
    }

    return user;
  }

  async create(dto: CreateUserDto, createdBy?: string): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con el email ${dto.email}`);
    }

    const roles = dto.roleIds?.length ? await this.rolesRepository.findBy({ id: In(dto.roleIds) }) : [];

    const user = this.usersRepository.create({
      email: dto.email,
      name: dto.name,
      cognitoId: dto.cognitoId ?? null,
      isActive: dto.isActive ?? true,
      roles,
      createdBy: createdBy ?? null,
    });

    return this.usersRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto, updatedBy?: string): Promise<User> {
    const user = await this.findById(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException(`Ya existe un usuario con el email ${dto.email}`);
      }
      user.email = dto.email;
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.cognitoId !== undefined) user.cognitoId = dto.cognitoId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length ? await this.rolesRepository.findBy({ id: In(dto.roleIds) }) : [];
    }

    user.updatedBy = updatedBy ?? null;

    return this.usersRepository.save(user);
  }

  async deactivate(id: string, updatedBy?: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    user.updatedBy = updatedBy ?? null;
    await this.usersRepository.save(user);
    await this.usersRepository.softDelete(id);
  }
}
