export type PaymentIntentStatus =
  | "CREATED"
  | "USER_CONFIRMED"
  | "PAID"
  | "REJECTED"
  | "EXPIRED";

export interface BizumEvent {
  id: string;
  name: string;
  fixedPriceCents: number;
  currency: "EUR";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Receiver {
  id: string;
  label: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  id: string;
  eventId: string;
  userKey: string;
  paymentRef: string;
  quantity: number;
  receiverId: string;
  receiverPhone: string;
  amountCents: number;
  currency: "EUR";
  status: PaymentIntentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  confirmedAt?: string;
  paidAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  ticketCodes?: string[];
  qrPayloads?: string[];
  ticketsEmailedAt?: string;
  buyerName?: string;
  ticketType?: string;
  knowsBilly?: boolean;
  validationToken?: string;
  version: number;
}

export interface AuditLog {
  id: string;
  intentId?: string;
  eventId?: string;
  action: string;
  actorType: "SYSTEM" | "USER" | "ADMIN";
  actorKey: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface BizumDb {
  events: BizumEvent[];
  receivers: Receiver[];
  payment_intents: PaymentIntent[];
  audit_logs: AuditLog[];
}

export interface PublicIntentView {
  id: string;
  eventId: string;
  paymentRef: string;
  quantity: number;
  receiverPhone: string;
  amountCents: number;
  currency: "EUR";
  status: PaymentIntentStatus;
  expiresAt: string;
  confirmedAt?: string;
  paidAt?: string;
  ticketCodes?: string[];
  buyerName?: string;
  ticketType?: string;
}
