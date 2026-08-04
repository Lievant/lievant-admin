'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CatalogItem, VendorDetail, VendorDocument, VendorStatement } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { VENDOR_STATUS_BADGE_STYLES, VENDOR_STATUS_LABELS, vendorDisplayName } from '../constants';
import { GeneralTab } from './general-tab';
import { ProductsTab } from './products-tab';
import { PurchaseOrdersTab } from './purchase-orders-tab';
import { StatementTab } from './statement-tab';
import { DocumentsTab } from './documents-tab';
import { EditVendorDialog } from './edit-vendor-dialog';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'products', label: 'Productos/Servicios' },
  { id: 'purchase-orders', label: 'Órdenes de compra' },
  { id: 'statement', label: 'Estado de cuenta' },
  { id: 'documents', label: 'Documentos' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface VendorDetailScreenProps {
  vendor: VendorDetail;
  categories: CatalogItem[];
  canViewBankDetails: boolean;
  documents: VendorDocument[];
  statement: VendorStatement;
}

export function VendorDetailScreen({
  vendor,
  categories,
  canViewBankDetails,
  documents,
  statement,
}: VendorDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isEditOpen, setEditOpen] = useState(false);

  const name = vendorDisplayName(vendor);
  const category = categories.find((c) => c.id === vendor.categoryId);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/finanzas" className="hover:text-black">
          Finanzas
        </Link>
        <span>/</span>
        <Link href="/finanzas/proveedores" className="hover:text-black">
          Proveedores
        </Link>
        <span>/</span>
        <span className="text-slate-600">{name}</span>
      </nav>

      {/* Header */}
      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: avatarColor(name) }}
          >
            {initials(name)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-navy">{name}</h1>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                VND-{vendor.id.slice(0, 8).toUpperCase()}
              </span>
              {category && (
                <span className="rounded-full bg-black/10 px-2 py-1 text-xs font-semibold text-black">
                  {category.name}
                </span>
              )}
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-semibold',
                  VENDOR_STATUS_BADGE_STYLES[vendor.status],
                )}
              >
                {VENDOR_STATUS_LABELS[vendor.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">RFC {vendor.rfc}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          Editar
        </button>
      </header>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-black text-black'
                  : 'border-transparent text-slate-500 hover:text-navy',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'general' && (
          <GeneralTab vendor={vendor} category={category} canViewBankDetails={canViewBankDetails} />
        )}
        {activeTab === 'products' && <ProductsTab vendor={vendor} />}
        {activeTab === 'purchase-orders' && <PurchaseOrdersTab vendor={vendor} />}
        {activeTab === 'statement' && <StatementTab vendor={vendor} statement={statement} />}
        {activeTab === 'documents' && <DocumentsTab vendor={vendor} documents={documents} />}
      </div>

      {isEditOpen && (
        <EditVendorDialog vendor={vendor} categories={categories} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
