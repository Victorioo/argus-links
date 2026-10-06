// Base URL used inside emailed links. Deliberately NOT derived from the
// incoming request's Host header, which an attacker could spoof to get a
// reset link pointing at their own domain sent from our address.
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

type Mail = { to: string; subject: string; html: string; text: string };

export async function sendEmail(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("RESEND_API_KEY is not set; email not sent");
    } else {
      console.log(`[email:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    }
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Report Hub <noreply@argusppc.com>",
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Resend error ${res.status}: ${detail}`);
  }
}

export function verificationEmail(name: string, link: string): Pick<Mail, "subject" | "html" | "text"> {
  const safeName = name.replace(/[<>&"]/g, "");
  return {
    subject: "Confirmá tu email en Report Hub",
    text: `Hola ${safeName},\n\nGracias por registrarte en Report Hub. Abrí este link para confirmar tu email y activar tu cuenta (vence en 24 horas):\n\n${link}\n\nSi no creaste una cuenta, ignorá este mensaje.`,
    html: `<!doctype html>
<html lang="es"><body style="margin:0;background:#0B0714;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#131022;border:1px solid #2A2340;border-radius:22px;padding:32px;color:#F3F0FA;">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#F0B94D;margin-bottom:14px;">Report Hub</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Confirmá tu email</h1>
    <p style="color:#A79FC2;font-size:15px;line-height:1.5;margin:0 0 24px;">Hola ${safeName}, gracias por registrarte. Confirmá tu email para activar tu cuenta. El link vence en 24 horas.</p>
    <a href="${link}" style="display:inline-block;background:#7C3AED;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px;">Confirmar email</a>
    <p style="color:#6E6488;font-size:13px;line-height:1.5;margin:24px 0 0;">Si no creaste una cuenta, ignorá este mensaje.</p>
  </div>
</body></html>`,
  };
}

export function passwordResetEmail(name: string, link: string): Pick<Mail, "subject" | "html" | "text"> {
  const safeName = name.replace(/[<>&"]/g, "");
  return {
    subject: "Restablecer tu contraseña de Report Hub",
    text: `Hola ${safeName},\n\nRecibimos un pedido para restablecer tu contraseña de Report Hub. Abrí este link para elegir una nueva (vence en 1 hora y se puede usar una sola vez):\n\n${link}\n\nSi no fuiste vos, ignorá este mensaje: tu contraseña actual sigue funcionando.`,
    html: `<!doctype html>
<html lang="es"><body style="margin:0;background:#0B0714;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#131022;border:1px solid #2A2340;border-radius:22px;padding:32px;color:#F3F0FA;">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#F0B94D;margin-bottom:14px;">Report Hub</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Restablecer contraseña</h1>
    <p style="color:#A79FC2;font-size:15px;line-height:1.5;margin:0 0 24px;">Hola ${safeName}, recibimos un pedido para restablecer tu contraseña. El link vence en 1 hora y se puede usar una sola vez.</p>
    <a href="${link}" style="display:inline-block;background:#7C3AED;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px;">Elegir nueva contraseña</a>
    <p style="color:#6E6488;font-size:13px;line-height:1.5;margin:24px 0 0;">Si no fuiste vos, ignorá este mensaje: tu contraseña actual sigue funcionando.</p>
  </div>
</body></html>`,
  };
}
