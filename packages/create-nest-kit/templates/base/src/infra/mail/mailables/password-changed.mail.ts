import { Injectable } from '@nestjs/common';
import type { Mailable, MailTemplateContent } from '@nestjs/mail';
import { AppConfig } from '../../../config/app-config.js';

export interface PasswordChangedMailData {
  name: string;
}

/** Tells the owner of an account, in case it wasn't them. */
@Injectable()
export class PasswordChangedMail implements Mailable<PasswordChangedMailData> {
  constructor(private readonly config: AppConfig) {}

  render({ name }: PasswordChangedMailData): MailTemplateContent {
    const appName = this.config.get('APP_NAME');
    return {
      subject: `Your ${appName} password was changed`,
      template: 'password-changed',
      context: { name, appName },
    };
  }
}
