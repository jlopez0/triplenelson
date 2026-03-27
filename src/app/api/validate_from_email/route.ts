import { NextRequest, NextResponse } from "next/server";
import { markPaidByToken, BizumServiceError } from "@/lib/bizum/service";

export const runtime = "nodejs";

function htmlPage(title: string, body: string, success = false): NextResponse {
  const color = success ? "#34d399" : "#f87171";
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Triple Nelson</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #09090b; color: #e4e4e7; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { max-width: 480px; width: 100%; padding: 40px 36px; border: 1px solid #27272a; border-radius: 16px; text-align: center; }
    h1 { font-size: 22px; margin-bottom: 14px; color: ${color}; }
    p { color: #a1a1aa; line-height: 1.6; font-size: 15px; }
    .tag { display: inline-block; margin-top: 24px; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <span class="tag">Triple Nelson · Sistema de tickets</span>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return htmlPage("Enlace inválido", "Este enlace no contiene un token válido. Puede que haya caducado o ya haya sido utilizado.");
  }

  try {
    const result = await markPaidByToken(token);

    if (result.alreadyPaid) {
      return htmlPage(
        "Ya procesado",
        "Este pago ya había sido marcado como pagado anteriormente. Las entradas fueron enviadas al comprador por email.",
        true,
      );
    }

    const emailNote =
      result.emailDelivery && result.emailDelivery.sent > 0
        ? "Las entradas han sido enviadas al comprador por email."
        : "Pago registrado correctamente. El envío de entradas puede estar pendiente.";

    return htmlPage("✓ Pago confirmado", emailNote, true);
  } catch (error) {
    if (error instanceof BizumServiceError) {
      if (error.code === "INVALID_TOKEN") {
        return htmlPage(
          "Enlace no válido",
          "Este enlace ya fue utilizado o no es válido. Si el pago ya fue procesado, las entradas están en camino.",
        );
      }
      if (error.code === "INVALID_STATUS") {
        return htmlPage(
          "No disponible",
          `El pago no puede procesarse desde su estado actual. Contacta con el organizador si crees que es un error.`,
        );
      }
    }
    console.error("[validate_from_email] Error inesperado:", error);
    return htmlPage("Error", "Ha ocurrido un error inesperado. Contacta con el organizador.");
  }
}
