import AppDataSource from '../data-source';
import { ClientSegment } from '../../modules/clients/constants/client-segment.constant';
import { ClientStatus } from '../../modules/clients/constants/client-status.constant';
import { ContactType } from '../../modules/clients/constants/contact-type.constant';
import { Brand } from '../../modules/clients/entities/brand.entity';
import { ClientRecord } from '../../modules/clients/entities/client-record.entity';
import { Company } from '../../modules/clients/entities/company.entity';
import { Contact } from '../../modules/clients/entities/contact.entity';
import { FinancialData } from '../../modules/clients/entities/financial-data.entity';
import { Group } from '../../modules/clients/entities/group.entity';

interface SeedContact {
  name: string;
  position?: string;
  area?: string;
  contactType: ContactType;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

interface SeedCompany {
  name: string;
  legalName?: string;
  rfc: string;
  industry?: string;
  brands: string[];
}

interface SeedFinancial {
  paymentDays?: number;
  currency?: string;
  satPaymentMethod?: string;
  satPaymentForm?: string;
  satCfdiUse?: string;
  satTaxRegime?: string;
}

interface SeedClient {
  groupName?: string;
  companies: SeedCompany[];
  status: ClientStatus;
  segment: ClientSegment;
  country: string;
  city: string;
  financial: SeedFinancial;
  contacts: SeedContact[];
}

const SEED_CLIENTS: SeedClient[] = [
  {
    groupName: 'FEMSA Grupo',
    companies: [
      {
        name: 'Coca-Cola FEMSA S.A.B. de C.V.',
        legalName: 'Coca-Cola FEMSA S.A.B. de C.V.',
        rfc: 'CCF830310UB4',
        industry: 'Bebidas',
        brands: ['Coca-Cola', 'Sprite', 'Fanta'],
      },
      {
        name: 'Jugos del Valle S.A. de C.V.',
        legalName: 'Jugos del Valle S.A. de C.V.',
        rfc: 'JVA9205158R2',
        industry: 'Bebidas',
        brands: ['Del Valle Fresh', 'Del Valle'],
      },
    ],
    status: ClientStatus.ACTIVE,
    segment: ClientSegment.A,
    country: 'México',
    city: 'Monterrey',
    financial: {
      currency: 'MXN',
      satPaymentMethod: 'PPD',
      satCfdiUse: 'G03',
      satTaxRegime: '601',
      paymentDays: 30,
    },
    contacts: [
      {
        name: 'Lic. García',
        position: 'Gerente de Cuentas por Pagar',
        area: 'Finanzas',
        contactType: ContactType.FINANCIAL,
        email: 'cuentaspagar@femsa.com',
      },
      {
        name: 'Ana Martínez',
        position: 'Coordinadora de Campaña',
        area: 'Operaciones',
        contactType: ContactType.OPERATIONAL,
      },
      {
        name: 'Roberto Sánchez',
        position: 'Director de Marketing',
        area: 'Dirección',
        contactType: ContactType.DIRECTION,
      },
    ],
  },
  {
    companies: [
      {
        name: 'Televisa S.A. de C.V.',
        legalName: 'Televisa S.A. de C.V.',
        rfc: 'TEL770907RI1',
        industry: 'Medios y Entretenimiento',
        brands: ['Canal 5', 'Las Estrellas', 'Blim'],
      },
    ],
    status: ClientStatus.ACTIVE,
    segment: ClientSegment.A,
    country: 'México',
    city: 'Ciudad de México',
    financial: {
      paymentDays: 45,
      currency: 'MXN',
      satPaymentMethod: 'PUE',
    },
    contacts: [
      {
        name: 'Patricia Gómez',
        position: 'Gerente de Finanzas',
        area: 'Finanzas',
        contactType: ContactType.FINANCIAL,
        email: 'pgomez@televisa.com',
      },
      {
        name: 'Carlos Ramírez',
        position: 'Ejecutivo Comercial',
        area: 'Comercial',
        contactType: ContactType.COMMERCIAL,
      },
      {
        name: 'Laura Torres',
        position: 'Coordinadora de Operaciones',
        area: 'Operaciones',
        contactType: ContactType.OPERATIONAL,
      },
    ],
  },
  {
    companies: [
      {
        name: 'Startup Rápida S.A. de C.V.',
        legalName: 'Startup Rápida S.A. de C.V.',
        rfc: 'SRA210301KL9',
        industry: 'Tecnología',
        brands: ['Startup Rápida'],
      },
    ],
    status: ClientStatus.PAUSED,
    segment: ClientSegment.C,
    country: 'México',
    city: 'Guadalajara',
    financial: {
      paymentDays: 15,
      currency: 'MXN',
    },
    contacts: [
      {
        name: 'Diego Hernández',
        position: 'Director General / Fundador',
        area: 'Dirección',
        contactType: ContactType.DIRECTION,
        isPrimary: true,
      },
    ],
  },
];

async function nextDisplayId(clientsRepo: ReturnType<typeof AppDataSource.getRepository<ClientRecord>>): Promise<string> {
  const last = await clientsRepo
    .createQueryBuilder('client')
    .withDeleted()
    .orderBy('client.displayId', 'DESC')
    .limit(1)
    .getOne();

  const lastNumber = last ? parseInt(last.displayId.replace('CLI-', ''), 10) || 0 : 0;
  return `CLI-${String(lastNumber + 1).padStart(4, '0')}`;
}

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const groupsRepo = AppDataSource.getRepository(Group);
  const companiesRepo = AppDataSource.getRepository(Company);
  const brandsRepo = AppDataSource.getRepository(Brand);
  const clientsRepo = AppDataSource.getRepository(ClientRecord);
  const financialRepo = AppDataSource.getRepository(FinancialData);
  const contactsRepo = AppDataSource.getRepository(Contact);

  for (const seed of SEED_CLIENTS) {
    const primaryRfc = seed.companies[0]?.rfc;
    const existing = primaryRfc
      ? await companiesRepo.findOne({ where: { rfc: primaryRfc }, withDeleted: true })
      : null;

    if (existing) {
      console.log(`Cliente con RFC ${primaryRfc} ya existe, se omite.`);
      continue;
    }

    let group: Group | null = null;
    if (seed.groupName) {
      group = await groupsRepo.findOne({ where: { name: seed.groupName }, withDeleted: true });
      if (!group) {
        group = await groupsRepo.save(groupsRepo.create({ name: seed.groupName }));
      }
    }

    let primaryCompany: Company | null = null;

    for (const seedCompany of seed.companies) {
      const company = await companiesRepo.save(
        companiesRepo.create({
          groupId: group?.id ?? null,
          name: seedCompany.name,
          legalName: seedCompany.legalName ?? null,
          rfc: seedCompany.rfc,
          industry: seedCompany.industry ?? null,
        }),
      );

      if (!primaryCompany) {
        primaryCompany = company;
      }

      for (const brandName of seedCompany.brands) {
        await brandsRepo.save(brandsRepo.create({ companyId: company.id, name: brandName }));
      }
    }

    if (!primaryCompany) {
      continue;
    }

    const displayId = await nextDisplayId(clientsRepo);

    const clientRecord = await clientsRepo.save(
      clientsRepo.create({
        displayId,
        groupId: group?.id ?? null,
        primaryCompanyId: primaryCompany.id,
        status: seed.status,
        segment: seed.segment,
        country: seed.country,
        city: seed.city,
      }),
    );

    await financialRepo.save(
      financialRepo.create({
        clientRecordId: clientRecord.id,
        paymentDays: seed.financial.paymentDays ?? null,
        currency: seed.financial.currency ?? 'MXN',
        satPaymentMethod: seed.financial.satPaymentMethod ?? null,
        satPaymentForm: seed.financial.satPaymentForm ?? null,
        satCfdiUse: seed.financial.satCfdiUse ?? null,
        satTaxRegime: seed.financial.satTaxRegime ?? null,
      }),
    );

    for (const seedContact of seed.contacts) {
      await contactsRepo.save(
        contactsRepo.create({
          clientRecordId: clientRecord.id,
          name: seedContact.name,
          position: seedContact.position ?? null,
          area: seedContact.area ?? null,
          contactType: seedContact.contactType,
          email: seedContact.email ?? null,
          phone: seedContact.phone ?? null,
          isPrimary: seedContact.isPrimary ?? false,
        }),
      );
    }

    console.log(`Cliente ${displayId} (${primaryCompany.name}) creado.`);
  }

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
