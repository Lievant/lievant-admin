import type { InvoiceStatus, POStatus, ProductType, VendorStatus } from '@/lib/api';

export const VENDOR_STATUSES: VendorStatus[] = ['activo', 'inactivo'];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

export const VENDOR_STATUS_BADGE_STYLES: Record<VendorStatus, string> = {
  activo: 'bg-green-50 text-green-600',
  inactivo: 'bg-slate-100 text-slate-600',
};

export const PRODUCT_TYPES: ProductType[] = ['producto', 'servicio'];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  producto: 'Producto',
  servicio: 'Servicio',
};

export const PRODUCT_TYPE_BADGE_STYLES: Record<ProductType, string> = {
  producto: 'bg-blue-50 text-blue-600',
  servicio: 'bg-purple-50 text-purple-600',
};

export const PO_STATUSES: POStatus[] = ['borrador', 'aprobada', 'cerrada'];

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
};

export const PO_STATUS_BADGE_STYLES: Record<POStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  aprobada: 'bg-blue-50 text-blue-600',
  cerrada: 'bg-green-50 text-green-600',
};

export const INVOICE_STATUSES: InvoiceStatus[] = ['pendiente', 'pagada'];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
};

export const INVOICE_STATUS_BADGE_STYLES: Record<InvoiceStatus, string> = {
  pendiente: 'bg-amber-50 text-amber-600',
  pagada: 'bg-green-50 text-green-600',
};

export const VENDOR_DOCUMENT_TYPES = [
  'constancia_fiscal',
  'acta_constitutiva',
  'contrato',
  'identificacion',
  'otro',
] as const;

export const VENDOR_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  constancia_fiscal: 'Constancia fiscal',
  acta_constitutiva: 'Acta constitutiva',
  contrato: 'Contrato',
  identificacion: 'Identificación',
  otro: 'Otro',
};

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

export function formatCurrency(value: string | number, currency = 'MXN'): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return String(value);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
}

export function vendorDisplayName(vendor: { tradeName: string | null; name: string }): string {
  return vendor.tradeName || vendor.name;
}
