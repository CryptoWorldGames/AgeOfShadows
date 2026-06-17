const nodemailer = require('nodemailer');

let transporter = null;

async function initializeEmailService() {
  if (transporter) return transporter;

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const gmailEmail = process.env.GMAIL_EMAIL;

  if (sendgridApiKey) {
    // Use SendGrid
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: sendgridApiKey
      }
    });
    console.log('[EMAIL] Using SendGrid service');
  } else if (gmailEmail && gmailPassword) {
    // Use Gmail
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailEmail,
        pass: gmailPassword
      }
    });
    console.log('[EMAIL] Using Gmail service');
  } else {
    // Use Ethereal (development testing service)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('[EMAIL] Using Ethereal test service (development mode)');
  }

  return transporter;
}

async function sendVerificationEmail(email, token) {
  try {
    const verificationLink = `${process.env.APP_URL || 'http://localhost:5173'}/verify?token=${token}&email=${encodeURIComponent(email)}`;

    if (process.env.SENDGRID_API_KEY || process.env.GMAIL_EMAIL) {
      // Production: actually send email
      const transport = await initializeEmailService();
      const info = await transport.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@ageofshadows.game',
        to: email,
        subject: 'Verify your Age of Shadows account',
        html: `
          <h2>Welcome to Age of Shadows!</h2>
          <p>Click the link below to verify your email address:</p>
          <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
          <p>Or use this token: <code>${token}</code></p>
          <p>This link expires in 10 minutes.</p>
        `
      });
      console.log(`[EMAIL] ✓ Verification email sent to ${email}`);
      return true;
    } else {
      // Development: log verification details
      console.log(`[EMAIL] 📧 DEVELOPMENT MODE - Email verification for: ${email}`);
      console.log(`[EMAIL] 🔑 Token: ${token}`);
      console.log(`[EMAIL] 🔗 Link: ${verificationLink}`);
      return true;
    }
  } catch (err) {
    console.error('[EMAIL] ❌ Error:', err.message);
    // Fallback: still allow registration, but user will see warning
    return true;
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  try {
    const resetLink = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    if (process.env.SENDGRID_API_KEY || process.env.GMAIL_EMAIL) {
      // Production: actually send email
      const transport = await initializeEmailService();
      const info = await transport.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@ageofshadows.game',
        to: email,
        subject: 'Reset your Age of Shadows password',
        html: `
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
          <p>Or use this token: <code>${resetToken}</code></p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
        `
      });
      console.log(`[EMAIL] ✓ Password reset email sent to ${email}`);
      return true;
    } else {
      // Development: log reset details
      console.log(`[EMAIL] 📧 DEVELOPMENT MODE - Password reset for: ${email}`);
      console.log(`[EMAIL] 🔑 Token: ${resetToken}`);
      console.log(`[EMAIL] 🔗 Link: ${resetLink}`);
      return true;
    }
  } catch (err) {
    console.error('[EMAIL] ❌ Error:', err.message);
    return true;
  }
}

function isEmailConfigured() {
  return !!(process.env.SENDGRID_API_KEY || (process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD));
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  isEmailConfigured
};
