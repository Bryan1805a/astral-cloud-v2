export interface EmailProvider {
  sendEmail(to: string, subject: string, html: string, text?: string): Promise<void>;
}

export class MockEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    console.log(`[email:mock] To: ${to} | Subject: ${subject}`);
    void html; void text;
  }
}

export class SmtpEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    console.log(`[email:smtp] Would send to ${to}: ${subject}`);
    void html; void text;
  }
}

export class SendGridEmailProvider implements EmailProvider {
  private sgApiKey: string;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.sgApiKey = apiKey;
    this.from = from;
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    const sgMod = await import("@sendgrid/mail");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sg = (sgMod as any).default || sgMod;
    sg.setApiKey(this.sgApiKey);
    await sg.send({ to, from: this.from, subject, html, text: text || undefined });
  }
}

export function createEmailProvider(): EmailProvider {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM || "noreply@astral.cloud";

  if (apiKey && apiKey !== "SG.placeholder") {
    console.log("[email] Using SendGrid provider");
    return new SendGridEmailProvider(apiKey, from);
  }

  console.log("[email] Using mock provider (no SENDGRID_API_KEY configured)");
  return new MockEmailProvider();
}

let _emailProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!_emailProvider) _emailProvider = createEmailProvider();
  return _emailProvider;
}

function htmlTemplate(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#111;color:#e5e5e5;padding:24px"><div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:32px;border:1px solid #333"><h1 style="color:#fff;font-size:20px;margin:0 0 16px">${title}</h1>${body}<hr style="border-color:#333;margin:24px 0"><p style="color:#666;font-size:12px">Astral Cloud · Production-grade cloud hosting</p></div></body></html>`;
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/verify-email?token=${token}`;
  const provider = getEmailProvider();
  await provider.sendEmail(email, "Verify your email — Astral Cloud",
    htmlTemplate("Verify your email address", `<p style="color:#ccc">Click the button below to verify your email address.</p><a href="${link}" style="display:inline-block;background:#fff;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Verify Email</a><p style="color:#888;font-size:13px">Or copy this link: ${link}</p>`));
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  const provider = getEmailProvider();
  await provider.sendEmail(email, "Reset your password — Astral Cloud",
    htmlTemplate("Password Reset Request", `<p style="color:#ccc">Click the button below to reset your password. This link expires in 15 minutes.</p><a href="${link}" style="display:inline-block;background:#fff;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a><p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`));
}

export async function sendTicketNotification(email: string, ticketSubject: string, action: string): Promise<void> {
  const provider = getEmailProvider();
  await provider.sendEmail(email, `[Ticket] ${action} — ${ticketSubject}`,
    htmlTemplate("Ticket Update", `<p style="color:#ccc">Your support ticket <strong>"${escapeHtml(ticketSubject)}"</strong> has been ${action.toLowerCase()}.</p>`));
}

export async function sendServerNotification(email: string, hostname: string, action: string): Promise<void> {
  const provider = getEmailProvider();
  await provider.sendEmail(email, `[Server] ${action} — ${hostname}`,
    htmlTemplate("Server Update", `<p style="color:#ccc">Your server <strong>${escapeHtml(hostname)}</strong> has been ${action.toLowerCase()}.</p>`));
}

export async function sendPaymentNotification(email: string, action: string, amount: string): Promise<void> {
  const provider = getEmailProvider();
  await provider.sendEmail(email, `[Billing] ${action}`,
    htmlTemplate("Payment Update", `<p style="color:#ccc">A payment of <strong>$${amount}</strong> has been ${action.toLowerCase()}.</p>`));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
