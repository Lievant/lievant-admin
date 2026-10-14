'use client';

import { InfoPopover } from './info-popover';

/**
 * Compartido por Mis Gastos de Tarjeta y Mis Reembolsos. Única fuente de la
 * explicación de cada tipo de gasto (llaves = nombres exactos del catálogo,
 * en el orden en que se muestran en el panel).
 */
const EXPENSE_TYPE_INFO: [string, string][] = [
  ['Viáticos cliente', 'Este costo lo asume directamente el cliente'],
  ['Costo operativo', 'Este gasto lo asume el área operativa'],
  ['Costo de Marketing', 'Costos relacionados al tema de marketing'],
  ['Costo de venta / temas comerciales', 'Área de la división'],
];

/** "i" del encabezado de Tipo de Gasto: lista cada tipo con su explicación. */
export function ExpenseTypeHint() {
  return (
    <InfoPopover ariaLabel="Ver detalle de cada tipo de gasto">
      <ul className="space-y-1.5">
        {EXPENSE_TYPE_INFO.map(([name, text]) => (
          <li key={name}>
            <strong className="font-semibold text-navy">{name}</strong> - {text}
          </li>
        ))}
      </ul>
    </InfoPopover>
  );
}
