export const CATALOG_ENTITY_NAMES = [
  'companies',
  'locations',
  'modalities',
  'divisions',
  'areas',
  'contract_schemas',
  'contract_types',
  'org_levels',
  'blood_types',
  'marital_statuses',
  'industries',
  'document_types',
  'vendor_categories',
] as const;

export type CatalogEntityName = (typeof CATALOG_ENTITY_NAMES)[number];

export function isCatalogEntityName(value: string): value is CatalogEntityName {
  return (CATALOG_ENTITY_NAMES as readonly string[]).includes(value);
}
