import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdatePersonalDataDto } from './dto/personal-data.dto';
import { UpdateCompensationDto } from './dto/compensation.dto';
import { CreateVacationDto, UpdateVacationDto } from './dto/vacation.dto';
import { CreateEmergencyContactDto, UpdateEmergencyContactDto } from './dto/emergency-contact.dto';
import { UpdateTerminationDto } from './dto/termination.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { EmployeesService } from './employees.service';

@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query() query: QueryEmployeesDto) {
    return this.employeesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.remove(id);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_RRHH)
  @Get(':id/personal')
  getPersonalData(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getPersonalData(id);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_RRHH)
  @Patch(':id/personal')
  updatePersonalData(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonalDataDto) {
    return this.employeesService.updatePersonalData(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_NOMINA)
  @Get(':id/compensation')
  getCompensation(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getCompensation(id);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_NOMINA)
  @Patch(':id/compensation')
  updateCompensation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompensationDto) {
    return this.employeesService.updateCompensation(id, dto);
  }

  @Get(':id/vacations')
  listVacations(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.listVacations(id);
  }

  @Post(':id/vacations')
  createVacation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVacationDto) {
    return this.employeesService.createVacation(id, dto);
  }

  @Patch('vacations/:vacId')
  updateVacation(@Param('vacId', ParseUUIDPipe) vacId: string, @Body() dto: UpdateVacationDto) {
    return this.employeesService.updateVacation(vacId, dto);
  }

  @Get(':id/contacts')
  listEmergencyContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.listEmergencyContacts(id);
  }

  @Post(':id/contacts')
  addEmergencyContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateEmergencyContactDto) {
    return this.employeesService.addEmergencyContact(id, dto);
  }

  @Patch('contacts/:contactId')
  updateEmergencyContact(@Param('contactId', ParseUUIDPipe) contactId: string, @Body() dto: UpdateEmergencyContactDto) {
    return this.employeesService.updateEmergencyContact(contactId, dto);
  }

  @Delete('contacts/:contactId')
  removeEmergencyContact(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.employeesService.removeEmergencyContact(contactId);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_RRHH)
  @Get(':id/termination')
  getTermination(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getTermination(id);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_RRHH)
  @Patch(':id/termination')
  updateTermination(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTerminationDto) {
    return this.employeesService.updateTermination(id, dto);
  }
}
