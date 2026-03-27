# TRIPLE NELSON - CLAUDE.md

Plataforma de ticketing para el evento privado **TRIPLE NELSON** (20 junio 2026). Venta de entradas via Bizum P2P con verificación manual por admin y envío de tickets por email con PDF + QR.

---

## Stack

- **Next.js 14** (App Router, Server Actions)
- **TypeScript**
- **Tailwind CSS** + Framer Motion (tema oscuro techno)
- **Resend** — envío de emails con tickets PDF
- **pdf-lib + qrcode** — generación de PDFs con QR
- **React Hook Form + Zod** — validación de formularios
- **JSON file DB** — persistencia en `data/bizum-db.json` con file locking

---

## Estructura clave

```
src/app/
  page.tsx              # Home: hero, countdown, prize board, lineup marquee
  aportar/page.tsx      # Checkout Bizum (crear intent, confirmar pago)
  admin/page.tsx        # Panel admin (verificar y marcar pagos)
  faqs/, lineup/, fotos/, contacto/  # Páginas informativas

src/app/api/
  create_intent/        # POST: crear intent de pago
  confirm_sent/         # POST: usuario confirma que envió Bizum
  mark_paid/            # POST: admin marca como pagado → genera tickets → envía email
  reject/               # POST: admin rechaza intent
  expire_intents/       # GET: cron job para expirar intents vencidos
  intents/[intentId]/   # GET: estado del intent (para polling)
  admin/intents/        # GET: listar intents (solo admin)
  admin/receivers/      # GET: listar receptores Bizum
  admin/test_email/     # POST: enviar email de prueba

src/lib/bizum/
  service.ts            # Lógica core (~800 líneas): CRUD intents, generación tickets, emails
  store.ts              # Persistencia JSON con file locking y seeding inicial
  types.ts              # Interfaces TypeScript
  http.ts               # Auth helpers y error handlers
  rate-limit.ts         # Rate limiting en memoria

content/
  prizes.json           # 5 hitos de premios con timestamps
  faqs.json             # 4 preguntas frecuentes
```

---

## Flujo de pago

```
CREATED → USER_CONFIRMED → PAID   (→ tickets generados + emails enviados)
                         → REJECTED
CREATED → EXPIRED  (automático a los 30 min via cron)
```

1. Usuario pide intent (email + cantidad) → recibe teléfono receptor + ref de pago
2. Usuario envía Bizum manualmente con la ref como concepto
3. Usuario confirma "ya envié" → status `USER_CONFIRMED`
4. Admin ve los intents pendientes y verifica en Bizum
5. Admin marca pagado → se generan N ticket codes, se envían emails con PDF+QR

---

## Configuración (`.env.local`)

```bash
RESEND_API_KEY=re_*****
BIZUM_EMAIL_FROM="Triple Nelson <tickets@triplenelson.com>"
BIZUM_EVENT_ID=triple-nelson-2026
BIZUM_EVENT_NAME=TRIPLE NELSON PRIVATE EVENT
BIZUM_FIXED_PRICE_EUR=25         # precio por entrada en €
BIZUM_INTENT_TTL_MINUTES=30
BIZUM_RECEIVER_1=689375753       # teléfonos Bizum receptores
BIZUM_RECEIVER_2=645342250
BIZUM_RECEIVER_3=616900446
BIZUM_CONTACT_EMAIL=organizacion@triplenelson.es
BIZUM_ADMIN_TOKEN=change-this-admin-token
BIZUM_CRON_TOKEN=change-this-cron-token
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Auth

- **Admin**: header `x-admin-token` o `Authorization: Bearer TOKEN`
  - Alternativa: Basic Auth con `BIZUM_ADMIN_USER` / `BIZUM_ADMIN_PASSWORD`
- **Cron**: parámetro `?token=CRON_TOKEN`
- **Usuarios**: anónimos, identificados solo por email normalizado

---

## Base de datos

Fichero JSON en `data/bizum-db.json`. Estructura:
- `intents[]` — PaymentIntent
- `events[]` — BizumEvent (evento activo)
- `receivers[]` — Receptores Bizum con load balancing
- `audit_logs[]` — Trazabilidad completa de acciones

El store usa file locking (reintentos cada 40ms, timeout 5s) y escritura atómica via fichero temporal + rename.

---

## Modelos clave

**PaymentIntent:**
```typescript
{
  id: string              // "pi_" + 24 chars
  userKey: string         // email normalizado
  paymentRef: string      // "TN" + 8 hex chars (concepto Bizum)
  quantity: number        // 1-10 entradas
  receiverId: string      // receptor asignado
  receiverPhone: string
  amountCents: number
  status: "CREATED" | "USER_CONFIRMED" | "PAID" | "REJECTED" | "EXPIRED"
  ticketCodes?: string[]  // "TN-" + 10 hex chars, uno por entrada
  version: number         // optimistic locking
}
```

---

## Scripts

```bash
npm run dev          # servidor dev
npm run build        # build producción
npm run test:email -- destino@correo.com   # probar envío email con Resend
```

---

## Tareas pendientes (tareas.md)

- [ ] Cambiar precio a 16€ (actualmente 25€ en `.env`)
- [ ] Mandar un solo mail con todos los PDFs en lugar de uno por entrada
- [ ] Cambiar nombre del fichero PDF a algo más legible
- [ ] Añadir user/password para validar (autenticación usuarios?)
- [ ] Verificar integridad de la DB
- [ ] Mandar mail al receptor correcto cuando se le pague
- [ ] Añadir UFO clásico pasando (elemento visual en la home)
