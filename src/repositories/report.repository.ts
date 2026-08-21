export class ReportRepository {
  static async aggregatePaymentsByType(filter: Record<string, unknown>) {
    const { Payment } = await import('../models/Payment');
    return Payment.aggregate([
      { $match: filter },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
  }

  static async findAllPaymentsWithPayerNames(tenantId: string) {
    const { Payment } = await import('../models/Payment');
    return Payment.find({ tenantId })
      .populate({ path: 'paidForId', select: 'name', options: { strictPopulate: false } })
      .populate({ path: 'paidById', select: 'name', options: { strictPopulate: false } })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async findAllMembersWithFamily(tenantId: string) {
    const { Member } = await import('../models/Member');
    return Member.find({ tenantId })
      .populate({ path: 'familyId', select: 'familyCode address wardNo', options: { strictPopulate: false } })
      .sort({ name: 1 })
      .lean();
  }

  static async findAllStudentsWithDetails(tenantId: string) {
    const { Student } = await import('../models/Student');
    return Student.find({ tenantId })
      .populate({ path: 'memberId', select: 'name phone gender dateOfBirth', options: { strictPopulate: false } })
      .populate({ path: 'classId', select: 'name', options: { strictPopulate: false } })
      .populate({ path: 'guardianId', select: 'name phone', options: { strictPopulate: false } })
      .sort({ name: 1 })
      .lean();
  }

  static async findAllTransactions(tenantId: string) {
    const { Transaction } = await import('../models/Transaction');
    return Transaction.find({ tenantId }).sort({ date: -1 }).lean();
  }

  static async findNikahs(filter: Record<string, unknown>) {
    const { Nikah } = await import('../models/Nikah');
    return Nikah.find(filter)
      .populate({ path: 'groomId', select: 'name phone', options: { strictPopulate: false } })
      .populate({ path: 'brideId', select: 'name phone', options: { strictPopulate: false } })
      .populate({ path: 'imamId', select: 'name phone', options: { strictPopulate: false } })
      .sort({ date: -1 })
      .lean();
  }

  static async findCertificates(filter: Record<string, unknown>) {
    const { Certificate } = await import('../models/Certificate');
    return Certificate.find(filter)
      .populate({ path: 'recipientId', select: 'name phone', options: { strictPopulate: false } })
      .populate({ path: 'issuedBy', select: 'name', options: { strictPopulate: false } })
      .sort({ issuedAt: -1 })
      .lean();
  }

  static async findEvents(filter: Record<string, unknown>) {
    const { Event } = await import('../models/Event');
    return Event.find(filter).sort({ date: -1 }).lean();
  }

  static async findDeathRecords(filter: Record<string, unknown>) {
    const { DeathRecord } = await import('../models/DeathRecord');
    return DeathRecord.find(filter)
      .populate({ path: 'memberId', select: 'name phone', options: { strictPopulate: false } })
      .sort({ dateOfDeath: -1 })
      .lean();
  }

  static async findZakatRecords(filter: Record<string, unknown>) {
    const { Zakat } = await import('../models/Zakat');
    return Zakat.find(filter)
      .populate({ path: 'applicants.memberId', select: 'name phone', options: { strictPopulate: false } })
      .sort({ year: -1 })
      .lean();
  }
}
