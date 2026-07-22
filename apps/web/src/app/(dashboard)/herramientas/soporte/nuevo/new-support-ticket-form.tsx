'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { HelpdeskCategorySummary, HelpdeskSubcategorySummary, MyEquipmentItem, TicketImpact } from '@/lib/api';

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  equipos: 'Ej: Mi laptop no enciende / pantalla parpadea / teclado sin respuesta…',
  software: 'Ej: No puedo abrir Excel / la aplicación muestra error al iniciar…',
  conectividad: 'Ej: Sin acceso a internet desde mi equipo / VPN no conecta…',
  accesos: 'Ej: Olvidé mi contraseña de Windows / no puedo entrar al sistema…',
  correo: 'Ej: No recibo correos / mi cuenta de Outlook no sincroniza…',
  infraestructura: 'Ej: El servidor de archivos está lento / el dominio no responde…',
  seguridad: 'Ej: Recibí un correo de phishing / sospecho acceso no autorizado…',
};

interface FormState {
  equipmentId: string;
  category: string;
  subcategory: string;
  description: string;
  impact: TicketImpact;
  attachment: File | null;
}

type SubmitResult = { displayId: string; id: string } | null;

interface Props {
  categories: HelpdeskCategorySummary[];
}

export function NewSupportTicketForm({ categories }: Props) {
  const [form, setForm] = useState<FormState>({
    equipmentId: '',
    category: '',
    subcategory: '',
    description: '',
    impact: 'medio',
    attachment: null,
  });
  const [myEquipment, setMyEquipment] = useState<MyEquipmentItem[]>([]);
  const [subcategories, setSubcategories] = useState<HelpdeskSubcategorySummary[]>([]);
  const [uploadStep, setUploadStep] = useState<'idle' | 'creating' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loading = uploadStep !== 'idle';

  useEffect(() => {
    fetch('/api/inventory/equipment/my')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MyEquipmentItem[]) => setMyEquipment(data))
      .catch(() => {});
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCategoryChange(slug: string) {
    set('category', slug);
    set('subcategory', '');
    setSubcategories([]);
    if (!slug) return;
    try {
      const res = await fetch(`/api/helpdesk/categories/${slug}/subcategories`);
      if (res.ok) setSubcategories((await res.json()) as HelpdeskSubcategorySummary[]);
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) { setError('Selecciona una categoría.'); return; }
    if (form.description.trim().length < 20) {
      setError('La descripción debe tener al menos 20 caracteres.');
      return;
    }
    setError(null);

    try {
      // Paso 1: crear ticket (JSON)
      setUploadStep('creating');
      let equipmentLabel: string | undefined;
      if (form.equipmentId) {
        const eq = myEquipment.find((e) => e.id === form.equipmentId);
        if (eq) {
          const parts = [eq.equipmentType, eq.brand, eq.model].filter(Boolean).join(' ');
          const label = eq.displayId ? `${parts} — ${eq.displayId}` : parts;
          equipmentLabel = label.slice(0, 50);
        }
      }

      const payload = {
        category: form.category,
        subcategory: form.subcategory || undefined,
        equipmentId: equipmentLabel,
        description: form.description.trim(),
        impact: form.impact,
      };

      const res = await fetch('/api/helpdesk/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? `Error ${res.status}`);
      }

      const ticket = (await res.json()) as { displayId: string; id: string };

      // Paso 2: subir adjunto si existe
      if (form.attachment) {
        setUploadStep('uploading');
        const fd = new FormData();
        fd.append('file', form.attachment);
        const uploadRes = await fetch(`/api/helpdesk/tickets/${ticket.id}/attachments`, {
          method: 'POST',
          body: fd,
        });
        if (!uploadRes.ok) {
          // Ticket creado pero adjunto falló — informar sin bloquear
          const uploadBody = (await uploadRes.json()) as { message?: string };
          throw new Error(`Ticket creado (${ticket.displayId}) pero el adjunto falló: ${uploadBody.message ?? uploadRes.status}`);
        }
      }

      setResult(ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el ticket. Intenta de nuevo.');
    } finally {
      setUploadStep('idle');
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-navy">¡Ticket creado!</h2>
        <p className="mt-2 text-slate-600">
          Tu ticket <span className="font-mono font-semibold text-terracota">{result.displayId}</span> fue registrado.
          El equipo de TI lo atenderá pronto.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/herramientas/soporte"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver mis tickets
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setForm({ equipmentId: '', category: '', subcategory: '', description: '', impact: 'medio', attachment: null });
              setSubcategories([]);
              if (fileRef.current) fileRef.current.value = '';
            }}
            className="rounded-lg bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota/90"
          >
            Crear otro ticket
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

      {/* 1. Equipo */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">
          ¿Tienes problemas con un equipo específico? <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <select
          value={form.equipmentId}
          onChange={(e) => set('equipmentId', e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-terracota focus:outline-none"
        >
          <option value="">No aplica / no sé cuál es</option>
          {myEquipment.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {[eq.equipmentType, eq.brand, eq.model].filter(Boolean).join(' ')}
              {eq.legacyId ? ` — ${eq.legacyId}` : ''}
            </option>
          ))}
        </select>
        {myEquipment.length === 0 && (
          <p className="mt-1 text-xs text-slate-400">No hay equipos asignados a tu cuenta.</p>
        )}
      </div>

      {/* 2. Categoría */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">
          Categoría <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={form.category}
          onChange={(e) => void onCategoryChange(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-terracota focus:outline-none"
        >
          <option value="">Selecciona una categoría…</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 3. Subcategoría */}
      {subcategories.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy">Subcategoría</label>
          <select
            value={form.subcategory}
            onChange={(e) => set('subcategory', e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-terracota focus:outline-none"
          >
            <option value="">Elige una subcategoría…</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Descripción */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">
          Descripción del problema <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={5}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={
            form.category && CATEGORY_PLACEHOLDERS[form.category]
              ? CATEGORY_PLACEHOLDERS[form.category]
              : 'Describe con detalle qué está ocurriendo, desde cuándo y qué has intentado…'
          }
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed focus:border-terracota focus:outline-none"
        />
        <p className={`mt-1 text-xs ${form.description.length > 0 && form.description.length < 20 ? 'text-red-500' : 'text-slate-400'}`}>
          Mínimo 20 caracteres ({form.description.length})
        </p>
      </div>

      {/* 5. Impacto */}
      <div>
        <label className="mb-2 block text-sm font-medium text-navy">
          Impacto en mi trabajo <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          {(['alto', 'medio', 'bajo'] as TicketImpact[]).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="impact"
                value={v}
                checked={form.impact === v}
                onChange={() => set('impact', v)}
                className="accent-terracota"
              />
              <span className="capitalize text-sm text-slate-700">{v}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 6. Adjunto */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">
          Adjunto <span className="font-normal text-slate-400">(opcional · JPG, PNG, PDF · máx 10 MB)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => set('attachment', e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {form.attachment && form.attachment.size > 10 * 1024 * 1024 && (
          <p className="mt-1 text-xs text-red-500">El archivo supera 10 MB.</p>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <Link
          href="/herramientas/soporte"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-terracota px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-terracota/90 disabled:opacity-60"
        >
          {uploadStep === 'creating'
          ? 'Creando ticket…'
          : uploadStep === 'uploading'
            ? 'Subiendo adjunto…'
            : 'Enviar ticket'}
        </button>
      </div>
    </form>
  );
}
