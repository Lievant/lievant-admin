'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ClientDetail, ClientDocumentSummary, FinancialData, UserSummary } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import {
  CLIENT_STATUS_BADGE_STYLES,
  CLIENT_STATUS_LABELS,
  clientDisplayName,
  clientTypeLabel,
} from '../constants';
import { GeneralTab } from './general-tab';
import { ContactsTab } from './contacts-tab';
import { CompaniesTab } from './companies-tab';
import { FinancialTab } from './financial-tab';
import { DocumentsTab } from './documents-tab';
import { EditClientDialog } from './edit-client-dialog';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'contacts', label: 'Contactos' },
  { id: 'companies', label: 'Empresas y marcas' },
  { id: 'financial', label: 'Financiero' },
  { id: 'documents', label: 'Documentos' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface ClientDetailScreenProps {
  client: ClientDetail;
  documents: ClientDocumentSummary[];
  financial: FinancialData | null;
  canViewFinancial: boolean;
  accountManagers: UserSummary[];
}

export function ClientDetailScreen({
  client,
  documents,
  financial,
  canViewFinancial,
  accountManagers,
}: ClientDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isEditOpen, setEditOpen] = useState(false);

  const name = clientDisplayName(client);
  const missingDocuments = documents.filter((doc) => doc.status === 'missing').length;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/finanzas" className="hover:text-terracota">
          Finanzas
        </Link>
        <span>/</span>
        <Link href="/finanzas/clientes" className="hover:text-terracota">
          Clientes
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
                {client.displayId}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-semibold',
                  CLIENT_STATUS_BADGE_STYLES[client.status],
                )}
              >
                {CLIENT_STATUS_LABELS[client.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{clientTypeLabel(client)}</p>
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
                  ? 'border-terracota text-terracota'
                  : 'border-transparent text-slate-500 hover:text-navy',
              )}
            >
              {tab.label}
              {tab.id === 'financial' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  Privado
                </span>
              )}
              {tab.id === 'documents' && missingDocuments > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  {missingDocuments}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'general' && <GeneralTab client={client} />}
        {activeTab === 'contacts' && <ContactsTab client={client} />}
        {activeTab === 'companies' && <CompaniesTab client={client} />}
        {activeTab === 'financial' && (
          <FinancialTab client={client} financial={financial} canView={canViewFinancial} />
        )}
        {activeTab === 'documents' && <DocumentsTab client={client} documents={documents} />}
      </div>

      {isEditOpen && (
        <EditClientDialog client={client} accountManagers={accountManagers} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
