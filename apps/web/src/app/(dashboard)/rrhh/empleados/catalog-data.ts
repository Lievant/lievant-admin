import { listActiveCatalogItems, type CatalogEntity, type CatalogItem } from '@/lib/api';

async function safeList(entity: CatalogEntity): Promise<CatalogItem[]> {
  try {
    return await listActiveCatalogItems(entity);
  } catch {
    return [];
  }
}

export interface EmployeeFormCatalogs {
  companies: CatalogItem[];
  divisions: CatalogItem[];
  locations: CatalogItem[];
  modalities: CatalogItem[];
  contractSchemas: CatalogItem[];
  contractTypes: CatalogItem[];
  orgLevels: CatalogItem[];
  bloodTypes: CatalogItem[];
  maritalStatuses: CatalogItem[];
}

export async function loadEmployeeFormCatalogs(): Promise<EmployeeFormCatalogs> {
  const [companies, divisions, locations, modalities, contractSchemas, contractTypes, orgLevels, bloodTypes, maritalStatuses] =
    await Promise.all([
      safeList('companies'),
      safeList('divisions'),
      safeList('locations'),
      safeList('modalities'),
      safeList('contract_schemas'),
      safeList('contract_types'),
      safeList('org_levels'),
      safeList('blood_types'),
      safeList('marital_statuses'),
    ]);

  return { companies, divisions, locations, modalities, contractSchemas, contractTypes, orgLevels, bloodTypes, maritalStatuses };
}

export interface EmployeeFilterCatalogs {
  companies: CatalogItem[];
  divisions: CatalogItem[];
  locations: CatalogItem[];
}

export async function loadEmployeeFilterCatalogs(): Promise<EmployeeFilterCatalogs> {
  const [companies, divisions, locations] = await Promise.all([
    safeList('companies'),
    safeList('divisions'),
    safeList('locations'),
  ]);

  return { companies, divisions, locations };
}
