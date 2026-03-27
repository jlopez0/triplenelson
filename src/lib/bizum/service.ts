import { createHash, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { checkRateLimit } from "./rate-limit";
import { readDbSnapshot, withDbTransaction } from "./store";
import type {
  AuditLog,
  BizumDb,
  BizumEvent,
  PaymentIntent,
  PaymentIntentStatus,
  PublicIntentView,
  Receiver,
} from "./types";

const DEFAULT_EVENT_ID = process.env.BIZUM_EVENT_ID ?? "triple-nelson-2026";
const INTENT_TTL_MINUTES = Number(process.env.BIZUM_INTENT_TTL_MINUTES ?? "30");
const MAX_TICKETS_PER_PURCHASE = 10;
const FIELES_PRICE_CENTS = Math.round(Number(process.env.BIZUM_FIELES_PRICE_EUR ?? "50") * 100);

const ACTIVE_INTENT_STATUSES: PaymentIntentStatus[] = ["CREATED", "USER_CONFIRMED"];

const CREATE_RATE_LIMIT = { maxHits: 6, windowMs: 60_000 };
const CONFIRM_RATE_LIMIT = { maxHits: 10, windowMs: 60_000 };

export class BizumServiceError extends Error {
  statusCode: number;
  code: string;
  payload?: Record<string, unknown>;

  constructor(params: {
    message: string;
    statusCode: number;
    code: string;
    payload?: Record<string, unknown>;
  }) {
    super(params.message);
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.payload = params.payload;
  }
}

const nowIso = () => new Date().toISOString();

function normalizeUserKey(userKey: string): string {
  return userKey.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toPublicIntent(intent: PaymentIntent): PublicIntentView {
  return {
    id: intent.id,
    eventId: intent.eventId,
    paymentRef: intent.paymentRef,
    quantity: intent.quantity,
    receiverPhone: intent.receiverPhone,
    amountCents: intent.amountCents,
    currency: intent.currency,
    status: intent.status,
    expiresAt: intent.expiresAt,
    confirmedAt: intent.confirmedAt,
    paidAt: intent.paidAt,
    ticketCodes: intent.ticketCodes,
    buyerName: intent.buyerName,
    ticketType: intent.ticketType,
  };
}

function hashToNumber(value: string): number {
  const digest = createHash("sha256").update(value).digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16);
}

function buildAuditLog(params: {
  action: string;
  actorType: AuditLog["actorType"];
  actorKey: string;
  ip?: string;
  intentId?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}): AuditLog {
  return {
    id: `audit_${randomUUID()}`,
    action: params.action,
    actorType: params.actorType,
    actorKey: params.actorKey,
    ip: params.ip,
    intentId: params.intentId,
    eventId: params.eventId,
    metadata: params.metadata,
    createdAt: nowIso(),
  };
}

function ensureRateLimit(params: {
  scope: "create_intent" | "confirm_sent";
  userKey: string;
  ip: string;
}): void {
  const normalizedUserKey = normalizeUserKey(params.userKey);
  const limits = params.scope === "create_intent" ? CREATE_RATE_LIMIT : CONFIRM_RATE_LIMIT;
  const userBucket = checkRateLimit({
    key: `${params.scope}:user:${normalizedUserKey}`,
    maxHits: limits.maxHits,
    windowMs: limits.windowMs,
  });
  const ipBucket = checkRateLimit({
    key: `${params.scope}:ip:${params.ip}`,
    maxHits: limits.maxHits,
    windowMs: limits.windowMs,
  });

  if (!userBucket.ok || !ipBucket.ok) {
    throw new BizumServiceError({
      code: "RATE_LIMITED",
      statusCode: 429,
      message: "Too many requests. Retry later.",
      payload: {
        retryAfterSec: Math.max(userBucket.retryAfterSec, ipBucket.retryAfterSec),
      },
    });
  }
}

function expireStaleIntentsInDb(_db: BizumDb, _nowDate: Date): number {
  // Expiration disabled — intents remain open until manually rejected or paid.
  return 0;
}

function pickReceiver(params: {
  db: BizumDb;
  eventId: string;
  userKey: string;
  nowDate: Date;
}): Receiver {
  const activeReceivers = params.db.receivers.filter((receiver) => receiver.isActive);

  if (activeReceivers.length === 0) {
    throw new BizumServiceError({
      code: "NO_RECEIVER",
      statusCode: 503,
      message: "No active Bizum receiver available.",
    });
  }

  const loadByReceiver = new Map<string, number>();
  for (const receiver of activeReceivers) {
    loadByReceiver.set(receiver.id, 0);
  }

  const COUNTED_STATUSES = [...ACTIVE_INTENT_STATUSES, "PAID"] as string[];
  for (const intent of params.db.payment_intents) {
    if (!COUNTED_STATUSES.includes(intent.status)) {
      continue;
    }

    if (loadByReceiver.has(intent.receiverId)) {
      loadByReceiver.set(intent.receiverId, (loadByReceiver.get(intent.receiverId) ?? 0) + 1);
    }
  }

  const preferredIndex = hashToNumber(`${params.eventId}:${params.userKey}`) % activeReceivers.length;
  const preferredReceiver = activeReceivers[preferredIndex];
  const preferredLoad = loadByReceiver.get(preferredReceiver.id) ?? 0;

  let minLoadReceiver = activeReceivers[0];
  let minLoad = loadByReceiver.get(minLoadReceiver.id) ?? 0;
  for (const receiver of activeReceivers) {
    const receiverLoad = loadByReceiver.get(receiver.id) ?? 0;
    if (receiverLoad < minLoad) {
      minLoad = receiverLoad;
      minLoadReceiver = receiver;
    }
  }

  // Keep deterministic assignment unless it is clearly overloaded.
  if (preferredLoad <= minLoad + 1) {
    return preferredReceiver;
  }

  return minLoadReceiver;
}

function getEventOrThrow(db: BizumDb, eventId: string): BizumEvent {
  const event = db.events.find((item) => item.id === eventId && item.isActive);
  if (!event) {
    throw new BizumServiceError({
      code: "EVENT_NOT_FOUND",
      statusCode: 404,
      message: "Event not found.",
    });
  }
  return event;
}

function generateTicket(intent: PaymentIntent, index: number): { ticketCode: string; qrPayload: string } {
  const codeSeed = `${intent.id}:${index}:${intent.paidAt ?? nowIso()}`;
  const code = `TN-${createHash("sha256").update(codeSeed).digest("hex").slice(0, 10).toUpperCase()}`;
  const qrPayload = JSON.stringify({
    ticketCode: code,
    eventId: intent.eventId,
    intentId: intent.id,
    receiverId: intent.receiverId,
  });
  return { ticketCode: code, qrPayload };
}

function generatePaymentRef(existingRefs: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const digits = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
    const ref = `TN${digits}`;
    if (!existingRefs.has(ref)) return ref;
  }
  // Fallback a 5 dígitos si (muy improbablemente) se agotaran los de 4
  return `TN${String(Math.floor(Math.random() * 90000) + 10000)}`;
}

function sanitizeQuantity(quantity: number | undefined): number {
  const normalized = Number(quantity ?? 1);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > MAX_TICKETS_PER_PURCHASE) {
    throw new BizumServiceError({
      code: "INVALID_QUANTITY",
      statusCode: 400,
      message: `quantity must be an integer between 1 and ${MAX_TICKETS_PER_PURCHASE}.`,
    });
  }
  return normalized;
}

async function sendTicketsByEmail(params: {
  to: string;
  eventName: string;
  paymentRef: string;
  amountCents: number;
  currency: "EUR";
  ticketCodes: string[];
  qrPayloads: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BIZUM_EMAIL_FROM;
  if (!apiKey || !from) {
    return { attempted: 0, sent: 0, skipped: true, reason: "Email disabled (missing RESEND_API_KEY/BIZUM_EMAIL_FROM)." };
  }

  const resend = new Resend(apiKey);
  const ticketCount = params.ticketCodes.length;

  const attachments: Array<{ filename: string; content: Buffer; content_type: string }> = [];
  const ticketBlocks: string[] = [];

  for (let index = 0; index < ticketCount; index += 1) {
    const ticketCode = params.ticketCodes[index];
    const qrPayload = params.qrPayloads[index] ?? ticketCode;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 320, margin: 1 });
    const pdfBytes = await buildTicketPdf({
      eventName: params.eventName,
      ticketCode,
      paymentRef: params.paymentRef,
      amountCents: params.amountCents,
      currency: params.currency,
      qrDataUrl,
    });

    attachments.push({
      filename: `entrada-${index + 1}-triple-nelson-2026.pdf`,
      content: Buffer.from(pdfBytes),
      content_type: "application/pdf",
    });

    ticketBlocks.push(`
      <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #ddd">
        <p style="margin:0 0 6px 0">Entrada ${index + 1}/${ticketCount}: <strong>${ticketCode}</strong></p>
        <img src="${qrDataUrl}" alt="QR ${ticketCode}" width="200" height="200" />
      </div>
    `);
  }

  const subject =
    ticketCount === 1
      ? `Tu entrada para ${params.eventName}`
      : `Tus ${ticketCount} entradas para ${params.eventName}`;

  await resend.emails.send({
    from,
    to: params.to,
    subject,
    text: `Tus ${ticketCount} entrada(s) de ${params.eventName}. Referencia: ${params.paymentRef}.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111">
        <h2 style="margin-bottom:8px">Tus entradas de ${params.eventName}</h2>
        <p style="margin:0 0 8px 0">Referencia de pago: <strong>${params.paymentRef}</strong></p>
        <p style="margin:0 0 16px 0">Importe total pagado: <strong>${(params.amountCents / 100).toFixed(2)} ${params.currency}</strong></p>
        ${ticketBlocks.join("")}
        <p style="margin-top:12px">Adjuntamos los PDFs de tus entradas.</p>
      </div>
    `,
    attachments,
  });

  return { attempted: ticketCount, sent: ticketCount, skipped: false as const };
}

function parseDataUrlBase64(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

async function buildTicketPdf(params: {
  eventName: string;
  ticketCode: string;
  paymentRef: string;
  amountCents: number;
  currency: "EUR";
  qrDataUrl: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(parseDataUrlBase64(params.qrDataUrl));

  page.drawText("TRIPLE NELSON - ENTRADA", {
    x: 50,
    y: 780,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Evento: ${params.eventName}`, { x: 50, y: 740, size: 13, font });
  page.drawText(`Codigo ticket: ${params.ticketCode}`, { x: 50, y: 715, size: 13, font: fontBold });
  page.drawText(`Referencia pago: ${params.paymentRef}`, { x: 50, y: 690, size: 12, font });
  page.drawText(
    `Importe total compra: ${(params.amountCents / 100).toFixed(2)} ${params.currency}`,
    { x: 50, y: 665, size: 12, font },
  );
  page.drawText(`Emitido: ${new Date().toLocaleString("es-ES")}`, { x: 50, y: 640, size: 10, font });

  page.drawImage(qrImage, {
    x: 50,
    y: 350,
    width: 220,
    height: 220,
  });

  page.drawText("Presenta este PDF (o el QR) en acceso.", { x: 50, y: 320, size: 11, font });

  return pdf.save();
}

async function sendReceiverNotification(params: {
  receiverEmail: string;
  paymentRef: string;
  userKey: string;
  buyerName?: string;
  quantity: number;
  amountCents: number;
  currency: "EUR";
  confirmedAt: string;
  validationToken: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BIZUM_EMAIL_FROM;
  if (!apiKey || !from) return;

  const siteUrl = (process.env.BIZUM_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const magicLink = `${siteUrl}/api/validate_from_email?token=${params.validationToken}`;
  const amount = (params.amountCents / 100).toFixed(2);

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: params.receiverEmail,
    subject: `[Triple Nelson] Bizum pendiente de verificar — ref ${params.paymentRef}`,
    text: `Bizum pendiente — ref ${params.paymentRef}\n${params.buyerName ? `Nombre: ${params.buyerName}\n` : ""}Email: ${params.userKey}\nEntradas: ${params.quantity}\nImporte: ${amount} ${params.currency}\nVerifica: ${magicLink}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:560px">
        <h2 style="margin-bottom:16px">Bizum pendiente de verificar</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
          ${params.buyerName ? `<tr><td style="padding:6px 0;color:#555;width:120px">Nombre:</td><td><strong style="font-size:16px">${params.buyerName}</strong></td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#555;width:120px">Email:</td><td>${params.userKey}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Entradas:</td><td><strong>${params.quantity}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#555">Importe:</td><td><strong>${amount} ${params.currency}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#555">Referencia:</td><td><strong style="font-family:monospace;font-size:15px">${params.paymentRef}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#555">Confirmado:</td><td>${new Date(params.confirmedAt).toLocaleString("es-ES")}</td></tr>
        </table>
        <a href="${magicLink}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:bold">
          ✓ Marcar como pagado
        </a>
        <p style="margin-top:20px;font-size:12px;color:#888;line-height:1.5">
          Solo pulsa si has recibido el Bizum con la referencia <strong>${params.paymentRef}</strong> en tu cuenta.<br/>
          Este enlace es de un solo uso y marcará el pago como confirmado automáticamente.
        </p>
      </div>
    `,
  });
}

export async function createOrReuseIntent(params: {
  eventId?: string;
  userKey: string;
  buyerName?: string;
  ticketType?: string;
  quantity?: number;
  knowsBilly?: boolean;
  ip: string;
}) {
  if (!params.userKey?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_USER_KEY",
      statusCode: 400,
      message: "Email is required.",
    });
  }

  ensureRateLimit({ scope: "create_intent", userKey: params.userKey, ip: params.ip });
  const userKey = normalizeUserKey(params.userKey);
  if (!isValidEmail(userKey)) {
    throw new BizumServiceError({
      code: "INVALID_USER_KEY",
      statusCode: 400,
      message: "Email is required and must be valid.",
    });
  }
  const eventId = params.eventId?.trim() || DEFAULT_EVENT_ID;
  const quantity = sanitizeQuantity(params.quantity);
  const ticketType = params.ticketType?.trim() || undefined;
  const isFieles = ticketType === "ENTRADA FIELES";

  return withDbTransaction((db) => {
    const nowDate = new Date();
    expireStaleIntentsInDb(db, nowDate);
    const event = getEventOrThrow(db, eventId);
    const pricePerUnit = isFieles ? FIELES_PRICE_CENTS : event.fixedPriceCents;

    const existing = db.payment_intents.find((intent) => {
      if (intent.eventId !== event.id || intent.userKey !== userKey || intent.quantity !== quantity) {
        return false;
      }
      if (!ACTIVE_INTENT_STATUSES.includes(intent.status)) {
        return false;
      }
      return new Date(intent.expiresAt).getTime() > nowDate.getTime();
    });

    if (existing) {
      db.audit_logs.push(
        buildAuditLog({
          action: "INTENT_REUSED",
          actorType: "USER",
          actorKey: userKey,
          ip: params.ip,
          intentId: existing.id,
          eventId: event.id,
        }),
      );
      const existingReceiver = db.receivers.find((r) => r.id === existing.receiverId);
      return {
        reused: true,
        event,
        intent: toPublicIntent(existing),
        receiverLabel: existingReceiver?.label ?? "",
      };
    }

    const receiver = pickReceiver({ db, eventId: event.id, userKey, nowDate });
    const createdAt = nowIso();
    const expiresAt = new Date(nowDate.getTime() + 365 * 24 * 60 * 60_000).toISOString();
    const existingRefs = new Set(db.payment_intents.map((i) => i.paymentRef));
    const intent: PaymentIntent = {
      id: `pi_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      eventId: event.id,
      userKey,
      buyerName: params.buyerName?.trim() || undefined,
      ticketType,
      paymentRef: generatePaymentRef(existingRefs),
      quantity,
      receiverId: receiver.id,
      receiverPhone: receiver.phone,
      amountCents: pricePerUnit * quantity,
      currency: event.currency,
      status: "CREATED",
      createdAt,
      updatedAt: createdAt,
      expiresAt,
      knowsBilly: params.knowsBilly,
      validationToken: randomUUID(),
      version: 1,
    };

    db.payment_intents.push(intent);
    db.audit_logs.push(
      buildAuditLog({
        action: "INTENT_CREATED",
        actorType: "USER",
        actorKey: userKey,
        ip: params.ip,
        intentId: intent.id,
        eventId: event.id,
        metadata: { receiverId: receiver.id, amountCents: intent.amountCents, quantity: intent.quantity },
      }),
    );

    return {
      reused: false,
      event,
      intent: toPublicIntent(intent),
      receiverLabel: receiver.label ?? "",
    };
  });
}

export async function confirmSent(params: { intentId: string; userKey: string; ip: string }) {
  if (!params.intentId?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_INTENT_ID",
      statusCode: 400,
      message: "intentId is required.",
    });
  }
  if (!params.userKey?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_USER_KEY",
      statusCode: 400,
      message: "Email is required.",
    });
  }

  ensureRateLimit({ scope: "confirm_sent", userKey: params.userKey, ip: params.ip });
  const userKey = normalizeUserKey(params.userKey);
  if (!isValidEmail(userKey)) {
    throw new BizumServiceError({
      code: "INVALID_USER_KEY",
      statusCode: 400,
      message: "Email is required and must be valid.",
    });
  }

  const result = await withDbTransaction((db) => {
    expireStaleIntentsInDb(db, new Date());

    const intent = db.payment_intents.find((item) => item.id === params.intentId.trim());
    if (!intent || intent.userKey !== userKey) {
      throw new BizumServiceError({
        code: "INTENT_NOT_FOUND",
        statusCode: 404,
        message: "Intent not found.",
      });
    }

    if (intent.status === "EXPIRED") {
      return { expired: true, notify: null, intent: toPublicIntent(intent) };
    }
    if (intent.status === "REJECTED") {
      throw new BizumServiceError({
        code: "INTENT_REJECTED",
        statusCode: 409,
        message: "Intent already rejected.",
        payload: { intent: toPublicIntent(intent) },
      });
    }
    if (intent.status === "PAID") {
      return { expired: false, notify: null, intent: toPublicIntent(intent) };
    }

    let notify: {
      receiverEmail: string;
      paymentRef: string;
      userKey: string;
      buyerName?: string;
      quantity: number;
      amountCents: number;
      currency: "EUR";
      confirmedAt: string;
      validationToken: string;
    } | null = null;

    if (intent.status === "CREATED") {
      const timestamp = nowIso();
      intent.status = "USER_CONFIRMED";
      intent.confirmedAt = timestamp;
      intent.updatedAt = timestamp;
      // Extend expiry to 7 days so the receiver has time to validate via email link
      intent.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      intent.version += 1;
      db.audit_logs.push(
        buildAuditLog({
          action: "USER_CONFIRMED_SENT",
          actorType: "USER",
          actorKey: userKey,
          ip: params.ip,
          intentId: intent.id,
          eventId: intent.eventId,
        }),
      );

      const receiver = db.receivers.find((r) => r.id === intent.receiverId);
      if (receiver?.email && intent.validationToken) {
        notify = {
          receiverEmail: receiver.email,
          paymentRef: intent.paymentRef,
          userKey: intent.userKey,
          buyerName: intent.buyerName,
          quantity: intent.quantity,
          amountCents: intent.amountCents,
          currency: intent.currency,
          confirmedAt: timestamp,
          validationToken: intent.validationToken,
        };
      }
    }

    return { expired: false, notify, intent: toPublicIntent(intent) };
  });

  if (result.expired) {
    throw new BizumServiceError({
      code: "INTENT_EXPIRED",
      statusCode: 409,
      message: "Intent expired.",
      payload: { intent: result.intent },
    });
  }

  if (result.notify) {
    try {
      await sendReceiverNotification(result.notify);
    } catch (err) {
      console.warn("[confirmSent] No se pudo enviar notificacion al receptor:", err instanceof Error ? err.message : err);
    }
  }

  return result.intent;
}

export async function markPaid(params: { intentId: string; adminKey: string; ip: string }) {
  if (!params.intentId?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_INTENT_ID",
      statusCode: 400,
      message: "intentId is required.",
    });
  }

  const marked = await withDbTransaction((db) => {
    const intent = db.payment_intents.find((item) => item.id === params.intentId.trim());
    if (!intent) {
      throw new BizumServiceError({
        code: "INTENT_NOT_FOUND",
        statusCode: 404,
        message: "Intent not found.",
      });
    }

    if (intent.status === "REJECTED" || intent.status === "EXPIRED") {
      throw new BizumServiceError({
        code: "INVALID_STATUS",
        statusCode: 409,
        message: "Cannot mark paid from current status.",
        payload: { status: intent.status },
      });
    }

    if (intent.status !== "PAID") {
      const paidAt = nowIso();
      intent.status = "PAID";
      intent.paidAt = paidAt;
      intent.updatedAt = paidAt;
      intent.version += 1;
      const quantity = Math.max(1, intent.quantity || 1);
      const tickets = Array.from({ length: quantity }, (_, index) => generateTicket(intent, index));
      intent.ticketCodes = tickets.map((ticket) => ticket.ticketCode);
      intent.qrPayloads = tickets.map((ticket) => ticket.qrPayload);
      db.audit_logs.push(
        buildAuditLog({
          action: "ADMIN_MARKED_PAID",
          actorType: "ADMIN",
          actorKey: params.adminKey,
          ip: params.ip,
          intentId: intent.id,
          eventId: intent.eventId,
          metadata: { ticketCount: intent.ticketCodes.length, quantity: intent.quantity },
        }),
      );
    }

    const event = db.events.find((item) => item.id === intent.eventId);

    return {
      intent: toPublicIntent(intent),
      qrPayloads: intent.qrPayloads ?? [],
      eventName: event?.name ?? intent.eventId,
      userEmail: intent.userKey,
      eventId: intent.eventId,
    };
  });

  let emailDelivery: { attempted: number; sent: number; skipped: boolean; reason?: string } = {
    attempted: 0,
    sent: 0,
    skipped: true,
    reason: "No tickets to send.",
  };

  if ((marked.intent.ticketCodes?.length ?? 0) > 0) {
    try {
      emailDelivery = await sendTicketsByEmail({
        to: marked.userEmail,
        eventName: marked.eventName,
        paymentRef: marked.intent.paymentRef,
        amountCents: marked.intent.amountCents,
        currency: marked.intent.currency,
        ticketCodes: marked.intent.ticketCodes ?? [],
        qrPayloads: marked.qrPayloads,
      });
    } catch (error) {
      emailDelivery = {
        attempted: marked.intent.ticketCodes?.length ?? 0,
        sent: 0,
        skipped: false,
        reason: error instanceof Error ? error.message : "Unexpected email error.",
      };
    }
  }

  if (emailDelivery.sent > 0) {
    await withDbTransaction((db) => {
      const intent = db.payment_intents.find((item) => item.id === marked.intent.id);
      if (!intent) return;
      intent.ticketsEmailedAt = nowIso();
      intent.updatedAt = nowIso();
      intent.version += 1;
      db.audit_logs.push(
        buildAuditLog({
          action: "TICKETS_EMAIL_SENT",
          actorType: "SYSTEM",
          actorKey: "resend",
          intentId: intent.id,
          eventId: marked.eventId,
          metadata: { sent: emailDelivery.sent, attempted: emailDelivery.attempted },
        }),
      );
    });
  }

  return {
    ...marked,
    emailDelivery,
  };
}

export async function rejectIntent(params: { intentId: string; reason?: string; adminKey: string; ip: string }) {
  if (!params.intentId?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_INTENT_ID",
      statusCode: 400,
      message: "intentId is required.",
    });
  }

  return withDbTransaction((db) => {
    const intent = db.payment_intents.find((item) => item.id === params.intentId.trim());
    if (!intent) {
      throw new BizumServiceError({
        code: "INTENT_NOT_FOUND",
        statusCode: 404,
        message: "Intent not found.",
      });
    }

    if (intent.status === "PAID") {
      throw new BizumServiceError({
        code: "INVALID_STATUS",
        statusCode: 409,
        message: "Cannot reject a paid intent.",
      });
    }

    if (intent.status !== "REJECTED") {
      const timestamp = nowIso();
      intent.status = "REJECTED";
      intent.rejectedAt = timestamp;
      intent.updatedAt = timestamp;
      intent.version += 1;
      db.audit_logs.push(
        buildAuditLog({
          action: "ADMIN_REJECTED",
          actorType: "ADMIN",
          actorKey: params.adminKey,
          ip: params.ip,
          intentId: intent.id,
          eventId: intent.eventId,
          metadata: { reason: params.reason ?? null },
        }),
      );
    }

    return toPublicIntent(intent);
  });
}

export async function createManualIntent(params: {
  userKey: string;
  buyerName?: string;
  quantity: number;
  amountCents: number;
  ticketType: string;
  adminKey: string;
  ip: string;
}) {
  const userKey = normalizeUserKey(params.userKey);
  if (!isValidEmail(userKey)) {
    throw new BizumServiceError({ code: "INVALID_USER_KEY", statusCode: 400, message: "Email inválido." });
  }
  const quantity = Math.max(1, Math.min(MAX_TICKETS_PER_PURCHASE, Math.round(params.quantity)));
  if (params.amountCents < 0) {
    throw new BizumServiceError({ code: "INVALID_AMOUNT", statusCode: 400, message: "El importe no puede ser negativo." });
  }

  const marked = await withDbTransaction((db) => {
    const event = getEventOrThrow(db, DEFAULT_EVENT_ID);
    const now = nowIso();
    const existingRefs = new Set(db.payment_intents.map((i) => i.paymentRef));
    const intent: PaymentIntent = {
      id: `pi_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      eventId: event.id,
      userKey,
      buyerName: params.buyerName?.trim() || undefined,
      ticketType: params.ticketType.trim() || "ENTRADA",
      paymentRef: generatePaymentRef(existingRefs),
      quantity,
      receiverId: "manual",
      receiverPhone: "",
      amountCents: params.amountCents,
      currency: event.currency,
      status: "PAID",
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
      paidAt: now,
      validationToken: randomUUID(),
      version: 1,
    };

    const tickets = Array.from({ length: quantity }, (_, index) => generateTicket(intent, index));
    intent.ticketCodes = tickets.map((t) => t.ticketCode);
    intent.qrPayloads = tickets.map((t) => t.qrPayload);

    db.payment_intents.push(intent);
    db.audit_logs.push(
      buildAuditLog({
        action: "ADMIN_MANUAL_CREATED",
        actorType: "ADMIN",
        actorKey: params.adminKey,
        ip: params.ip,
        intentId: intent.id,
        eventId: event.id,
        metadata: { ticketType: intent.ticketType, amountCents: intent.amountCents, quantity },
      }),
    );

    return {
      intent: toPublicIntent(intent),
      qrPayloads: intent.qrPayloads,
      eventName: event.name,
      userEmail: intent.userKey,
      eventId: event.id,
    };
  });

  let emailDelivery: { attempted: number; sent: number; skipped: boolean; reason?: string } = { attempted: 0, sent: 0, skipped: true, reason: "No tickets." };
  if ((marked.intent.ticketCodes?.length ?? 0) > 0) {
    try {
      emailDelivery = await sendTicketsByEmail({
        to: marked.userEmail,
        eventName: marked.eventName,
        paymentRef: marked.intent.paymentRef,
        amountCents: marked.intent.amountCents,
        currency: marked.intent.currency,
        ticketCodes: marked.intent.ticketCodes ?? [],
        qrPayloads: marked.qrPayloads,
      });
    } catch (error) {
      emailDelivery = {
        attempted: marked.intent.ticketCodes?.length ?? 0,
        sent: 0,
        skipped: false,
        reason: error instanceof Error ? error.message : "Email error.",
      };
    }
  }

  if (emailDelivery.sent > 0) {
    await withDbTransaction((db) => {
      const intent = db.payment_intents.find((i) => i.id === marked.intent.id);
      if (!intent) return;
      intent.ticketsEmailedAt = nowIso();
      intent.updatedAt = nowIso();
      intent.version += 1;
    });
  }

  return { ...marked, emailDelivery };
}

export async function updateIntent(params: {
  intentId: string;
  adminKey: string;
  ip: string;
  patch: {
    userKey?: string;
    buyerName?: string;
    ticketType?: string;
    quantity?: number;
    amountCents?: number;
    receiverPhone?: string;
    status?: PaymentIntentStatus;
  };
}) {
  if (!params.intentId?.trim()) {
    throw new BizumServiceError({ code: "INVALID_INTENT_ID", statusCode: 400, message: "intentId is required." });
  }

  return withDbTransaction((db) => {
    const intent = db.payment_intents.find((i) => i.id === params.intentId.trim());
    if (!intent) {
      throw new BizumServiceError({ code: "INTENT_NOT_FOUND", statusCode: 404, message: "Intent not found." });
    }

    const p = params.patch;
    if (p.userKey !== undefined) intent.userKey = normalizeUserKey(p.userKey);
    if (p.buyerName !== undefined) intent.buyerName = p.buyerName.trim() || undefined;
    if (p.ticketType !== undefined) intent.ticketType = p.ticketType.trim() || undefined;
    if (p.quantity !== undefined) intent.quantity = Math.max(1, Math.min(MAX_TICKETS_PER_PURCHASE, Math.round(p.quantity)));
    if (p.amountCents !== undefined) intent.amountCents = Math.max(0, Math.round(p.amountCents));
    if (p.receiverPhone !== undefined) intent.receiverPhone = p.receiverPhone.replace(/\s+/g, "").trim();
    if (p.status !== undefined) intent.status = p.status;

    intent.updatedAt = nowIso();
    intent.version += 1;

    db.audit_logs.push(
      buildAuditLog({
        action: "ADMIN_UPDATED",
        actorType: "ADMIN",
        actorKey: params.adminKey,
        ip: params.ip,
        intentId: intent.id,
        eventId: intent.eventId,
        metadata: { patch: p },
      }),
    );

    return toPublicIntent(intent);
  });
}

export async function deleteIntent(params: { intentId: string; adminKey: string; ip: string }) {
  if (!params.intentId?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_INTENT_ID",
      statusCode: 400,
      message: "intentId is required.",
    });
  }

  return withDbTransaction((db) => {
    const index = db.payment_intents.findIndex((item) => item.id === params.intentId.trim());
    if (index === -1) {
      throw new BizumServiceError({
        code: "INTENT_NOT_FOUND",
        statusCode: 404,
        message: "Intent not found.",
      });
    }

    const intent = db.payment_intents[index];
    db.payment_intents.splice(index, 1);

    db.audit_logs.push(
      buildAuditLog({
        action: "ADMIN_DELETED",
        actorType: "ADMIN",
        actorKey: params.adminKey,
        ip: params.ip,
        intentId: intent.id,
        eventId: intent.eventId,
        metadata: { deletedStatus: intent.status },
      }),
    );

    return { id: intent.id };
  });
}

export async function expireIntentsJob(params: { actorKey: string }) {
  return withDbTransaction((db) => {
    const expiredCount = expireStaleIntentsInDb(db, new Date());
    db.audit_logs.push(
      buildAuditLog({
        action: "EXPIRE_JOB_RUN",
        actorType: "SYSTEM",
        actorKey: params.actorKey,
        metadata: { expiredCount },
      }),
    );
    return { expiredCount };
  });
}

export async function getIntentPublic(params: { intentId: string; userKey?: string }) {
  const userKey = params.userKey ? normalizeUserKey(params.userKey) : null;
  return withDbTransaction((db) => {
    expireStaleIntentsInDb(db, new Date());

    const intent = db.payment_intents.find((item) => item.id === params.intentId.trim());
    if (!intent) {
      throw new BizumServiceError({
        code: "INTENT_NOT_FOUND",
        statusCode: 404,
        message: "Intent not found.",
      });
    }

    if (userKey && intent.userKey !== userKey) {
      throw new BizumServiceError({
        code: "INTENT_NOT_FOUND",
        statusCode: 404,
        message: "Intent not found.",
      });
    }

    return toPublicIntent(intent);
  });
}

export async function listAdminIntents(params: {
  status?: PaymentIntentStatus;
  receiverId?: string;
  paymentRef?: string;
  from?: string;
  to?: string;
}) {
  return withDbTransaction((db) => {
    expireStaleIntentsInDb(db, new Date());

    let items = [...db.payment_intents];
    const getFilterDate = (intent: PaymentIntent) => new Date(intent.confirmedAt ?? intent.createdAt).getTime();

    if (params.status) {
      items = items.filter((item) => item.status === params.status);
    }
    if (params.receiverId) {
      items = items.filter((item) => item.receiverId === params.receiverId);
    }
    if (params.paymentRef) {
      const normalized = params.paymentRef.trim().toUpperCase();
      items = items.filter((item) => item.paymentRef.toUpperCase().includes(normalized));
    }
    if (params.from) {
      const from = new Date(params.from).getTime();
      if (!Number.isNaN(from)) {
        items = items.filter((item) => getFilterDate(item) >= from);
      }
    }
    if (params.to) {
      const to = new Date(params.to).getTime();
      if (!Number.isNaN(to)) {
        items = items.filter((item) => getFilterDate(item) <= to);
      }
    }

    items.sort((a, b) => {
      const aTime = new Date(a.confirmedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.confirmedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    return items.map((intent) => {
      const receiver = db.receivers.find((item) => item.id === intent.receiverId);
      return {
        ...toPublicIntent(intent),
        receiverId: intent.receiverId,
        receiverLabel: receiver?.label ?? intent.receiverId,
        receiverPhone: receiver?.phone ?? intent.receiverPhone,
        createdAt: intent.createdAt,
        confirmedAt: intent.confirmedAt,
        userKey: intent.userKey,
        quantity: intent.quantity,
        knowsBilly: intent.knowsBilly,
      };
    });
  });
}

export async function listReceivers() {
  const db = await readDbSnapshot();
  return db.receivers.map((receiver) => ({
    id: receiver.id,
    label: receiver.label,
    phone: receiver.phone,
    isActive: receiver.isActive,
  }));
}

export async function getDefaultEvent() {
  const db = await readDbSnapshot();
  return getEventOrThrow(db, DEFAULT_EVENT_ID);
}

export async function markPaidByToken(token: string) {
  if (!token?.trim()) {
    throw new BizumServiceError({
      code: "INVALID_TOKEN",
      statusCode: 400,
      message: "Token is required.",
    });
  }

  const marked = await withDbTransaction((db) => {
    const intent = db.payment_intents.find((i) => i.validationToken === token.trim());
    if (!intent) {
      throw new BizumServiceError({
        code: "INVALID_TOKEN",
        statusCode: 404,
        message: "Token not found or already used.",
      });
    }

    if (intent.status === "PAID") {
      const event = db.events.find((e) => e.id === intent.eventId);
      return {
        alreadyPaid: true,
        intent: toPublicIntent(intent),
        qrPayloads: intent.qrPayloads ?? [],
        eventName: event?.name ?? intent.eventId,
        userEmail: intent.userKey,
        eventId: intent.eventId,
      };
    }

    if (intent.status === "REJECTED" || intent.status === "EXPIRED") {
      throw new BizumServiceError({
        code: "INVALID_STATUS",
        statusCode: 409,
        message: `El pago está en estado ${intent.status} y no puede procesarse.`,
        payload: { status: intent.status },
      });
    }

    const paidAt = nowIso();
    intent.status = "PAID";
    intent.paidAt = paidAt;
    intent.updatedAt = paidAt;
    intent.version += 1;
    intent.validationToken = undefined;

    const quantity = Math.max(1, intent.quantity || 1);
    const tickets = Array.from({ length: quantity }, (_, index) => generateTicket(intent, index));
    intent.ticketCodes = tickets.map((t) => t.ticketCode);
    intent.qrPayloads = tickets.map((t) => t.qrPayload);

    db.audit_logs.push(
      buildAuditLog({
        action: "MAGIC_LINK_PAID",
        actorType: "USER",
        actorKey: "magic-link",
        intentId: intent.id,
        eventId: intent.eventId,
        metadata: { ticketCount: intent.ticketCodes.length, quantity: intent.quantity },
      }),
    );

    const event = db.events.find((e) => e.id === intent.eventId);
    return {
      alreadyPaid: false,
      intent: toPublicIntent(intent),
      qrPayloads: intent.qrPayloads ?? [],
      eventName: event?.name ?? intent.eventId,
      userEmail: intent.userKey,
      eventId: intent.eventId,
    };
  });

  if (marked.alreadyPaid) {
    return { alreadyPaid: true as const, intent: marked.intent };
  }

  let emailDelivery: { attempted: number; sent: number; skipped: boolean; reason?: string } = {
    attempted: 0,
    sent: 0,
    skipped: true,
    reason: "No tickets to send.",
  };

  if ((marked.intent.ticketCodes?.length ?? 0) > 0) {
    try {
      emailDelivery = await sendTicketsByEmail({
        to: marked.userEmail,
        eventName: marked.eventName,
        paymentRef: marked.intent.paymentRef,
        amountCents: marked.intent.amountCents,
        currency: marked.intent.currency,
        ticketCodes: marked.intent.ticketCodes ?? [],
        qrPayloads: marked.qrPayloads,
      });
    } catch (error) {
      emailDelivery = {
        attempted: marked.intent.ticketCodes?.length ?? 0,
        sent: 0,
        skipped: false,
        reason: error instanceof Error ? error.message : "Unexpected email error.",
      };
    }
  }

  if (emailDelivery.sent > 0) {
    await withDbTransaction((db) => {
      const intent = db.payment_intents.find((i) => i.id === marked.intent.id);
      if (!intent) return;
      intent.ticketsEmailedAt = nowIso();
      intent.updatedAt = nowIso();
      intent.version += 1;
      db.audit_logs.push(
        buildAuditLog({
          action: "TICKETS_EMAIL_SENT",
          actorType: "SYSTEM",
          actorKey: "resend",
          intentId: intent.id,
          eventId: marked.eventId,
          metadata: { sent: emailDelivery.sent, attempted: emailDelivery.attempted },
        }),
      );
    });
  }

  return { alreadyPaid: false as const, intent: marked.intent, emailDelivery };
}
