import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { requireAdmin, toErrorResponse } from "@/lib/bizum/http";
import { BizumServiceError } from "@/lib/bizum/service";

export const runtime = "nodejs";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseDataUrlBase64(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = (await request.json()) as { to?: string };
    const to = (body.to ?? "").trim().toLowerCase();

    if (!isValidEmail(to)) {
      throw new BizumServiceError({
        code: "INVALID_EMAIL",
        statusCode: 400,
        message: "Email destinatario no valido.",
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.BIZUM_EMAIL_FROM;
    if (!apiKey || !from) {
      throw new BizumServiceError({
        code: "EMAIL_NOT_CONFIGURED",
        statusCode: 400,
        message: "Falta configurar RESEND_API_KEY o BIZUM_EMAIL_FROM.",
      });
    }

    const resend = new Resend(apiKey);
    const ticketCode = `TEST-${Date.now().toString().slice(-6)}`;
    const qrPayload = JSON.stringify({
      ticketCode,
      type: "TEST_EMAIL",
      to,
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 320, margin: 1 });

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const qrImage = await pdf.embedPng(parseDataUrlBase64(qrDataUrl));
    page.drawText("TRIPLE NELSON - TEST PDF", { x: 50, y: 790, size: 20, font });
    page.drawText(`Codigo: ${ticketCode}`, { x: 50, y: 775, size: 12, font });
    page.drawText(`Destinatario: ${to}`, { x: 50, y: 760, size: 12, font });
    page.drawText(`Fecha: ${new Date().toLocaleString("es-ES")}`, { x: 50, y: 740, size: 12, font });
    page.drawImage(qrImage, { x: 50, y: 470, width: 220, height: 220 });
    const pdfBytes = await pdf.save();

    const result = await resend.emails.send({
      from,
      to,
      subject: "[TRIPLE NELSON] Test de envio",
      text: "Test de envio con PDF adjunto.",
      html: `
        <div style="font-family:Arial,sans-serif;color:#111">
          <h2>Test de envio OK</h2>
          <p>Si lees esto, Resend esta configurado correctamente en tu app.</p>
          <p>Adjuntamos un PDF de prueba.</p>
          <p>Fecha: ${new Date().toLocaleString("es-ES")}</p>
        </div>
      `,
      attachments: [
        {
          filename: "test-ticket.pdf",
          content: Buffer.from(pdfBytes),
          content_type: "application/pdf",
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      id: result.data?.id ?? null,
      to,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
