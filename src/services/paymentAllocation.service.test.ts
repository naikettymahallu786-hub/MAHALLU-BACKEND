// Characterization/integration test for processPaymentDues, run against a
// dedicated test database (see src/__tests__/setup.ts). Originally pointed
// at its pre-move location (src/routes/payment.routes.ts) to establish a
// passing baseline before Task 1.3 moved the implementation here — all
// assertions below are unchanged from that baseline run.
import mongoose from 'mongoose';
import { processPaymentDues } from './paymentAllocation.service';
import { Family } from '../models/Family';
import { Member } from '../models/Member';
import { Donation } from '../models/Donation';

function objectId() {
  return new mongoose.Types.ObjectId();
}

const baseAddress = {
  line1: '123 Main St',
  city: 'Kochi',
  district: 'Ernakulam',
  pincode: '682001',
};

async function createFamily(overrides: Partial<Record<string, unknown>> = {}) {
  const tenantId = objectId();
  return Family.create({
    tenantId,
    familyCode: `FAM-${Math.random().toString(36).slice(2, 8)}`,
    address: baseAddress,
    outstandingBalance: 1000,
    ...overrides,
  });
}

describe('processPaymentDues', () => {
  it('resolves familyId directly from payment.familyId and decrements the balance', async () => {
    const family = await createFamily({ outstandingBalance: 1000 });

    await processPaymentDues({ _id: objectId(), amount: 400, familyId: family._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(600);
    expect(updated!.lastPaymentDate).toBeInstanceOf(Date);
  });

  it('resolves familyId via payment.paidForId -> Member.familyId when familyId is absent', async () => {
    const family = await createFamily({ outstandingBalance: 1000 });
    const member = await Member.create({
      tenantId: family.tenantId,
      memberId: 'MHL-0001',
      name: 'Test Member',
      gender: 'male',
      phone: '9999999999',
      familyId: family._id,
    });

    await processPaymentDues({ _id: objectId(), amount: 300, paidForId: member._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(700);
  });

  it('resolves familyId via payment.paidById -> Member.familyId when familyId and paidForId are absent', async () => {
    const family = await createFamily({ outstandingBalance: 1000 });
    const member = await Member.create({
      tenantId: family.tenantId,
      memberId: 'MHL-0002',
      name: 'Payer Member',
      gender: 'female',
      phone: '9999999998',
      familyId: family._id,
    });

    await processPaymentDues({ _id: objectId(), amount: 250, paidById: member._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(750);
  });

  it('does nothing when no familyId can be resolved from any source', async () => {
    await expect(
      processPaymentDues({ _id: objectId(), amount: 100 }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when the resolved family no longer exists', async () => {
    await expect(
      processPaymentDues({ _id: objectId(), amount: 100, familyId: objectId() }),
    ).resolves.toBeUndefined();
  });

  it('marks pending donations as paid in chronological order, oldest first, until the amount is exhausted', async () => {
    const family = await createFamily({ outstandingBalance: 1000 });
    const older = await Donation.create({
      tenantId: family.tenantId,
      familyId: family._id,
      amount: 200,
      status: 'pending',
      createdAt: new Date('2026-01-01'),
    });
    const newer = await Donation.create({
      tenantId: family.tenantId,
      familyId: family._id,
      amount: 300,
      status: 'pending',
      createdAt: new Date('2026-02-01'),
    });

    await processPaymentDues({ _id: objectId(), amount: 250, familyId: family._id });

    const olderAfter = await Donation.findById(older._id);
    const newerAfter = await Donation.findById(newer._id);
    // 250 covers the 200 older donation in full; the 100 remaining is not
    // enough to cover the 300 newer donation, so it stays pending
    // (the implementation only flips status when remainingAmount >= donation.amount).
    expect(olderAfter!.status).toBe('paid');
    expect(newerAfter!.status).toBe('pending');
  });

  it('does not mark a pending donation paid when the payment amount is smaller than it', async () => {
    const family = await createFamily({ outstandingBalance: 1000 });
    const donation = await Donation.create({
      tenantId: family.tenantId,
      familyId: family._id,
      amount: 500,
      status: 'pending',
    });

    await processPaymentDues({ _id: objectId(), amount: 100, familyId: family._id });

    const after = await Donation.findById(donation._id);
    expect(after!.status).toBe('pending');
  });

  it('floors outstandingBalance at 0 when the payment exceeds it', async () => {
    const family = await createFamily({ outstandingBalance: 200 });

    await processPaymentDues({ _id: objectId(), amount: 500, familyId: family._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(0);
  });

  it('recalculates nextPaymentDueDate when the balance clears and a recurring type is set', async () => {
    const family = await createFamily({
      outstandingBalance: 400,
      recurringDonationType: 'monthly',
      recurringPaymentDay: 15,
    });

    await processPaymentDues({ _id: objectId(), amount: 400, familyId: family._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(0);
    expect(updated!.nextPaymentDueDate).toBeInstanceOf(Date);
  });

  it('does not touch nextPaymentDueDate when the balance does not clear', async () => {
    const family = await createFamily({
      outstandingBalance: 1000,
      recurringDonationType: 'monthly',
      recurringPaymentDay: 15,
      nextPaymentDueDate: undefined,
    });

    await processPaymentDues({ _id: objectId(), amount: 100, familyId: family._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(900);
    expect(updated!.nextPaymentDueDate).toBeUndefined();
  });

  it('does not recalculate nextPaymentDueDate when the balance clears but recurringDonationType is "none"', async () => {
    const family = await createFamily({
      outstandingBalance: 300,
      recurringDonationType: 'none',
    });

    await processPaymentDues({ _id: objectId(), amount: 300, familyId: family._id });

    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(0);
    expect(updated!.nextPaymentDueDate).toBeUndefined();
  });
});
