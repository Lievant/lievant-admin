'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  approveBooking,
  cancelBooking,
  createBooking,
  updateBooking,
  createRoom,
  createRoomCity,
  createRoomCountry,
  createRoomOffice,
  listAdminBookings,
  listRoomsByOffice,
  rejectBooking,
  toggleRoomActive,
  updateRoom,
  updateRoomOffice,
  type Booking,
  type CancelBookingPayload,
  type CreateBookingPayload,
  type CreateRoomCityPayload,
  type CreateRoomCountryPayload,
  type CreateRoomOfficePayload,
  type CreateRoomPayload,
  type ListAdminBookingsParams,
  type Room,
  type UpdateBookingPayload,
  type UpdateRoomOfficePayload,
  type UpdateRoomPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

function revalidateAll(): void {
  revalidatePath('/herramientas/salas');
  revalidatePath('/herramientas/salas/mis-reservas');
  revalidatePath('/herramientas/salas/admin');
}

export async function createBookingAction(payload: CreateBookingPayload): Promise<ActionResult> {
  try {
    await createBooking(payload);
    revalidateAll();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function cancelBookingAction(id: string, payload: CancelBookingPayload = {}): Promise<ActionResult> {
  try {
    await cancelBooking(id, payload);
    revalidateAll();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateBookingAction(id: string, payload: UpdateBookingPayload): Promise<ActionResult> {
  try {
    await updateBooking(id, payload);
    revalidateAll();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function approveBookingAction(id: string): Promise<ActionResult> {
  try {
    await approveBooking(id);
    revalidateAll();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function rejectBookingAction(id: string): Promise<ActionResult> {
  try {
    await rejectBooking(id);
    revalidateAll();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createRoomAction(payload: CreateRoomPayload): Promise<ActionResult> {
  try {
    await createRoom(payload);
    revalidatePath('/herramientas/salas/admin');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateRoomAction(id: string, payload: UpdateRoomPayload): Promise<ActionResult> {
  try {
    await updateRoom(id, payload);
    revalidatePath('/herramientas/salas/admin');
    revalidatePath(`/herramientas/salas/${id}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function toggleRoomActiveAction(id: string): Promise<ActionResult> {
  try {
    await toggleRoomActive(id);
    revalidatePath('/herramientas/salas/admin');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createRoomCountryAction(payload: CreateRoomCountryPayload): Promise<ActionResult> {
  try {
    await createRoomCountry(payload);
    revalidatePath('/herramientas/salas/admin');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createRoomCityAction(payload: CreateRoomCityPayload): Promise<ActionResult> {
  try {
    await createRoomCity(payload);
    revalidatePath('/herramientas/salas/admin');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createRoomOfficeAction(payload: CreateRoomOfficePayload): Promise<ActionResult> {
  try {
    await createRoomOffice(payload);
    revalidatePath('/herramientas/salas/admin');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateRoomOfficeAction(id: string, payload: UpdateRoomOfficePayload): Promise<ActionResult> {
  try {
    await updateRoomOffice(id, payload);
    revalidatePath('/herramientas/salas/admin');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function getRoomBookingsAction(roomId: string, dateFrom: string, dateTo: string): Promise<Booking[] | null> {
  try {
    return await listAdminBookings({ room_id: roomId, date_from: dateFrom, date_to: dateTo });
  } catch {
    return null;
  }
}

export async function listAdminBookingsAction(params: ListAdminBookingsParams): Promise<Booking[] | null> {
  try {
    return await listAdminBookings(params);
  } catch {
    return null;
  }
}

export async function listRoomsByOfficeAction(officeId: string): Promise<Room[] | null> {
  try {
    return await listRoomsByOffice(officeId);
  } catch {
    return null;
  }
}
