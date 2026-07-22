import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { User } from './entities/user.entity';

export interface CreateAnnouncementDto {
  title: string;
  body: string;
  eventDate?: string;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
  ) {}

  list(): Promise<Announcement[]> {
    return this.repo.find({
      where: { isActive: true },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async create(dto: CreateAnnouncementDto, author: User): Promise<Announcement> {
    this.assertCanManage(author);
    const saved = await this.repo.save(
      this.repo.create({ title: dto.title, body: dto.body, authorId: author.id, eventDate: dto.eventDate ?? null }),
    );
    return this.repo.findOneOrFail({ where: { id: saved.id }, relations: { author: true } });
  }

  async remove(id: string, actor: User): Promise<void> {
    this.assertCanManage(actor);
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException(`Comunicado ${id} no encontrado`);
    await this.repo.softDelete(id);
  }

  private assertCanManage(user: User): void {
    if (user.roles?.some((r) => r.name === 'SUPER_ADMIN')) return;

    const override = user.userPermissions?.find(
      (up) => up.permission?.section === 'rrhh' && up.permission?.module === 'comunicados' && up.permission?.action === 'write',
    );
    if (override !== undefined) {
      if (!override.granted) {
        throw new ForbiddenException('No tienes permisos para gestionar comunicados');
      }
      return;
    }

    const hasViaRole = user.roles?.some((role) =>
      role.permissions?.some((p) => p.section === 'rrhh' && p.module === 'comunicados' && p.action === 'write'),
    );
    if (!hasViaRole) {
      throw new ForbiddenException('No tienes permisos para gestionar comunicados');
    }
  }
}
