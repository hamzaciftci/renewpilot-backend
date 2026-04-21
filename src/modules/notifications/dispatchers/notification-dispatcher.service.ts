import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';

export interface DispatchPayload {
  to: {
    email?: string;
    phoneNumber?: string;
    fullName?: string;
  };
  channel: NotificationChannel;
  subject: string;
  body: string;
  html?: string;
}

export interface DispatchResult {
  success: boolean;
  providerMessageId?: string;
  providerName?: string;
  error?: string;
}

/**
 * Centralized dispatcher for all notification channels.
 * Supports: EMAIL (Resend), SMS (Twilio), WHATSAPP (Twilio), PUSH (FCM - stubbed)
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private twilioClient: any = null;

  constructor(private readonly config: ConfigService) {
    this.initTwilio();
  }

  private initTwilio(): void {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (sid && token) {
      try {
        // Lazy require to avoid init errors if package is missing in dev
        const twilio = require('twilio');
        this.twilioClient = twilio(sid, token);
        this.logger.log('Twilio client initialized');
      } catch (err: any) {
        this.logger.warn(`Twilio init failed: ${err.message}`);
      }
    } else {
      this.logger.warn('Twilio credentials not set — SMS/WhatsApp disabled');
    }
  }

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    switch (payload.channel) {
      case 'EMAIL':
        return this.dispatchEmail(payload);
      case 'SMS':
        return this.dispatchSms(payload);
      case 'WHATSAPP':
        return this.dispatchWhatsapp(payload);
      case 'PUSH':
        return this.dispatchPush(payload);
      default:
        return { success: false, error: `Unsupported channel: ${payload.channel}` };
    }
  }

  // ─── Email via Resend ─────────────────────────────────────────────────────
  private async dispatchEmail(payload: DispatchPayload): Promise<DispatchResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM') ?? 'RenewPilot <noreply@renewpilot.io>';

    if (!payload.to.email) {
      return { success: false, error: 'Email address missing' };
    }

    if (!apiKey) {
      this.logger.warn(`[EMAIL STUB] To: ${payload.to.email}, Subject: ${payload.subject}`);
      return { success: true, providerName: 'stub', providerMessageId: `stub-${Date.now()}` };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: payload.to.email,
          subject: payload.subject,
          html: payload.html ?? `<p>${payload.body}</p>`,
          text: payload.body,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        this.logger.error(`Resend failed (${res.status}): ${errBody}`);
        return { success: false, error: `Resend ${res.status}: ${errBody.slice(0, 200)}` };
      }

      const data: any = await res.json();
      return { success: true, providerName: 'resend', providerMessageId: data.id };
    } catch (err: any) {
      this.logger.error(`Email dispatch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── SMS via Twilio ───────────────────────────────────────────────────────
  private async dispatchSms(payload: DispatchPayload): Promise<DispatchResult> {
    if (!this.twilioClient) {
      this.logger.warn(`[SMS STUB] To: ${payload.to.phoneNumber}, Body: ${payload.body.slice(0, 80)}`);
      return { success: true, providerName: 'stub', providerMessageId: `sms-stub-${Date.now()}` };
    }

    if (!payload.to.phoneNumber) {
      return { success: false, error: 'Phone number missing' };
    }

    const from = this.config.get<string>('TWILIO_FROM_PHONE');
    if (!from) {
      return { success: false, error: 'TWILIO_FROM_PHONE not configured' };
    }

    try {
      const message = await this.twilioClient.messages.create({
        from,
        to: payload.to.phoneNumber,
        body: `${payload.subject}\n\n${payload.body}`.slice(0, 1500),
      });
      return { success: true, providerName: 'twilio', providerMessageId: message.sid };
    } catch (err: any) {
      this.logger.error(`SMS dispatch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── WhatsApp via Twilio ──────────────────────────────────────────────────
  private async dispatchWhatsapp(payload: DispatchPayload): Promise<DispatchResult> {
    if (!this.twilioClient) {
      this.logger.warn(`[WHATSAPP STUB] To: ${payload.to.phoneNumber}, Body: ${payload.body.slice(0, 80)}`);
      return { success: true, providerName: 'stub', providerMessageId: `wa-stub-${Date.now()}` };
    }

    if (!payload.to.phoneNumber) {
      return { success: false, error: 'Phone number missing' };
    }

    const from = this.config.get<string>('TWILIO_WHATSAPP_FROM');
    if (!from) {
      return { success: false, error: 'TWILIO_WHATSAPP_FROM not configured' };
    }

    try {
      const toNumber = payload.to.phoneNumber.startsWith('whatsapp:')
        ? payload.to.phoneNumber
        : `whatsapp:${payload.to.phoneNumber}`;

      const message = await this.twilioClient.messages.create({
        from,
        to: toNumber,
        body: `*${payload.subject}*\n\n${payload.body}`.slice(0, 1500),
      });
      return { success: true, providerName: 'twilio-whatsapp', providerMessageId: message.sid };
    } catch (err: any) {
      this.logger.error(`WhatsApp dispatch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── Push via FCM (stubbed) ───────────────────────────────────────────────
  private async dispatchPush(payload: DispatchPayload): Promise<DispatchResult> {
    this.logger.warn(`[PUSH STUB] ${payload.subject}`);
    return { success: true, providerName: 'stub', providerMessageId: `push-stub-${Date.now()}` };
  }
}
