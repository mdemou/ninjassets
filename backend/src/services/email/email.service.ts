import config from '@config/config';
import logger from '@services/logger.service';
import nodemailer from 'nodemailer';
import { IEmailOptions } from './email.interface';

let transporter: nodemailer.Transporter | null = null;

if (config.email.host && !config.mockEmail) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

const emailService = {
  async sendMail(options: IEmailOptions): Promise<void> {
    if (!transporter) {
      logger.info(__filename, 'sendMail', `[EMAIL] To: ${options.to} | Subject: ${options.subject}`);
      logger.info(__filename, 'sendMail', `[EMAIL] Body: ${options.text}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      logger.error(__filename, 'sendMail', 'error', error);
      throw error;
    }
  },
};

export default emailService;
