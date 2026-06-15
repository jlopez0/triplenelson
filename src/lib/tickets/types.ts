export interface TicketDoc {
  ticketCode: string;
  intentId: string;
  eventId: string;
  buyerName: string | null;
  buyerEmail: string;
  ticketType: string | null;
  amountCents: number;
  position: number;
  totalInIntent: number;
  receiverId: string;
  paidAt: string;
  used: boolean;
  usedAt: string | null;
  usedBy: string | null;
}

export type ValidationStatus = "OK" | "DUPLICATE" | "NOT_FOUND";

export interface ValidationResult {
  status: ValidationStatus;
  ticket?: TicketDoc;
  message?: string;
}
