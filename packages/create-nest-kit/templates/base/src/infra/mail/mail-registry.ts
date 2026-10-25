import { PasswordChangedMail } from './mailables/password-changed.mail.js';
import { ResetPasswordMail } from './mailables/reset-password.mail.js';
import { VerifyEmailMail } from './mailables/verify-email.mail.js';

/**
 * Every mail the app sends, by the name a queued job refers to it with. Jobs store the
 * name rather than the class, so they survive a restart. Add new Mailables here.
 */
export const MAILABLES = {
  'verify-email': VerifyEmailMail,
  'reset-password': ResetPasswordMail,
  'password-changed': PasswordChangedMail,
} as const;

export type MailName = keyof typeof MAILABLES;

/** The data a mail's `render()` takes. */
export type MailDataOf<Name extends MailName> = Parameters<
  InstanceType<(typeof MAILABLES)[Name]>['render']
>[0];
