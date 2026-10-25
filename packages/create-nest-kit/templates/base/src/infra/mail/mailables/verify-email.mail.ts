import { Injectable } from '@nestjs/common';
import type { Mailable, MailTemplateContent } from '@nestjs/mail';
import { AppConfig } from '../../../config/app-config.js';
import { webAppLink } from './web-app-link.js';

export interface VerifyEmailMailData {
  name: string;
  /** The raw verification token; only its hash is stored. */
  token: string;
}

@Injectable()
export class VerifyEmailMail implements Mailable<VerifyEmailMailData> {
  constructor(private readonly config: AppConfig) {}

  render({ name, token }: VerifyEmailMailData): MailTemplateContent {
    const appName = this.config.get('APP_NAME');
    return {
      subject: `Verify your email address for ${appName}`,
      template: 'verify-email',
      context: { name, appName, link: webAppLink(this.config, '/verify-email', { token }) },
    };
  }
}
