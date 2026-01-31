"use server";

import { z } from "zod";

// Mock implementation of Resend for the starter kit
// In production, instantiate Resend with API key from ENV
// import { Resend } from 'resend';
// const resend = new Resend(process.env.RESEND_API_KEY);

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

const paymentSchema = z.object({
  amount: z.string(),
  reference: z.string(),
  proof: z.any().optional(), // In real implementation, handle file upload
});

export async function sendMessage(prevState: any, formData: FormData) {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const validatedFields = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: "Datos inválidos. Revisa el formulario.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // TODO: Implement actual email sending
  // await resend.emails.send({ ... })
  
  console.log("SENDING EMAIL:", validatedFields.data);

  return {
    success: true,
    message: "¡Mensaje enviado! Te responderemos pronto.",
  };
}

export async function submitPayment(prevState: any, formData: FormData) {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const rawData = {
      amount: formData.get('amount'),
      reference: formData.get('reference'),
  }
  
  // Basic validation
  if (!rawData.amount || !rawData.reference) {
      return { success: false, message: "Faltan datos obligatorios." };
  }

  // TODO: Send email to organizer with details
  console.log("PAYMENT NOTIFICATION:", rawData);

  return {
    success: true,
    message: "Notificación enviada. Verificaremos el Bizum en breve.",
  };
}
