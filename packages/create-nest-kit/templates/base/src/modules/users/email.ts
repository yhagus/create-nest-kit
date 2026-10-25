/** Emails are compared and stored in this form, so `Ada@Example.com ` and `ada@example.com` are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
