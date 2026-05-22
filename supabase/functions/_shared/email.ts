// Email sending helper. Uses Resend when RESEND_API_KEY is configured.
// If no provider is configured, throws EMAIL_NOT_CONFIGURED so callers can
// surface a clear error rather than silently "succeeding".

export class EmailNotConfiguredError extends Error {
  code = "EMAIL_NOT_CONFIGURED";
  constructor() {
    super("Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  }
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; type?: string }[];
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string; provider: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "noreply@resend.dev";

  if (!resendKey) throw new EmailNotConfiguredError();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo,
      attachments: input.attachments,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return { id: data.id, provider: "resend" };
}

export function isEmailConfigured(): boolean {
  return !!Deno.env.get("RESEND_API_KEY");
}
