import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus } from './entities/booking.entity';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('my')
  findMy(@CurrentUser() user: User, @Query('status') status?: BookingStatus, @Query('upcoming') upcoming?: string) {
    return this.bookingsService.findMy(user.id, status, upcoming === 'true');
  }

  @Get('admin')
  findAdmin(
    @CurrentUser() user: User,
    @Query('office_id') officeId?: string,
    @Query('room_id') roomId?: string,
    @Query('status') status?: BookingStatus,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.bookingsService.findAdmin(user, {
      office_id: officeId,
      room_id: roomId,
      status,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get('pending-approval')
  findPendingApproval(@CurrentUser() user: User) {
    return this.bookingsService.findPendingApproval(user);
  }

  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: User) {
    return this.bookingsService.create(dto, user);
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto, @CurrentUser() user: User) {
    return this.bookingsService.cancel(id, user, dto);
  }

  @Patch(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookingsService.approve(id, user);
  }

  @Patch(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookingsService.reject(id, user);
  }
}
