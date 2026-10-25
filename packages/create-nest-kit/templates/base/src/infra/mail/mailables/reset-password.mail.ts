import { Injectable } from '@nestjs/common';
import type { Mailable, MailTemplateContent } from '@nestjs/mail';
import { AppConfig } from '../../../config/app-config.js';
import { webAppLink } from './web-app-link.js';

export interface ResetPasswordMailData {
  name: string;
  /** The raw reset token; only its hash is stored. */
  token: string;
}

@Injectable()
export class ResetPasswordMail implements Mailable<ResetPasswordMailData> {
  constructor(private readonly config: AppConfig) {}

  render({ name, token }: ResetPasswordMailData): MailTemplateContent {
    const appName = this.config.get('APP_NAME');
    return {
      subject: `Reset your ${appName} password`,
      template: 'reset-password',
      context: { name, appName, link: webAppLink(this.config, '/reset-password', { token }) },
    };
  }
}
