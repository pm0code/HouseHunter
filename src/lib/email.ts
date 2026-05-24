import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === 'true',
  auth:
    process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

const FROM = process.env.SMTP_FROM ?? 'HouseHunter <noreply@househunter.local>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@househunter.local';

export async function sendSubmissionConfirmation(opts: {
  to: string;
  landlordName: string;
  address: string;
  submissionToken: string;
}) {
  const editUrl = `${APP_URL}/edit/${opts.submissionToken}`;
  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: 'Your listing has been received — HouseHunter',
    text: [
      `Hi ${opts.landlordName},`,
      '',
      `Thanks for submitting your listing at ${opts.address}.`,
      'Our team will review it shortly and notify you when it goes live.',
      '',
      `To edit or remove your listing, use this private link:`,
      editUrl,
      '',
      'Keep this email — it is the only way to manage your listing.',
      '',
      '— HouseHunter',
    ].join('\n'),
  });
}

export async function sendAdminApprovalRequest(opts: {
  listingId: string;
  address: string;
  landlordName: string;
  pricePerMonth: number;
  approvalToken: string;
}) {
  const approveUrl = `${APP_URL}/api/approve/${opts.approvalToken}`;
  const rejectUrl = `${APP_URL}/api/reject/${opts.approvalToken}`;
  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New listing pending review: ${opts.address}`,
    text: [
      `New listing submitted by ${opts.landlordName}`,
      `Address: ${opts.address}`,
      `Price: $${opts.pricePerMonth}/month`,
      `Listing ID: ${opts.listingId}`,
      '',
      `APPROVE: ${approveUrl}`,
      `REJECT:  ${rejectUrl}`,
    ].join('\n'),
  });
}

export async function sendListingLive(opts: {
  to: string;
  landlordName: string;
  address: string;
  listingId: string;
  submissionToken: string;
}) {
  const listingUrl = `${APP_URL}/?listing=${opts.listingId}`;
  const editUrl = `${APP_URL}/edit/${opts.submissionToken}`;
  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: 'Your listing is live — HouseHunter',
    text: [
      `Hi ${opts.landlordName},`,
      '',
      `Your listing at ${opts.address} is now live on HouseHunter.`,
      '',
      `View your listing: ${listingUrl}`,
      `Edit or remove your listing: ${editUrl}`,
      '',
      '— HouseHunter',
    ].join('\n'),
  });
}

export async function sendRejectionNotice(opts: {
  to: string;
  landlordName: string;
  address: string;
}) {
  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: 'Your listing was not approved — HouseHunter',
    text: [
      `Hi ${opts.landlordName},`,
      '',
      `After review, your listing at ${opts.address} was not approved.`,
      'If you believe this is an error, reply to this email.',
      '',
      '— HouseHunter',
    ].join('\n'),
  });
}
