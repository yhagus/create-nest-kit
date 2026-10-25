import { LogMailTransport, type MailTransport, ResendTransport, SmtpTransport } from '@nestjs/mail';
import type { AppConfig } from '../../config/app-config.js';

/** The transport MAIL_TRANSPORT selects. */
export function createMailTransport(config: AppConfig): MailTransport {
  switch (config.get('MAIL_TRANSPORT')) {
    case 'smtp':
      return new SmtpTransport({ url: required(config.get('SMTP_URL'), 'SMTP_URL') });
    case 'resend':
      return new ResendTransport({
        apiKey: required(config.get('RESEND_API_KEY'), 'RESEND_API_KEY'),
      });
    case 'log':
      return new LogMailTransport();
  }
}

/** The env schema already rejects a missing setting; this narrows the type. */
function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`${key} is required for MAIL_TRANSPORT`);
  return value;
}
