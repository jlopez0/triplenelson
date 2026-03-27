import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const to = process.argv[2];
if (!to) {
  console.error('Uso: npm run test:email -- destino@correo.com');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.BIZUM_EMAIL_FROM;
if (!apiKey || !from) {
  console.error('Falta RESEND_API_KEY o BIZUM_EMAIL_FROM en .env.local');
  process.exit(1);
}

const resend = new Resend(apiKey);

try {
  const response = await resend.emails.send({
    from,
    to,
    subject: '[TRIPLE NELSON] Test envio directo',
    html: `<p>Test de envio directo OK (${new Date().toISOString()})</p>`,
  });

  if (response.error) {
    console.error('Error de Resend:', response.error.message || response.error);
    process.exit(1);
  }

  console.log('Email enviado OK. id =', response.data?.id ?? '(sin id)');
} catch (error) {
  console.error('Fallo enviando email:', error?.message || error);
  process.exit(1);
}
