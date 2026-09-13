import "server-only";
import { Resend } from "resend";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured");

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Reset your Our Sweet Universe password",
    text: `A password reset was requested for Our Sweet Universe.\n\nChoose a new password here: ${url}\n\nThis link expires in one hour. If you did not request it, you can safely ignore this email.`,
    html: `<main style="font-family:Arial,sans-serif;color:#4b2c3d;line-height:1.6"><h1 style="font-family:Georgia,serif">Find your way back.</h1><p>A password reset was requested for <strong>Our Sweet Universe</strong>.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#b33d6c;color:#fff;text-decoration:none;font-weight:700">Choose a new password</a></p><p>This link expires in one hour. If you did not request it, you can safely ignore this email.</p></main>`,
  });

  if (error) throw new Error("Password reset email could not be sent");
}

export async function sendEmailVerification({ to, name, url }: { to: string; name: string; url: string }) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Confirm your Our Sweet Universe email",
    text: `Hi ${name},\n\nConfirm this email to open your private Our Sweet Universe space: ${url}\n\nThis link expires in one hour. If you did not create this account, you can safely ignore this email.`,
    html: `<main style="font-family:Arial,sans-serif;color:#4b2c3d;line-height:1.6"><h1 style="font-family:Georgia,serif">One little confirmation.</h1><p>Hi ${name}, confirm this email to open your private <strong>Our Sweet Universe</strong> space.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#b33d6c;color:#fff;text-decoration:none;font-weight:700">Confirm my email</a></p><p>This link expires in one hour. If you did not create this account, you can safely ignore this email.</p></main>`,
  });
  if (error) throw new Error("Email verification could not be sent");
}

export async function sendCleanupCode({ to, code }: { to: string; code: string }) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Your Our Sweet Universe cleanup code",
    text: `Your confirmation code is ${code}. It expires in 10 minutes. Do not share it with anyone.`,
    html: `<main style="font-family:Arial,sans-serif;color:#4b2c3d;line-height:1.6"><h1 style="font-family:Georgia,serif">One careful step.</h1><p>Your test-data cleanup code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:5px">${code}</p><p>It expires in 10 minutes. Do not share it with anyone.</p></main>`,
  });
  if (error) throw new Error("Cleanup code could not be sent");
}

export async function sendLittleQuestionReminder({ to }: { to: string }) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured");
  const origin = process.env.BETTER_AUTH_URL;
  if (!origin) throw new Error("The app URL is not configured");
  const url = new URL("/space/questions", origin).toString();
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "A little thought is still waiting",
    text: `There is still room for your answer in Our Sweet Universe.\n\nOpen today’s little question: ${url}\n\nAfter noon, you and your person can choose whether to let this one rest.`,
    html: `<main style="font-family:Arial,sans-serif;color:#4b2c3d;line-height:1.6"><h1 style="font-family:Georgia,serif">A little time remains.</h1><p>There is still room for your answer in <strong>Our Sweet Universe</strong>.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#b33d6c;color:#fff;text-decoration:none;font-weight:700">Open today’s question</a></p><p>After noon, you and your person can choose whether to let this one rest.</p></main>`,
  });
  if (error) throw new Error("Little question reminder email could not be sent");
}
