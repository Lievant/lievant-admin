'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ClientDetail } from '@/lib/api';
import { PlusIcon } from '@/components/icons';
import { AddCompanyDialog } from './add-company-dialog';
import { AddBrandDialog } from './add-brand-dialog';

export function CompaniesTab({ client }: { client: ClientDetail }) {
  const [isAddCompanyOpen, setAddCompanyOpen] = useState(false);
  const [brandCompanyId, setBrandCompanyId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddCompanyOpen(true)}
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar empresa
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {client.companies.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm md:col-span-2">
            Este cliente no tiene empresas registradas.
          </div>
        )}
        {client.companies.map((company) => {
          const brands = client.brands.filter((brand) => brand.companyId === company.id);
          const isPrimary = company.id === client.primaryCompanyId;

          return (
            <div key={company.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-navy">{company.name}</p>
                    {isPrimary && (
                      <span className="rounded-full bg-terracota/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-terracota-dark">
                        Principal
                      </span>
                    )}
                  </div>
                  {company.legalName && <p className="mt-0.5 text-xs text-slate-400">{company.legalName}</p>}
                  {company.rfc && <p className="mt-1 font-mono text-xs text-slate-500">{company.rfc}</p>}
                  {company.industry && <p className="mt-1 text-xs text-slate-400">{company.industry}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setBrandCompanyId(company.id)}
                  className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                >
                  + Marca
                </button>
              </div>

              {brands.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {brands.map((brand) => (
                    <span key={brand.id} className={cn('rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600')}>
                      {brand.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">Sin marcas registradas.</p>
              )}
            </div>
          );
        })}
      </div>

      {isAddCompanyOpen && <AddCompanyDialog clientId={client.id} onClose={() => setAddCompanyOpen(false)} />}
      {brandCompanyId && (
        <AddBrandDialog clientId={client.id} companyId={brandCompanyId} onClose={() => setBrandCompanyId(null)} />
      )}
    </div>
  );
}
