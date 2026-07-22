import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCityDto, CreateCountryDto, CreateOfficeDto, UpdateOfficeDto } from './dto/location.dto';
import { UpdateOfficeAdminDto } from './dto/update-office-admin.dto';
import { LocationsService } from './locations.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  getFullTree() {
    return this.locationsService.getFullTree();
  }

  @Get('countries')
  findActiveCountries() {
    return this.locationsService.findActiveCountries();
  }

  @Get('countries/:id/cities')
  findCitiesByCountry(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.findCitiesByCountry(id);
  }

  @Get('cities/:id/offices')
  findOfficesByCity(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.findOfficesByCity(id);
  }

  @Get('admin-scope')
  getAdminScope(@CurrentUser() user: User) {
    return this.locationsService.getAdminScope(user);
  }

  @Post('countries')
  createCountry(@Body() dto: CreateCountryDto, @CurrentUser() user: User) {
    return this.locationsService.createCountry(dto, user);
  }

  @Post('cities')
  createCity(@Body() dto: CreateCityDto, @CurrentUser() user: User) {
    return this.locationsService.createCity(dto, user);
  }

  @Post('offices')
  createOffice(@Body() dto: CreateOfficeDto, @CurrentUser() user: User) {
    return this.locationsService.createOffice(dto, user);
  }

  @Patch('offices/:id')
  updateOffice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfficeDto, @CurrentUser() user: User) {
    return this.locationsService.updateOffice(id, dto, user);
  }

  @Post('admins')
  grantOfficeAdmin(@Body() dto: UpdateOfficeAdminDto, @CurrentUser() user: User) {
    return this.locationsService.grantOfficeAdmin(dto, user);
  }
}
