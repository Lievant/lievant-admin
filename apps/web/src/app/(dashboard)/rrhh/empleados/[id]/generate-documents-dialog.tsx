'use client';

import { useMemo, useState, useTransition } from 'react';
import { CloseIcon } from '@/components/icons';
import { TextField } from '../form-field';
import { generateEmployeeDocumentAction } from './actions';

type ContractDocType = 'contrato_determinado' | 'contrato_indeterminado' | 'convenio_practicas';

const CONTRACT_OPTIONS: { value: ContractDocType; label: string }[] = [
  { value: 'contrato_determinado', label: 'Contrato por tiempo determinado' },
  { value: 'contrato_indeterminado', label: 'Contrato por tiempo indeterminado' },
  { value: 'convenio_practicas', label: 'Convenio de prácticas profesionales' },
];

function inferContractType(contractType: string | null | undefined): ContractDocType {
  const normalized = (contractType ?? '').toLowerCase();
  if (normalized.includes('indetermin')) return 'contrato_indeterminado';
  if (normalized.includes('práctica') || normalized.includes('practica')) return 'convenio_practicas';
  return 'contrato_determinado';
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function base64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface GenerateDocumentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  contractType?: string | null;
}

export function GenerateDocumentsDialog({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  contractType,
}: GenerateDocumentsDialogProps) {
  const [selectedContract, setSelectedContract] = useState<ContractDocType>(() => inferContractType(contractType));
  const [includeConfidencialidad, setIncludeConfidencialidad] = useState(true);
  const [includeNoCompetencia, setIncludeNoCompetencia] = useState(true);
  const [universidad, setUniversidad] = useState('');
  const [carrera, setCarrera] = useState('');
  const [matricula, setMatricula] = useState('');
  const [duracionMeses, setDuracionMeses] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const employeeSlug = useMemo(() => slugify(employeeName), [employeeName]);

  if (!isOpen) {
    return null;
  }

  const isPracticas = selectedContract === 'convenio_practicas';
  const selectedCount = 1 + (includeConfidencialidad ? 1 : 0) + (includeNoCompetencia ? 1 : 0);
  const isGenerateDisabled = isPending || selectedCount === 0;

  const handleGenerate = () => {
    setError(null);
    setSuccess(null);

    if (selectedCount === 0) {
      return;
    }

    if (isPracticas) {
      if (!universidad.trim() || !carrera.trim() || !matricula.trim() || !duracionMeses.trim()) {
        setError('Universidad, carrera, matrícula y duración en meses son obligatorios para convenio de prácticas.');
        return;
      }
    }

    const extraParams: Record<string, string> | undefined = isPracticas
      ? {
          UNIVERSIDAD: universidad.trim(),
          CARRERA: carrera.trim(),
          MATRICULA: matricula.trim(),
          DURACION_MESES: duracionMeses.trim(),
        }
      : undefined;

    startTransition(async () => {
      const documentsToGenerate: { docType: ContractDocType | 'confidencialidad' | 'no_competencia'; filename: string }[] =
        [{ docType: selectedContract, filename: `contrato_${selectedContract.replace('contrato_', '')}_${employeeSlug}.docx` }];

      if (includeConfidencialidad) {
        documentsToGenerate.push({ docType: 'confidencialidad', filename: `confidencialidad_${employeeSlug}.docx` });
      }
      if (includeNoCompetencia) {
        documentsToGenerate.push({ docType: 'no_competencia', filename: `no_competencia_${employeeSlug}.docx` });
      }

      const results = await Promise.all(
        documentsToGenerate.map(async ({ docType, filename }) => ({
          filename,
          result: await generateEmployeeDocumentAction(
            employeeId,
            docType,
            docType === selectedContract ? extraParams : undefined,
          ),
        })),
      );

      const failed = results.find((r) => !r.result.success);
      if (failed) {
        setError(failed.result.error ?? 'No se pudo generar uno de los documentos.');
        return;
      }

      for (const { result, filename } of results) {
        if (result.base64) {
          downloadBlob(base64ToBlob(result.base64), filename);
        }
      }

      setSuccess(`${results.length} documento${results.length === 1 ? '' : 's'} generado${results.length === 1 ? '' : 's'} y descargado${results.length === 1 ? '' : 's'}.`);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Generar documentos</h2>
            <p className="mt-1 text-sm text-slate-500">Selecciona el tipo de contrato y los documentos a generar</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo de contrato</p>
            <div className="space-y-2">
              {CONTRACT_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="radio"
                    name="contract-doc-type"
                    value={option.value}
                    checked={selectedContract === option.value}
                    onChange={() => setSelectedContract(option.value)}
                    className="h-4 w-4 text-terracota focus:ring-terracota"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {isPracticas && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Datos del convenio de prácticas
              </p>
              <div className="grid grid-cols-2 gap-4">
                <TextField id="doc-universidad" label="Universidad*" value={universidad} onChange={setUniversidad} />
                <TextField id="doc-carrera" label="Carrera / Programa*" value={carrera} onChange={setCarrera} />
                <TextField id="doc-matricula" label="Matrícula*" value={matricula} onChange={setMatricula} />
                <TextField
                  id="doc-duracion"
                  label="Duración en meses*"
                  type="number"
                  value={duracionMeses}
                  onChange={setDuracionMeses}
                />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Documentos adicionales
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={includeConfidencialidad}
                  onChange={(e) => setIncludeConfidencialidad(e.target.checked)}
                  className="h-4 w-4 text-terracota focus:ring-terracota"
                />
                Convenio de confidencialidad
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={includeNoCompetencia}
                  onChange={(e) => setIncludeNoCompetencia(e.target.checked)}
                  className="h-4 w-4 text-terracota focus:ring-terracota"
                />
                Convenio de no competencia
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Generando documentos…' : 'Generar y descargar documentos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
