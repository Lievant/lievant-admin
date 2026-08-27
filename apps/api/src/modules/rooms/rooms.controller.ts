import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { LocationsService } from './locations.service';
import { RoomsService } from './rooms.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly locationsService: LocationsService,
  ) {}

  @Get()
  findWithAvailability(@Query() query: QueryAvailabilityDto) {
    return this.roomsService.findWithAvailability(query);
  }

  // Debe declararse antes de @Get(':id'), igual que 'by-office'.
  @Get('catalog')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  getCatalog() {
    return this.locationsService.getCatalog();
  }

  @Get('admin')
  findAllByOffice(@Query('office_id', ParseUUIDPipe) officeId: string, @CurrentUser() user: User) {
    return this.roomsService.findAllByOffice(officeId, user);
  }

  // Debe declararse antes de @Get(':id'): Nest resuelve por orden y esa ruta
  // capturaría 'by-office' como id, fallando en el ParseUUIDPipe.
  @Get('by-office')
  findActiveByOffice(@Query('office_id', ParseUUIDPipe) officeId: string) {
    return this.roomsService.findActiveByOffice(officeId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: User) {
    return this.roomsService.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto, @CurrentUser() user: User) {
    return this.roomsService.update(id, dto, user);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.roomsService.toggleActive(id, user);
  }
}
