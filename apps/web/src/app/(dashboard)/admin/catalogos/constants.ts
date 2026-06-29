import type { SVGProps } from 'react';
import type { CatalogEntity } from '@/lib/api';
import {
  BuildingIcon,
  ContractIcon,
  DropletIcon,
  FactoryIcon,
  FileTextIcon,
  HeartIcon,
  LaptopIcon,
  LayersIcon,
  LevelsIcon,
  MapPinIcon,
  SitemapIcon,
} from '@/components/icons';

export interface CatalogFieldDef {
  key: 'code' | 'country' | 'companyCode' | 'divisionName' | 'appliesTo' | 'isRequired' | 'description' | 'email' | 'role';
  label: string;
  type: 'text' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  mono?: boolean;
  placeholder?: string;
  required?: boolean;
}

export interface CatalogConfig {
  entity: CatalogEntity;
  label: string;
  itemLabel: string;
  icon: ((props: SVGProps<SVGSVGElement>) => React.ReactElement) | string;
  filter?: Record<string, string>;
  fields: CatalogFieldDef[];
}

export const CATALOG_CONFIGS: CatalogConfig[] = [
  {
    entity: 'companies',
    label: 'Empresas',
    itemLabel: 'empresa',
    icon: BuildingIcon,
    fields: [{ key: 'code', label: 'Código', type: 'text', mono: true, placeholder: 'LIEVANT', required: true }],
  },
  {
    entity: 'locations',
    label: 'Ubicaciones',
    itemLabel: 'ubicación',
    icon: MapPinIcon,
    fields: [{ key: 'country', label: 'País', type: 'text', placeholder: 'México' }],
  },
  {
    entity: 'modalities',
    label: 'Modalidades',
    itemLabel: 'modalidad',
    icon: LaptopIcon,
    fields: [],
  },
  {
    entity: 'divisions',
    label: 'Divisiones',
    itemLabel: 'división',
    icon: SitemapIcon,
    fields: [{ key: 'companyCode', label: 'Código de empresa', type: 'text', mono: true, placeholder: 'LIEVANT' }],
  },
  {
    entity: 'areas',
    label: 'Áreas',
    itemLabel: 'área',
    icon: LayersIcon,
    fields: [
      { key: 'divisionName', label: 'División', type: 'text', placeholder: 'Operaciones' },
      { key: 'companyCode', label: 'Código de empresa', type: 'text', mono: true, placeholder: 'LIEVANT' },
    ],
  },
  {
    entity: 'contract_schemas',
    label: 'Esquemas de contrato',
    itemLabel: 'esquema de contrato',
    icon: ContractIcon,
    fields: [],
  },
  {
    entity: 'contract_types',
    label: 'Tipos de contrato',
    itemLabel: 'tipo de contrato',
    icon: FileTextIcon,
    fields: [],
  },
  {
    entity: 'org_levels',
    label: 'Niveles organizacionales',
    itemLabel: 'nivel organizacional',
    icon: LevelsIcon,
    fields: [{ key: 'code', label: 'Código', type: 'text', mono: true, placeholder: 'I', required: true }],
  },
  {
    entity: 'blood_types',
    label: 'Tipos de sangre',
    itemLabel: 'tipo de sangre',
    icon: DropletIcon,
    fields: [],
  },
  {
    entity: 'marital_statuses',
    label: 'Estado civil',
    itemLabel: 'estado civil',
    icon: HeartIcon,
    fields: [],
  },
  {
    entity: 'industries',
    label: 'Industrias',
    itemLabel: 'industria',
    icon: FactoryIcon,
    fields: [],
  },
  {
    entity: 'document_types_client',
    label: 'Tipos de documento — Clientes',
    itemLabel: 'tipo de documento',
    icon: 'ti-file-text',
    filter: { appliesTo: 'client' },
    fields: [
      { key: 'description', label: 'Descripción', type: 'text' },
      { key: 'isRequired', label: 'Obligatorio', type: 'checkbox' },
    ],
  },
  {
    entity: 'document_types_vendor',
    label: 'Tipos de documento — Proveedores',
    itemLabel: 'tipo de documento',
    icon: 'ti-file-invoice',
    filter: { appliesTo: 'vendor' },
    fields: [
      { key: 'description', label: 'Descripción', type: 'text' },
      { key: 'isRequired', label: 'Obligatorio', type: 'checkbox' },
    ],
  },
  {
    entity: 'document_types_employee',
    label: 'Tipos de documento — Empleados',
    itemLabel: 'tipo de documento',
    icon: 'ti-folder',
    filter: { appliesTo: 'employee' },
    fields: [
      { key: 'description', label: 'Descripción', type: 'text' },
      { key: 'isRequired', label: 'Obligatorio', type: 'checkbox' },
    ],
  },
  {
    entity: 'ticket_assignees',
    label: 'Técnicos de soporte TI',
    itemLabel: 'técnico',
    icon: 'ti-headset',
    fields: [
      { key: 'email', label: 'Correo electrónico', type: 'text', placeholder: 'tecnico@lievant.com' },
      { key: 'role', label: 'Rol', type: 'text', placeholder: 'Técnico TI' },
    ],
  },
];

export function getCatalogConfig(entity: string): CatalogConfig | undefined {
  return CATALOG_CONFIGS.find((config) => config.entity === entity);
}
