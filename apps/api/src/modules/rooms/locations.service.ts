import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreateCityDto, CreateCountryDto, CreateOfficeDto, UpdateOfficeDto } from './dto/location.dto';
import { UpdateOfficeAdminDto } from './dto/update-office-admin.dto';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';
import { AdminScope, OfficeAdmin } from './entities/office-admin.entity';
import { Office } from './entities/office.entity';

export interface CatalogRoom {
  id: string;
  name: string;
  capacity: number;
  amenities: string[];
  isActive: boolean;
}

export interface CatalogOffice {
  id: string;
  name: string;
  rooms: CatalogRoom[];
}

export interface CatalogCity {
  id: string;
  name: string;
  offices: CatalogOffice[];
}

export interface CatalogCountry {
  id: string;
  name: string;
  /** Necesario en el cliente para resolver el país por defecto (MX) sin heurística por nombre. */
  code: string;
  cities: CatalogCity[];
}

export interface RoomsCatalog {
  countries: CatalogCountry[];
}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Country) private readonly countriesRepository: Repository<Country>,
    @InjectRepository(City) private readonly citiesRepository: Repository<City>,
    @InjectRepository(Office) private readonly officesRepository: Repository<Office>,
    @InjectRepository(OfficeAdmin) private readonly officeAdminsRepository: Repository<OfficeAdmin>,
  ) {}

  /**
   * Árbol completo país → ciudad → oficina → salas activas en UNA sola query.
   *
   * Sustituye al encadenado countries → cities → offices que obligaba a la
   * pantalla de salas a hacer tres renders de servidor consecutivos (uno por
   * nivel del cascade). Los joins van con condición en el ON, no en el WHERE:
   * un país sin ciudades activas debe seguir apareciendo en el selector.
   */
  async getCatalog(): Promise<RoomsCatalog> {
    const countries = await this.countriesRepository
      .createQueryBuilder('country')
      .leftJoinAndSelect('country.cities', 'city', 'city.isActive = true')
      .leftJoinAndSelect('city.offices', 'office', 'office.isActive = true')
      .leftJoinAndSelect('office.rooms', 'room', 'room.isActive = true')
      .where('country.isActive = true')
      .orderBy('country.sortOrder', 'ASC')
      .addOrderBy('city.sortOrder', 'ASC')
      .addOrderBy('office.sortOrder', 'ASC')
      .addOrderBy('room.name', 'ASC')
      .getMany();

    return {
      countries: countries.map((country) => ({
        id: country.id,
        name: country.name,
        code: country.code,
        cities: (country.cities ?? []).map((city) => ({
          id: city.id,
          name: city.name,
          offices: (city.offices ?? []).map((office) => ({
            id: office.id,
            name: office.name,
            rooms: (office.rooms ?? []).map((room) => ({
              id: room.id,
              name: room.name,
              capacity: room.capacity,
              amenities: room.amenities ?? [],
              isActive: room.isActive,
            })),
          })),
        })),
      })),
    };
  }

  async getFullTree(): Promise<Array<Country & { cities: Array<City & { offices: Office[] }> }>> {
    const countries = await this.countriesRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    return Promise.all(
      countries.map(async (country) => {
        const cities = await this.citiesRepository.find({
          where: { countryId: country.id, isActive: true },
          order: { sortOrder: 'ASC' },
        });

        const citiesWithOffices = await Promise.all(
          cities.map(async (city) => ({
            ...city,
            offices: await this.officesRepository.find({
              where: { cityId: city.id, isActive: true },
              order: { sortOrder: 'ASC' },
            }),
          })),
        );

        return { ...country, cities: citiesWithOffices };
      }),
    );
  }

  findActiveCountries(): Promise<Country[]> {
    return this.countriesRepository.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async findCitiesByCountry(countryId: string): Promise<City[]> {
    await this.getCountryOrFail(countryId);
    return this.citiesRepository.find({ where: { countryId, isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async findOfficesByCity(cityId: string): Promise<Office[]> {
    await this.getCityOrFail(cityId);
    return this.officesRepository.find({ where: { cityId, isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async createCountry(dto: CreateCountryDto, user: User): Promise<Country> {
    await this.assertGlobalAdmin(user);

    const country = this.countriesRepository.create({
      name: dto.name,
      code: dto.code,
      sortOrder: dto.sort_order ?? 0,
    });

    return this.countriesRepository.save(country);
  }

  async createCity(dto: CreateCityDto, user: User): Promise<City> {
    await this.assertGlobalAdmin(user);
    await this.getCountryOrFail(dto.country_id);

    const city = this.citiesRepository.create({
      countryId: dto.country_id,
      name: dto.name,
      timezone: dto.timezone ?? 'America/Mexico_City',
      sortOrder: dto.sort_order ?? 0,
    });

    return this.citiesRepository.save(city);
  }

  async createOffice(dto: CreateOfficeDto, user: User): Promise<Office> {
    await this.assertGlobalAdmin(user);
    await this.getCityOrFail(dto.city_id);

    const office = this.officesRepository.create({
      cityId: dto.city_id,
      name: dto.name,
      address: dto.address ?? null,
      sortOrder: dto.sort_order ?? 0,
    });

    return this.officesRepository.save(office);
  }

  async updateOffice(id: string, dto: UpdateOfficeDto, user: User): Promise<Office> {
    await this.assertGlobalAdmin(user);
    const office = await this.getOfficeOrFail(id);

    if (dto.city_id !== undefined) {
      await this.getCityOrFail(dto.city_id);
      office.cityId = dto.city_id;
    }
    if (dto.name !== undefined) office.name = dto.name;
    if (dto.address !== undefined) office.address = dto.address ?? null;
    if (dto.sort_order !== undefined) office.sortOrder = dto.sort_order;
    if (dto.is_active !== undefined) office.isActive = dto.is_active;

    return this.officesRepository.save(office);
  }

  async grantOfficeAdmin(dto: UpdateOfficeAdminDto, user: User): Promise<OfficeAdmin> {
    await this.assertGlobalAdmin(user);

    if (dto.scope === AdminScope.OFFICE) {
      if (!dto.office_id) {
        throw new NotFoundException('office_id es obligatorio para un admin de tipo office');
      }
      await this.getOfficeOrFail(dto.office_id);
    }

    const officeAdmin = this.officeAdminsRepository.create({
      userId: dto.user_id,
      officeId: dto.scope === AdminScope.GLOBAL ? null : dto.office_id ?? null,
      scope: dto.scope,
      grantedBy: user.id,
    });

    return this.officeAdminsRepository.save(officeAdmin);
  }

  async getAdminScope(user: User): Promise<{ isGlobalAdmin: boolean; officeIds: string[] }> {
    if (user.roles.some((role) => role.name === 'SUPER_ADMIN')) {
      return { isGlobalAdmin: true, officeIds: [] };
    }

    const admins = await this.officeAdminsRepository.find({ where: { userId: user.id } });

    return {
      isGlobalAdmin: admins.some((admin) => admin.scope === AdminScope.GLOBAL),
      officeIds: admins
        .filter((admin) => admin.scope === AdminScope.OFFICE && admin.officeId)
        .map((admin) => admin.officeId as string),
    };
  }

  private async assertGlobalAdmin(user: User): Promise<void> {
    if (user.roles.some((role) => role.name === 'SUPER_ADMIN')) {
      return;
    }

    const admin = await this.officeAdminsRepository.findOne({ where: { userId: user.id, scope: AdminScope.GLOBAL } });
    if (!admin) {
      throw new ForbiddenException('Se requieren permisos de administrador global de salas');
    }
  }

  private async getCountryOrFail(id: string): Promise<Country> {
    const country = await this.countriesRepository.findOne({ where: { id } });
    if (!country) {
      throw new NotFoundException(`País ${id} no encontrado`);
    }
    return country;
  }

  private async getCityOrFail(id: string): Promise<City> {
    const city = await this.citiesRepository.findOne({ where: { id } });
    if (!city) {
      throw new NotFoundException(`Ciudad ${id} no encontrada`);
    }
    return city;
  }

  private async getOfficeOrFail(id: string): Promise<Office> {
    const office = await this.officesRepository.findOne({ where: { id } });
    if (!office) {
      throw new NotFoundException(`Oficina ${id} no encontrada`);
    }
    return office;
  }
}
