import { calculateNextDueDate } from '../domain/billing';

// Decrements family balance and marks pending donations as paid, oldest
// first, up to the payment amount. Called after a payment/receipt is
// recorded (cash, manual, or gateway) to reconcile a family's recurring
// donation dues.
export async function processPaymentDues(payment: any) {
  const { Member } = await import('../models/Member');
  const { Family } = await import('../models/Family');
  const { Donation } = await import('../models/Donation');

  let familyId = payment.familyId;

  if (!familyId && payment.paidForId) {
    const member = await Member.findById(payment.paidForId).lean();
    if (member?.familyId) {
      familyId = member.familyId;
    }
  }

  if (!familyId && payment.paidById) {
    const member = await Member.findById(payment.paidById).lean();
    if (member?.familyId) {
      familyId = member.familyId;
    }
  }

  if (!familyId) return;

  const family = await Family.findById(familyId);
  if (!family) return;

  let remainingAmount = payment.amount;

  // Find pending donations in chronological order
  const pendingDonations = await Donation.find({
    familyId: family._id,
    status: 'pending'
  }).sort({ createdAt: 1 });

  for (const donation of pendingDonations) {
    if (remainingAmount <= 0) break;

    if (remainingAmount >= donation.amount) {
      await Donation.findByIdAndUpdate(donation._id, { status: 'paid', paymentId: payment._id });
      remainingAmount -= donation.amount;
    }
  }

  // Update family outstanding balance & last payment date
  const currentBalance = family.outstandingBalance || 0;
  const newBalance = Math.max(0, currentBalance - payment.amount);
  family.outstandingBalance = newBalance;
  family.lastPaymentDate = new Date();

  // If balance is cleared (or paid in full), advance next payment due date to next cycle
  if (newBalance === 0 && family.recurringDonationType && family.recurringDonationType !== 'none') {
    family.nextPaymentDueDate = calculateNextDueDate(
      family.recurringDonationType,
      family.recurringPaymentDay || 1,
      family.recurringPaymentMonth || 1,
      new Date()
    );
  }

  await family.save();
}
