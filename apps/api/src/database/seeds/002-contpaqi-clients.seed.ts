import AppDataSource from '../data-source';
import { Company } from '../../modules/clients/entities/company.entity';
import { ClientRecord } from '../../modules/clients/entities/client-record.entity';
import { ClientStatus } from '../../modules/clients/constants/client-status.constant';

const CONTPAQI_CLIENTS = [
  { contpaqId: '7', name: 'Acciones Digitales, S.A. de C.V.', paymentTerms: null },
  { contpaqId: '24', name: 'CALZADO CHAVITA', paymentTerms: null },
  { contpaqId: '25', name: 'Bidigital Inc', paymentTerms: null },
  { contpaqId: '32', name: 'CALZADOS FINOS ITALIANOS', paymentTerms: null },
  { contpaqId: '46', name: 'CALZADO COQUETA', paymentTerms: null },
  { contpaqId: '50', name: 'CAJA POPULAR MEXICANA', paymentTerms: 'CONTADO' },
  { contpaqId: '53', name: 'MANUFACTURERA DE BOTAS CUADRA', paymentTerms: null },
  { contpaqId: '72', name: 'ERGOSTYLE MUEBLES', paymentTerms: null },
  { contpaqId: '76', name: 'CALZADO EVOLUCION', paymentTerms: null },
  { contpaqId: '82', name: 'ZAPATERIA LA GRAN PLAZA', paymentTerms: null },
  { contpaqId: '88', name: 'COMERCIALIZADORA QK', paymentTerms: null },
  { contpaqId: '117', name: 'MANUFACTURAS DE CALZADO FINO', paymentTerms: null },
  { contpaqId: '127', name: 'KTB COMERCIALIZADORA DE MEXICO', paymentTerms: 'CONTADO' },
  { contpaqId: '129', name: 'COLOMBIAN INNOVATIVE BRANDS', paymentTerms: null },
  { contpaqId: '170', name: 'MARISCAL MODA HOMBRE', paymentTerms: null },
  { contpaqId: '174', name: 'GUEVARA SPORTS', paymentTerms: null },
  { contpaqId: '232', name: 'INDUSTRIAS PIAGUI', paymentTerms: null },
  { contpaqId: '233', name: 'EL OPERADOR', paymentTerms: 'CONTADO' },
  { contpaqId: '245', name: 'QUALEN', paymentTerms: 'CONTADO' },
  { contpaqId: '246', name: 'RD GESTAO E SISTEMAS SA', paymentTerms: null },
  { contpaqId: '270', name: 'TIENDAS CUADRA', paymentTerms: 'CONTADO' },
  { contpaqId: '273', name: 'COMERCIALIZADORA DE CALZADO EL MARATON', paymentTerms: 'CONTADO' },
  { contpaqId: '315', name: 'DISTRIBUIDORA FLEXI', paymentTerms: 'CONTADO' },
  { contpaqId: '320', name: 'LIFESTYLE AND HERITAGE BRANDS OF MEXICO', paymentTerms: null },
  { contpaqId: '365', name: 'PLAYCLUB', paymentTerms: 'CONTADO' },
  { contpaqId: '411', name: 'FLEXI ECOMMERCE', paymentTerms: 'CONTADO' },
  { contpaqId: '417', name: 'DEREMATE.COM DE MEXICO', paymentTerms: null },
  { contpaqId: '426', name: 'ACCIONES DIGITALES', paymentTerms: null },
  { contpaqId: '437', name: 'BODEGA DE VINO SAN MIGUEL DE ALLENDE', paymentTerms: null },
  { contpaqId: '442', name: 'COMERCIAL ANFIBIO', paymentTerms: null },
  { contpaqId: '494', name: 'WKL FOOTWEAR MEXICO', paymentTerms: 'CONTADO' },
  { contpaqId: '531', name: 'DISTRIBUIDORA MODA SCARPA', paymentTerms: null },
  { contpaqId: '551', name: 'ARCONAL', paymentTerms: 'CONTADO' },
  { contpaqId: '560', name: 'VINY ELECTRIC', paymentTerms: null },
  { contpaqId: '566', name: 'DIVERTICALZADOS', paymentTerms: null },
  { contpaqId: '568', name: 'COMERCIALIZADORA MODA SCARPA', paymentTerms: null },
  { contpaqId: '586', name: 'GRUPO MITTORI', paymentTerms: null },
  { contpaqId: '589', name: 'ALIMENTOS ENCO', paymentTerms: null },
  { contpaqId: '595', name: 'UNIVERSIDAD TECNOLOGICA DE SAN JUAN DEL RIO', paymentTerms: null },
  { contpaqId: '600', name: 'AEROPUERTO DE AGUASCALIENTES', paymentTerms: null },
  { contpaqId: '601', name: 'AEROPUERTO DEL BAJIO', paymentTerms: null },
  { contpaqId: '602', name: 'AEROPUERTO DE GUADALAJARA', paymentTerms: null },
  { contpaqId: '603', name: 'AEROPUERTO DE HERMOSILLO', paymentTerms: null },
  { contpaqId: '604', name: 'AEROPUERTO DE LA PAZ', paymentTerms: null },
  { contpaqId: '605', name: 'AEROPUERTO DE LOS MOCHIS', paymentTerms: null },
  { contpaqId: '606', name: 'AEROPUERTO DE MORELIA', paymentTerms: null },
  { contpaqId: '607', name: 'AEROPUERTO DE MEXICALI', paymentTerms: null },
  { contpaqId: '608', name: 'AEROPUERTO DE PUERTO VALLARTA', paymentTerms: null },
  { contpaqId: '609', name: 'SERVICIOS A LA INFRAESTRUCTURA AEROPORTUARIA DEL PACIFICO', paymentTerms: null },
  { contpaqId: '610', name: 'AEROPUERTO DE SAN JOSE DEL CABO', paymentTerms: null },
  { contpaqId: '611', name: 'AEROPUERTO DE TIJUANA', paymentTerms: null },
  { contpaqId: '612', name: 'AEROPUERTO DE MANZANILLO', paymentTerms: null },
  { contpaqId: '635', name: 'RUBA DESARROLLOS', paymentTerms: null },
  { contpaqId: '637', name: 'FASHION DEPOT', paymentTerms: null },
  { contpaqId: '639', name: 'MIRIAM ZEPEDA VELAZQUEZ', paymentTerms: null },
  { contpaqId: '641', name: 'FERRIONI INTERNAZIONALE', paymentTerms: null },
  { contpaqId: '643', name: 'COMPUTING AND PRINTING MEXICO', paymentTerms: null },
  { contpaqId: '650', name: 'VF OUTDOOR MEXICO', paymentTerms: null },
  { contpaqId: '658', name: 'COSTITX', paymentTerms: null },
  { contpaqId: '663', name: 'INTERPIEL EXOTIC', paymentTerms: null },
  { contpaqId: '664', name: 'PREFABRICADORA DE LOSAS', paymentTerms: null },
  { contpaqId: '675', name: 'LYSSETTE', paymentTerms: null },
  { contpaqId: '680', name: 'FABRICAS DE CALZADO ANDREA', paymentTerms: null },
  { contpaqId: '689', name: 'PUERTA CERO PARKING', paymentTerms: null },
  { contpaqId: '691', name: 'MEIBI CORPORATION', paymentTerms: null },
  { contpaqId: '693', name: 'PANGEA ACTUAL', paymentTerms: null },
  { contpaqId: '710', name: 'SHARKNINJA MEXICO', paymentTerms: '2 SEMANAS' },
  { contpaqId: '713', name: 'ASSA ABLOY MEXICO', paymentTerms: null },
  { contpaqId: '716', name: 'OPERADORA DE TIENDAS GARCAM', paymentTerms: null },
  { contpaqId: '724', name: 'RESIDENCIAS PUNTA DEL ESTE', paymentTerms: null },
  { contpaqId: '725', name: 'RYA', paymentTerms: null },
  { contpaqId: '746', name: 'YALE DE MEXICO', paymentTerms: null },
  { contpaqId: '757', name: 'SOLUCIONES ECOMMERCE GO', paymentTerms: null },
  { contpaqId: '761', name: 'FAJAS MYD MEXICO', paymentTerms: null },
  { contpaqId: '762', name: 'REAL MODA VAQUERA', paymentTerms: null },
  { contpaqId: '771', name: 'MARAH RETAIL', paymentTerms: null },
  { contpaqId: '772', name: 'FORTMATGE', paymentTerms: null },
  { contpaqId: '776', name: 'SCHNEIDER ELECTRIC MEXICO', paymentTerms: null },
  { contpaqId: '779', name: 'COMERCIALIZADORA KIRIN', paymentTerms: null },
  { contpaqId: '783', name: 'TURBOTRAFFIC S.A.S.', paymentTerms: null },
  { contpaqId: '792', name: '180 GRAMOS COMPANY', paymentTerms: null },
  { contpaqId: '793', name: 'LUISA FERNANDA JAUREGUI GONZALEZ', paymentTerms: null },
  { contpaqId: '801', name: 'SANITARIOS PORTATILES DEL CENTRO', paymentTerms: null },
  { contpaqId: '802', name: 'COFLEX', paymentTerms: null },
  { contpaqId: '806', name: 'BODY FORM', paymentTerms: null },
  { contpaqId: '807', name: 'ELECTRONICA STEREN', paymentTerms: null },
  { contpaqId: '808', name: 'EMATEXCO', paymentTerms: null },
  { contpaqId: '810', name: 'ESTRATEGIA MIC S.A.S.', paymentTerms: null },
  { contpaqId: '826', name: 'COMERCIALIZADORA KLERS', paymentTerms: null },
  { contpaqId: '828', name: 'IBC OPERATIONS', paymentTerms: null },
  { contpaqId: '829', name: 'CALZADO NOMADAS', paymentTerms: null },
  { contpaqId: '834', name: 'OPTIMEN', paymentTerms: null },
  { contpaqId: '835', name: 'COMERCIALIZADORA SANDOM', paymentTerms: null },
  { contpaqId: '838', name: 'EMOTIONS LABS', paymentTerms: null },
  { contpaqId: '841', name: 'GRUPO HORNER GARCIA', paymentTerms: null },
  { contpaqId: '848', name: 'PROEDUCO DEL BAJIO', paymentTerms: null },
  { contpaqId: '851', name: 'TIKTOK MEXICO TECNOLOGIA', paymentTerms: null },
  { contpaqId: '852', name: 'SERVICIOS INTERNACIONALES DE COMERCIO', paymentTerms: null },
  { contpaqId: '855', name: 'SM DIGITAL S.A.S.', paymentTerms: null },
  { contpaqId: '858', name: 'BALA DI GALA HAND DETAIL', paymentTerms: null },
  { contpaqId: '860', name: 'INDUSTRIAS NATURAL KENZO', paymentTerms: null },
  { contpaqId: '862', name: 'MAFE DISTRIBUCIONES', paymentTerms: null },
  { contpaqId: '863', name: 'COMPAÑIA CALZATURERA', paymentTerms: null },
  { contpaqId: '865', name: 'KOMERLINE OCCIDENTE', paymentTerms: null },
  { contpaqId: '866', name: 'TEXTILES SISA', paymentTerms: null },
  { contpaqId: '867', name: 'DISTRIBUIDORA KISTINID', paymentTerms: null },
  { contpaqId: '868', name: 'FERRE ACE', paymentTerms: null },
  { contpaqId: '870', name: 'ANDRES PALMA BAEZA', paymentTerms: null },
  { contpaqId: '871', name: 'CALZADO CACHORROS', paymentTerms: null },
  { contpaqId: '873', name: 'COEL', paymentTerms: null },
  { contpaqId: '874', name: 'TIENDAS DE LIMPIEZA KEY', paymentTerms: null },
  { contpaqId: '875', name: 'ZAPATERIAS LEON DEL CENTRO', paymentTerms: null },
];

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const companyRepo = AppDataSource.getRepository(Company);
  const clientRepo = AppDataSource.getRepository(ClientRecord);

  // Obtener último displayId para continuar la secuencia
  const lastClient = await clientRepo.findOne({
    where: {},
    order: { createdAt: 'DESC' },
    withDeleted: true,
  });

  let counter = 1;
  if (lastClient?.displayId) {
    const match = lastClient.displayId.match(/CLI-(\d+)/);
    if (match?.[1]) counter = parseInt(match[1], 10) + 1;
  }

  let created = 0;
  let skipped = 0;

  for (const client of CONTPAQI_CLIENTS) {
    // Idempotente: verifica por contpaqId en ClientRecord
    const existing = await clientRepo.findOne({
      where: { contpaqId: client.contpaqId },
      withDeleted: true,
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Crear empresa
    const company = companyRepo.create({
      name: client.name,
      legalName: client.name,
    });
    const savedCompany = await companyRepo.save(company);

    // Crear cliente
    const displayId = `CLI-${String(counter).padStart(4, '0')}`;
    const clientRecord = clientRepo.create({
      displayId,
      primaryCompanyId: savedCompany.id,
      status: ClientStatus.ACTIVE,
      contpaqId: client.contpaqId,
      country: 'México',
      notes: client.paymentTerms ? `Condiciones de pago: ${client.paymentTerms}` : null,
    });
    await clientRepo.save(clientRecord);

    counter++;
    created++;
  }

  console.log(`✅ Seed completado: ${created} clientes creados, ${skipped} omitidos.`);
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
