import config from '@config/config';
import logger from '@services/logger.service';

const captchaService = {
  async validateCaptcha(token: string): Promise<boolean> {
    const secretKey = config.captcha.secretKey;
    if (config.mockCaptcha) {
      return true;
    }

    if (!secretKey) {
      return true;
    }

    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      });

      const data = (await response.json()) as { success?: boolean };
      return data.success === true;
    } catch (error) {
      logger.error(__filename, 'validateCaptcha', 'error', error);
      return false;
    }
  },
};

export default captchaService;
