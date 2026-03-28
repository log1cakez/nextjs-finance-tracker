/**
 * Password-reset and transactional email.
 *
 * Priority:
 * 1. Google / SMTP — set SMTP_USER, SMTP_PASS, and optionally SMTP_HOST (defaults to Gmail).
 * 2. Resend — RESEND_API_KEY + EMAIL_FROM.
 * 3. Development — logs to server console. Production without config returns an error.
 */

import nodemailer from "nodemailer";

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string } | null> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  const from = process.env.EMAIL_FROM?.trim() || user;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("SMTP send error:", msg);
    return {
      ok: false,
      error:
        "Could not send email. Check SMTP settings and use a Google App Password if you use Gmail with 2FA.",
    };
  }
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return null;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error:", res.status, body);
    return { ok: false, error: "Could not send email. Try again later." };
  }

  return { ok: true };
}

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const smtp = await sendViaSmtp(opts);
  if (smtp) {
    return smtp;
  }

  const resend = await sendViaResend(opts);
  if (resend) {
    return resend;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[email:dev] To:",
      opts.to,
      "\nSubject:",
      opts.subject,
      "\n---\n",
      opts.text,
      "\n---",
    );
    return { ok: true };
  }

  return {
    ok: false,
    error:
      "Email is not configured. Set SMTP_USER and SMTP_PASS (Gmail: App Password) or RESEND_API_KEY and EMAIL_FROM.",
  };
}
