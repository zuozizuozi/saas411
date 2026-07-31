/**
 * Email Templates
 *
 * All email templates and utilities for seedance.co
 */

export { EmailOtpEmail } from "./email-otp-email";
export { WelcomeEmail } from "./welcome-email";
export { ResetPasswordEmail } from "./reset-password-email";
export {
  getEmailTranslations,
  getSiteConfig,
  renderWelcomeEmail,
  renderResetPasswordEmail,
  sendWelcomeEmail,
  sendResetPasswordEmail,
} from "./utils";
