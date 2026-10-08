export interface LineWithoutInvoice {
  position: number;
  vendor: string;
  lineDate: string;
}

interface InvoiceLine {
  hasInvoice: boolean;
  invoiceS3Key: string | null;
  vendor: string;
  lineDate: string;
  sortOrder: number;
}

/** Una línea tiene adjunto si está marcada y existe el archivo en S3. */
export function linesWithoutInvoice(lines: InvoiceLine[]): LineWithoutInvoice[] {
  return [...lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l, i) => ({ l, position: i + 1 }))
    .filter(({ l }) => !(l.hasInvoice && l.invoiceS3Key))
    .map(({ l, position }) => ({ position, vendor: l.vendor, lineDate: l.lineDate }));
}
