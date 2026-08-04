'use client';

import { useState, useTransition } from 'react';
import type { FinancialData, UpdateFinancialPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import {
  PAYMENT_METHODS,
  SAT_CFDI_USES,
  SAT_PAYMENT_FORMS,
  SAT_PAYMENT_METHODS,
  SAT_TAX_REGIMES,
} from '../constants';
import { updateFinancialAction } from './actions';
import { TextField } from '../form-field';

function Select({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EditFinancialDialog({
  clientId,
  financial,
  onClose,
}: {
  clientId: string;
  financial: FinancialData | null;
  onClose: () => void;
}) {
  const [paymentDays, setPaymentDays] = useState(financial?.paymentDays != null ? String(financial.paymentDays) : '');
  const [billingEmail, setBillingEmail] = useState(financial?.billingEmail ?? '');
  const [billingContact, setBillingContact] = useState(financial?.billingContact ?? '');
  const [creditLimit, setCreditLimit] = useState(financial?.creditLimit ?? '');
  const [currency, setCurrency] = useState(financial?.currency ?? 'MXN');
  const [paymentMethod, setPaymentMethod] = useState(financial?.paymentMethod ?? '');
  const [satPaymentMethod, setSatPaymentMethod] = useState(financial?.satPaymentMethod ?? '');
  const [satPaymentForm, setSatPaymentForm] = useState(financial?.satPaymentForm ?? '');
  const [satCfdiUse, setSatCfdiUse] = useState(financial?.satCfdiUse ?? '');
  const [satTaxRegime, setSatTaxRegime] = useState(financial?.satTaxRegime ?? '');
  const [bankName, setBankName] = useState(financial?.bankName ?? '');
  const [bankAccount, setBankAccount] = useState(financial?.bankAccount ?? '');
  const [bankClabe, setBankClabe] = useState(financial?.bankClabe ?? '');
  const [contractStartDate, setContractStartDate] = useState(financial?.contractStartDate ?? '');
  const [contractEndDate, setContractEndDate] = useState(financial?.contractEndDate ?? '');
  const [autoRenewal, setAutoRenewal] = useState(financial?.autoRenewal ?? false);
  const [internalNotes, setInternalNotes] = useState(financial?.internalNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload: UpdateFinancialPayload = { autoRenewal };
      if (paymentDays !== '') payload.paymentDays = Number(paymentDays);
      if (billingEmail.trim()) payload.billingEmail = billingEmail.trim();
      if (billingContact.trim()) payload.billingContact = billingContact.trim();
      if (creditLimit !== '') payload.creditLimit = Number(creditLimit);
      if (currency.trim()) payload.currency = currency.trim();
      if (paymentMethod) payload.paymentMethod = paymentMethod;
      if (satPaymentMethod) payload.satPaymentMethod = satPaymentMethod;
      if (satPaymentForm) payload.satPaymentForm = satPaymentForm;
      if (satCfdiUse) payload.satCfdiUse = satCfdiUse;
      if (satTaxRegime) payload.satTaxRegime = satTaxRegime;
      if (bankName.trim()) payload.bankName = bankName.trim();
      if (bankAccount.trim()) payload.bankAccount = bankAccount.trim();
      if (bankClabe.trim()) payload.bankClabe = bankClabe.trim();
      if (contractStartDate) payload.contractStartDate = contractStartDate;
      if (contractEndDate) payload.contractEndDate = contractEndDate;
      if (internalNotes.trim()) payload.internalNotes = internalNotes.trim();

      const result = await updateFinancialAction(clientId, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar la información financiera.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar datos financieros</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-4">
            <TextField
              id="financial-payment-days"
              label="Días de pago"
              type="number"
              value={paymentDays}
              onChange={setPaymentDays}
              placeholder="30"
            />
            <TextField
              id="financial-credit-limit"
              label="Límite de crédito"
              type="number"
              value={creditLimit}
              onChange={setCreditLimit}
              placeholder="100000"
            />
            <TextField id="financial-currency" label="Moneda" value={currency} onChange={setCurrency} placeholder="MXN" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="financial-billing-email"
              label="Email de facturación"
              type="email"
              value={billingEmail}
              onChange={setBillingEmail}
              placeholder="facturacion@cliente.com"
            />
            <TextField
              id="financial-billing-contact"
              label="Contacto de facturación"
              value={billingContact}
              onChange={setBillingContact}
              placeholder="Nombre del contacto"
            />
          </div>

          <Select
            id="financial-payment-method"
            label="Método de pago"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={PAYMENT_METHODS}
            placeholder="Sin definir"
          />

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos fiscales (SAT)</p>
            <div className="grid grid-cols-2 gap-4">
              <Select
                id="financial-sat-tax-regime"
                label="Régimen fiscal"
                value={satTaxRegime}
                onChange={setSatTaxRegime}
                options={SAT_TAX_REGIMES}
                placeholder="Sin definir"
              />
              <Select
                id="financial-sat-cfdi-use"
                label="Uso de CFDI"
                value={satCfdiUse}
                onChange={setSatCfdiUse}
                options={SAT_CFDI_USES}
                placeholder="Sin definir"
              />
              <Select
                id="financial-sat-payment-method"
                label="Método de pago SAT"
                value={satPaymentMethod}
                onChange={setSatPaymentMethod}
                options={SAT_PAYMENT_METHODS}
                placeholder="Sin definir"
              />
              <Select
                id="financial-sat-payment-form"
                label="Forma de pago SAT"
                value={satPaymentForm}
                onChange={setSatPaymentForm}
                options={SAT_PAYMENT_FORMS}
                placeholder="Sin definir"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos bancarios</p>
            <div className="grid grid-cols-3 gap-4">
              <TextField id="financial-bank-name" label="Banco" value={bankName} onChange={setBankName} placeholder="BBVA" />
              <TextField id="financial-bank-account" label="Cuenta" value={bankAccount} onChange={setBankAccount} mono />
              <TextField id="financial-bank-clabe" label="CLABE" value={bankClabe} onChange={setBankClabe} mono />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contrato</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="financial-contract-start"
                label="Inicio de contrato"
                type="date"
                value={contractStartDate}
                onChange={setContractStartDate}
              />
              <TextField
                id="financial-contract-end"
                label="Fin de contrato"
                type="date"
                value={contractEndDate}
                onChange={setContractEndDate}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={autoRenewal}
                onChange={(e) => setAutoRenewal(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              Renovación automática
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="financial-internal-notes">
              Notas internas
            </label>
            <textarea
              id="financial-internal-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
