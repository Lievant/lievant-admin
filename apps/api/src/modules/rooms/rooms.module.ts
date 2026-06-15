import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';
import { OfficeAdmin } from './entities/office-admin.entity';
import { Office } from './entities/office.entity';
import { Room } from './entities/room.entity';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Country, City, Office, Room, Booking, OfficeAdmin]), AuthModule],
  controllers: [LocationsController, RoomsController, BookingsController],
  providers: [LocationsService, RoomsService, BookingsService],
})
export class RoomsModule {}
