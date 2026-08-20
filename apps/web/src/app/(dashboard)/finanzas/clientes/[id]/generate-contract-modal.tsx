'use client';

import { useEffect, useState } from 'react';
import { CloseIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { formatearMonto, montoALetras } from '@/lib/numero-a-letras';

/**
 * Generación de contratos de cliente a partir de las plantillas SGSI.
 *
 * Las plantillas no tienen marcadores nombrados: llevan `[●]` anónimo y el
 * backend los rellena por posición. Por eso este formulario no envía un mapa
 * libre de campos, sino exactamente las claves que el mapeo del backend espera.
 */

type ContractType = 'com-re-02' | 'com-re-04' | 'fin-re-02-moral' | 'fin-re-03-fisica';

const TIPOS: Array<{ id: ContractType; codigo: string; titulo: string; persona: string }> = [
  { id: 'com-re-02', codigo: 'COM-RE-02', titulo: 'Convenio de Confidencialidad', persona: 'Persona Moral' },
  { id: 'com-re-04', codigo: 'COM-RE-04', titulo: 'Convenio de Confidencialidad', persona: 'Persona Física' },
  { id: 'fin-re-02-moral', codigo: 'FIN-RE-02', titulo: 'Contrato de Servicios', persona: 'Persona Moral' },
  { id: 'fin-re-03-fisica', codigo: 'FIN-RE-03', titulo: 'Contrato de Servicios', persona: 'Persona Física' },
];

const esServicios = (t: ContractType) => t === 'fin-re-02-moral' || t === 'fin-re-03-fisica';
const esMoral = (t: ContractType) => t === 'com-re-02' || t === 'fin-re-02-moral';

interface Prefill {
  razonSocial: string | null;
  nombreComercial: string | null;
  rfc: string | null;
  ciudad: string | null;
  domicilio: string | null;
}

interface ServicioFila {
  key: string;
  nombre: string;
  fechaInicio: string;
  monto: string;
  montoLetras: string;
}

let seq = 0;
const nuevaFila = (): ServicioFila => ({
  key: `s${++seq}`,
  nombre: '',
  fechaInicio: '',
  monto: '',
  montoLetras: '',
});

const inputClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

function Campo({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={readOnly ? `${inputClass} bg-slate-50 text-slate-500` : inputClass}
      />
    </div>
  );
}

export function GenerateContractModal({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<ContractType | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  // Identidad
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [representanteLegal, setRepresentanteLegal] = useState('');
  const [rfc, setRfc] = useState('');

  // Domicilio
  const [domicilio, setDomicilio] = useState('');
  const [calle, setCalle] = useState('');
  const [numeroExterior, setNumeroExterior] = useState('');
  const [colonia, setColonia] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [ciudad, setCiudad] = useState('');

  // Fechas
  const [fechaContrato, setFechaContrato] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaFirma, setFechaFirma] = useState('');

  // Escritura constitutiva
  const [escrituraNumero, setEscrituraNumero] = useState('');
  const [escrituraFecha, setEscrituraFecha] = useState('');
  const [notarioNumero, setNotarioNumero] = useState('');
  const [notarioNombre, setNotarioNombre] = useState('');
  const [ciudadNotario, setCiudadNotario] = useState('');
  const [folioMercantil, setFolioMercantil] = useState('');
  const [ciudadRegistro, setCiudadRegistro] = useState('');
  const [estadoRegistro, setEstadoRegistro] = useState('');

  // Poder del representante
  const [poderEnEscritura, setPoderEnEscritura] = useState(false);
  const [poderEscrituraNumero, setPoderEscrituraNumero] = useState('');
  const [poderEscrituraFecha, setPoderEscrituraFecha] = useState('');
  const [poderNotarioNumero, setPoderNotarioNumero] = useState('');
  const [poderNotarioNombre, setPoderNotarioNombre] = useState('');
  const [poderCiudadNotario, setPoderCiudadNotario] = useState('');

  // Servicios y montos
  const [servicioObjeto, setServicioObjeto] = useState('');
  const [canal1, setCanal1] = useState('');
  const [canal2, setCanal2] = useState('');
  const [duracionMeses, setDuracionMeses] = useState('');
  const [mesesServicio, setMesesServicio] = useState('');
  const [numeroPagos, setNumeroPagos] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [pagoMensual, setPagoMensual] = useState('');
  const [servicios, setServicios] = useState<ServicioFila[]>([nuevaFila()]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/contracts/prefill`)
      .then((r) => (r.ok ? (r.json() as Promise<Prefill>) : null))
      .then((p) => {
        if (!p) return;
        setPrefill(p);
        setRazonSocial(p.razonSocial ?? '');
        setNombreCliente(p.nombreComercial ?? '');
        setRfc(p.rfc ?? '');
        setCiudad(p.ciudad ?? '');
        setDomicilio(p.domicilio ?? '');
      })
      .catch(() => {});
  }, [clientId]);

  function patchFila(key: string, patch: Partial<ServicioFila>) {
    setServicios((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  async function generar() {
    if (!tipo) return;
    if (!fechaContrato) {
      setError('La fecha del contrato es obligatoria.');
      return;
    }

    setError(null);
    setGenerando(true);

    const cuerpo: Record<string, unknown> = {
      contractType: tipo,
      fechaContrato,
      rfc: rfc.trim() || undefined,
      domicilio: domicilio.trim() || undefined,
      ciudad: ciudad.trim() || undefined,
    };

    if (esMoral(tipo)) {
      cuerpo.razonSocial = razonSocial.trim() || undefined;
      cuerpo.representanteLegal = representanteLegal.trim() || undefined;
    } else {
      cuerpo.nombreCliente = nombreCliente.trim() || undefined;
    }

    if (tipo === 'fin-re-02-moral') {
      Object.assign(cuerpo, {
        escrituraNumero: escrituraNumero.trim() || undefined,
        escrituraFecha: escrituraFecha.trim() || undefined,
        notarioNumero: notarioNumero.trim() || undefined,
        notarioNombre: notarioNombre.trim() || undefined,
        ciudadNotario: ciudadNotario.trim() || undefined,
        folioMercantil: folioMercantil.trim() || undefined,
        ciudadRegistro: ciudadRegistro.trim() || undefined,
        estadoRegistro: estadoRegistro.trim() || undefined,
        poderEnEscrituraConstitutiva: poderEnEscritura,
        ...(poderEnEscritura
          ? {}
          : {
              poderEscrituraNumero: poderEscrituraNumero.trim() || undefined,
              poderEscrituraFecha: poderEscrituraFecha.trim() || undefined,
              poderNotarioNumero: poderNotarioNumero.trim() || undefined,
              poderNotarioNombre: poderNotarioNombre.trim() || undefined,
              poderCiudadNotario: poderCiudadNotario.trim() || undefined,
            }),
      });
    }

    if (esServicios(tipo)) {
      Object.assign(cuerpo, {
        calle: calle.trim() || undefined,
        numeroExterior: numeroExterior.trim() || undefined,
        colonia: colonia.trim() || undefined,
        codigoPostal: codigoPostal.trim() || undefined,
        servicioObjeto: servicioObjeto.trim() || undefined,
        canal1: canal1.trim() || undefined,
        canal2: canal2.trim() || undefined,
        duracionMeses: duracionMeses ? Number(duracionMeses) : undefined,
        mesesServicio: mesesServicio ? Number(mesesServicio) : undefined,
        numeroPagos: numeroPagos ? Number(numeroPagos) : undefined,
        montoTotal: montoTotal ? formatearMonto(montoTotal) : undefined,
        montoTotalLetras: montoTotal ? montoALetras(montoTotal) : undefined,
        pagoMensual: pagoMensual ? formatearMonto(pagoMensual) : undefined,
        pagoMensualLetras: pagoMensual ? montoALetras(pagoMensual) : undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        fechaFirma: fechaFirma || undefined,
        servicios: servicios
          .filter((f) => f.nombre.trim())
          .map((f) => ({
            nombre: f.nombre.trim(),
            fechaInicio: f.fechaInicio || undefined,
            monto: f.monto ? formatearMonto(f.monto) : undefined,
            montoLetras: f.montoLetras.trim() || (f.monto ? montoALetras(f.monto) : undefined),
          })),
      });
    }

    try {
      const res = await fetch(`/api/clients/${clientId}/contracts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        setError(msg ?? 'No se pudo generar el contrato.');
        return;
      }

      // Descarga con el nombre que definió el backend.
      const disposition = res.headers.get('content-disposition') ?? '';
      const nombre =
        /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? `contrato-${fechaContrato}.docx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('No se pudo generar el contrato.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 px-4 py-8">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">
            Generar contrato {paso === 2 && tipo ? `· ${TIPOS.find((t) => t.id === tipo)?.codigo}` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {paso === 1 && (
          <div className="space-y-3 px-6 py-5">
            <p className="text-sm text-slate-600">Selecciona el tipo de contrato a generar.</p>
            <div className="grid grid-cols-2 gap-3">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTipo(t.id);
                    setPaso(2);
                  }}
                  className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 p-4 text-left hover:border-black hover:bg-slate-50"
                >
                  <span className="font-mono text-xs font-semibold text-slate-500">{t.codigo}</span>
                  <span className="font-semibold text-navy">{t.titulo}</span>
                  <span className="text-xs text-slate-500">{t.persona}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 2 && tipo && (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Datos del cliente {prefill ? '(pre-llenados de la base)' : ''}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {esMoral(tipo) ? (
                  <>
                    <Campo label="Razón social" value={razonSocial} onChange={setRazonSocial} />
                    <Campo
                      label="Representante legal"
                      value={representanteLegal}
                      onChange={setRepresentanteLegal}
                    />
                  </>
                ) : (
                  <Campo label="Nombre completo" value={nombreCliente} onChange={setNombreCliente} />
                )}
                <Campo label="RFC" value={rfc} onChange={setRfc} />
                <Campo label="Ciudad" value={ciudad} onChange={setCiudad} />
                <Campo label="Domicilio" value={domicilio} onChange={setDomicilio} />
                <Campo
                  label="Fecha del contrato"
                  type="date"
                  value={fechaContrato}
                  onChange={setFechaContrato}
                />
              </div>
            </section>

            {tipo === 'fin-re-02-moral' && (
              <section className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Escritura constitutiva y registro
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <Campo label="Escritura Nº" value={escrituraNumero} onChange={setEscrituraNumero} />
                  <Campo label="Fecha escritura" value={escrituraFecha} onChange={setEscrituraFecha} />
                  <Campo label="Notario Nº" value={notarioNumero} onChange={setNotarioNumero} />
                  <Campo label="Nombre del notario" value={notarioNombre} onChange={setNotarioNombre} />
                  <Campo label="Ciudad del notario" value={ciudadNotario} onChange={setCiudadNotario} />
                  <Campo label="Folio Mercantil" value={folioMercantil} onChange={setFolioMercantil} />
                  <Campo label="Ciudad del registro" value={ciudadRegistro} onChange={setCiudadRegistro} />
                  <Campo label="Estado del registro" value={estadoRegistro} onChange={setEstadoRegistro} />
                </div>

                <label className="mt-4 flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={poderEnEscritura}
                    onChange={(e) => setPoderEnEscritura(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    El poder del representante consta en la misma escritura constitutiva
                    <span className="mt-1 block text-xs text-slate-500">
                      Al marcarlo se omite del contrato el párrafo del poder. Atención: ese párrafo
                      también contiene la frase de personalidad jurídica y la de poderes no
                      revocados, que desaparecen con él.
                    </span>
                  </span>
                </label>

                {!poderEnEscritura && (
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <Campo label="Poder · escritura Nº" value={poderEscrituraNumero} onChange={setPoderEscrituraNumero} />
                    <Campo label="Poder · fecha" value={poderEscrituraFecha} onChange={setPoderEscrituraFecha} />
                    <Campo label="Poder · notario Nº" value={poderNotarioNumero} onChange={setPoderNotarioNumero} />
                    <Campo label="Poder · notario" value={poderNotarioNombre} onChange={setPoderNotarioNombre} />
                    <Campo label="Poder · ciudad" value={poderCiudadNotario} onChange={setPoderCiudadNotario} />
                  </div>
                )}
              </section>
            )}

            {esServicios(tipo) && (
              <>
                <section className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Domicilio para notificaciones
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <Campo label="Calle" value={calle} onChange={setCalle} />
                    <Campo label="Número exterior" value={numeroExterior} onChange={setNumeroExterior} />
                    <Campo label="Colonia" value={colonia} onChange={setColonia} />
                    <Campo label="Código postal" value={codigoPostal} onChange={setCodigoPostal} />
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Objeto y vigencia
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <Campo label="Servicio (objeto)" value={servicioObjeto} onChange={setServicioObjeto} />
                    <Campo label="Canal 1" value={canal1} onChange={setCanal1} />
                    <Campo label="Canal 2" value={canal2} onChange={setCanal2} />
                    <Campo label="Duración (meses)" type="number" value={duracionMeses} onChange={setDuracionMeses} />
                    <Campo label="Fecha inicio" type="date" value={fechaInicio} onChange={setFechaInicio} />
                    <Campo label="Fecha fin" type="date" value={fechaFin} onChange={setFechaFin} />
                    <Campo label="Meses del servicio" type="number" value={mesesServicio} onChange={setMesesServicio} />
                    <Campo label="Nº de pagos mensuales" type="number" value={numeroPagos} onChange={setNumeroPagos} />
                    <Campo label="Fecha de firma" type="date" value={fechaFirma} onChange={setFechaFirma} />
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Montos
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Campo label="Monto total" type="number" value={montoTotal} onChange={setMontoTotal} />
                      {montoTotal && (
                        <p className="mt-1 text-xs text-slate-500">{montoALetras(montoTotal)}</p>
                      )}
                    </div>
                    <div>
                      <Campo label="Pago mensual" type="number" value={pagoMensual} onChange={setPagoMensual} />
                      {pagoMensual && (
                        <p className="mt-1 text-xs text-slate-500">{montoALetras(pagoMensual)}</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Servicios
                    </p>
                    <button
                      type="button"
                      onClick={() => setServicios((p) => [...p, nuevaFila()])}
                      className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                    >
                      <PlusIcon className="h-3 w-3" /> Agregar
                    </button>
                  </div>
                  <p className="mb-2 text-xs text-slate-400">
                    La plantilla solo tiene huecos para un servicio: se usa el primero de la lista.
                  </p>
                  <div className="space-y-2">
                    {servicios.map((f) => (
                      <div key={f.key} className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] items-end gap-2">
                        <Campo label="Servicio" value={f.nombre} onChange={(v) => patchFila(f.key, { nombre: v })} />
                        <Campo
                          label="Inicio"
                          type="date"
                          value={f.fechaInicio}
                          onChange={(v) => patchFila(f.key, { fechaInicio: v })}
                        />
                        <Campo
                          label="Monto"
                          type="number"
                          value={f.monto}
                          onChange={(v) => patchFila(f.key, { monto: v, montoLetras: montoALetras(v) })}
                        />
                        <Campo
                          label="Monto en letras"
                          value={f.montoLetras}
                          onChange={(v) => patchFila(f.key, { montoLetras: v })}
                        />
                        <button
                          type="button"
                          onClick={() => setServicios((p) => (p.length > 1 ? p.filter((x) => x.key !== f.key) : p))}
                          className="rounded-md border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:text-red-500"
                          aria-label="Eliminar"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => (paso === 2 ? setPaso(1) : onClose())}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            {paso === 2 ? 'Atrás' : 'Cancelar'}
          </button>
          {paso === 2 && (
            <button
              type="button"
              onClick={generar}
              disabled={generando}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {generando ? 'Generando…' : 'Generar contrato'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
