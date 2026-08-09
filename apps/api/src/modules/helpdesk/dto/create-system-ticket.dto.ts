/**
 * Alta de ticket generada por la plataforma, no por una persona en la UI.
 *
 * No es un DTO de endpoint —ningún controller lo expone— sino el contrato entre
 * módulos: los identificadores van por correo y el categoría por nombre para que
 * el módulo emisor no tenga que conocer ids de HelpDesk.
 */
export interface CreateSystemTicketDto {
  /** Se antepone como primera línea de la descripción: el ticket no tiene título. */
  title: string;
  description: string;
  /** Nombre o slug de helpdesk.categories. */
  categoryName: string;
  createdByEmployeeEmail: string;
  assignedToEmployeeEmail?: string;
  /** Acepta P1–P4 o las etiquetas low/medium/high/urgent. */
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'P1' | 'P2' | 'P3' | 'P4';
  impact?: 'alto' | 'medio' | 'bajo';
}
