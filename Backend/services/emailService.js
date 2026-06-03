require("dotenv").config();
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  FRONTEND_URL,
} = process.env;

const createTransporter = () => {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error(
      "Missing SMTP settings. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM in your environment."
    );
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true" || Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendMail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
};

const sendWelcomeEmail = async (user) => {
  const subject = "Welcome to Blood Donation System";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Welcome, ${user.name}!</h2>
      <p>Thank you for joining the Blood Donation System.</p>
      <p>Your account is now registered with the email <strong>${user.email}</strong>.</p>
      <p>As a ${user.role}, you can now access your dashboard and help save lives.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Welcome ${user.name}!\n\nThank you for joining the Blood Donation System. Your account is registered with ${user.email}.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: user.email, subject, html, text });
};

const sendVerificationEmail = async (user) => {
  const subject = "Hospital Account Verified";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Your hospital is verified</h2>
      <p>Hello ${user.name},</p>
      <p>Your hospital account has been verified by the admin team.</p>
      <p>You can now log in and start managing blood requests.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Hello ${user.name},\n\nYour hospital account has been verified by the admin team. You can now log in and start managing blood requests.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: user.email, subject, html, text });
};

const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  const subject = "Password Reset Request";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Password Reset Requested</h2>
      <p>Hello ${user.name},</p>
      <p>We received a request to reset your password for the email <strong>${user.email}</strong>.</p>
      <p>Click the link below to reset your password. This link is valid for 1 hour.</p>
      <p><a href="${resetUrl}" style="color: #1a73e8;">Reset your password</a></p>
      <p>If you did not request this, please ignore this message.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Hello ${user.name},\n\nWe received a request to reset your password for ${user.email}. Use the link below to reset your password. This link is valid for 1 hour.\n\n${resetUrl}\n\nIf you did not request this, please ignore this message.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: user.email, subject, html, text });
};

const sendRejectionEmail = async (user) => {
  const subject = "Hospital Registration Rejected";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Registration Not Approved</h2>
      <p>Hello ${user.name},</p>
      <p>We reviewed your hospital registration and, unfortunately, it was not approved.</p>
      <p>If you believe this is a mistake, please contact support.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Hello ${user.name},\n\nWe reviewed your hospital registration and, unfortunately, it was not approved. If you believe this is a mistake, please contact support.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: user.email, subject, html, text });
};

const sendAccountBlockedEmail = async (user) => {
  const subject = "Account Blocked";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Your account has been blocked</h2>
      <p>Hello ${user.name},</p>
      <p>Your account has been blocked by the admin team. If you think this is an error, please contact support.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Hello ${user.name},\n\nYour account has been blocked by the admin team. If you think this is an error, please contact support.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: user.email, subject, html, text });
};

const sendAccountUnblockedEmail = async (user) => {
  const subject = "Account Restored";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Your account has been restored</h2>
      <p>Hello ${user.name},</p>
      <p>Your account has been unblocked and you can now access the system.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Hello ${user.name},\n\nYour account has been unblocked and you can now access the system.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: user.email, subject, html, text });
};

const sendDonationCompletedEmail = async (donor, request) => {
  const subject = "Donation Completed - Thank You";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Thank you for donating</h2>
      <p>Hello ${donor.name},</p>
      <p>Thank you for completing your donation for request <strong>${request._id}</strong> at hospital <strong>${request.hospitalId}</strong>.</p>
      <p>You are now ineligible to donate for 90 days.</p>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Hello ${donor.name},\n\nThank you for completing your donation for request ${request._id} at the hospital. You are now ineligible to donate for 90 days.\n\nBest regards,\nBlood Donation System Team`;

  return sendMail({ to: donor.email, subject, html, text });
};

const sendWeeklyAnalyticsEmail = async (recipient, stats) => {
  const subject = "Weekly Blood Donation Analytics";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Weekly Analytics</h2>
      <p>Hello ${recipient.name || 'Admin'},</p>
      <p>Here are the key metrics for the past week:</p>
      <ul>
        <li>Total Donors: ${stats.totalDonors}</li>
        <li>Total Hospitals: ${stats.totalHospitals}</li>
        <li>Total Requests: ${stats.totalRequests}</li>
        <li>Completed Requests: ${stats.completedRequests}</li>
        <li>Most Requested Blood Group: ${stats.mostRequestedBloodGroup}</li>
      </ul>
      <p>Best regards,<br/>Blood Donation System Team</p>
    </div>
  `;
  const text = `Weekly Analytics:\n\nTotal Donors: ${stats.totalDonors}\nTotal Hospitals: ${stats.totalHospitals}\nTotal Requests: ${stats.totalRequests}\nCompleted Requests: ${stats.completedRequests}\nMost Requested Blood Group: ${stats.mostRequestedBloodGroup}\n`;

  return sendMail({ to: recipient.email, subject, html, text });
};

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendRejectionEmail,
  sendAccountBlockedEmail,
  sendAccountUnblockedEmail,
  sendDonationCompletedEmail,
  sendWeeklyAnalyticsEmail,
};
