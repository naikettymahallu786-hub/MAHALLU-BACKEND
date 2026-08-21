import { ReportRepository } from '../repositories/report.repository';
import { buildCSV } from '../domain/csvExport';
import { computeDateRange } from '../domain/dateRangeQuery';

type CsvResult = { format: 'csv'; content: string; filename: string };
type JsonResult = { format: 'json'; data: unknown };

function buildDateQuery(startDate?: string, endDate?: string, month?: string, year?: string, dateField = 'createdAt') {
  const range = computeDateRange(startDate, endDate, month, year);
  return range ? { [dateField]: range } : {};
}

export class ReportService {
  static async getFinancialSummary(tenantId: string, startDate?: string, endDate?: string) {
    const filter: Record<string, unknown> = { tenantId };
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    return ReportRepository.aggregatePaymentsByType(filter);
  }

  static async exportFinancial(tenantId: string): Promise<CsvResult> {
    const payments = await ReportRepository.findAllPaymentsWithPayerNames(tenantId);
    const headers = ['Payment No', 'Date', 'Type', 'Amount', 'Gateway', 'Payment ID', 'Order ID', 'Status', 'Description', 'Paid For', 'Paid By'];
    const rows = payments.map((p: any) => [
      p.paymentNo || '',
      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
      p.type || '',
      p.amount || 0,
      p.gateway || '',
      p.gatewayPaymentId || '',
      p.gatewayOrderId || '',
      p.status || '',
      p.description || '',
      p.paidForId?.name || '',
      p.paidById?.name || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'financial_report.csv' };
  }

  static async exportMembers(tenantId: string): Promise<CsvResult> {
    const members = await ReportRepository.findAllMembersWithFamily(tenantId);
    const headers = ['Name', 'Member ID', 'Family Code', 'Ward No', 'Address', 'Phone', 'Email', 'Gender', 'DOB', 'Blood Group', 'Status'];
    const rows = members.map((m: any) => [
      m.name || '',
      m.memberId || '',
      m.familyId?.familyCode || '',
      m.familyId?.wardNo || '',
      m.familyId?.address?.line1 || '',
      m.phone || '',
      m.email || '',
      m.gender || '',
      m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString() : '',
      m.bloodGroup || '',
      m.status || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'member_census_report.csv' };
  }

  static async exportAcademic(tenantId: string): Promise<CsvResult> {
    const students = await ReportRepository.findAllStudentsWithDetails(tenantId);
    const headers = ['Student Name', 'Admission No', 'Class', 'Gender', 'DOB', 'Parent Name', 'Parent Phone', 'Status'];
    const rows = students.map((s: any) => [
      s.memberId?.name || s.name || '',
      s.admissionNo || '',
      s.classId?.name || '',
      s.memberId?.gender || '',
      s.memberId?.dateOfBirth ? new Date(s.memberId.dateOfBirth).toLocaleDateString() : '',
      s.guardianId?.name || '',
      s.guardianId?.phone || '',
      s.status || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'academic_progress_report.csv' };
  }

  static async exportIncomeExpense(tenantId: string): Promise<CsvResult> {
    const transactions = await ReportRepository.findAllTransactions(tenantId);
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description', 'Reference No'];
    const rows = transactions.map((t: any) => [
      t.date ? new Date(t.date).toLocaleDateString() : '',
      t.type || '',
      t.category || '',
      t.amount || 0,
      t.description || '',
      t.referenceNo || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'income_expense_report.csv' };
  }

  static async exportPayments(tenantId: string): Promise<CsvResult> {
    const payments = await ReportRepository.findAllPaymentsWithPayerNames(tenantId);
    const headers = ['Payment No', 'Date', 'Type', 'Amount', 'Gateway', 'Payment ID', 'Order ID', 'Status', 'Description', 'Paid For', 'Paid By'];
    const rows = payments.map((p: any) => [
      p.paymentNo || '',
      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
      p.type || '',
      p.amount || 0,
      p.gateway || '',
      p.gatewayPaymentId || '',
      p.gatewayOrderId || '',
      p.status || '',
      p.description || '',
      p.paidForId?.name || '',
      p.paidById?.name || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'payments_history_report.csv' };
  }

  static async exportNikah(
    tenantId: string,
    query: { search?: string; startDate?: string; endDate?: string; month?: string; year?: string; format?: string },
  ): Promise<CsvResult | JsonResult> {
    const { search, startDate, endDate, month, year, format = 'csv' } = query;
    const filter: Record<string, any> = { tenantId, ...buildDateQuery(startDate, endDate, month, year, 'date') };

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ nikahNo: searchRegex }, { brideName: searchRegex }, { groomName: searchRegex }, { venue: searchRegex }];
    }

    const nikahs = await ReportRepository.findNikahs(filter);
    if (format === 'json') return { format: 'json', data: nikahs };

    const headers = ['Nikah No', 'Date', 'Groom Name', 'Groom Phone', 'Bride Name', 'Bride Phone', 'Mehr Amount (INR)', 'Khazi / Officiator', 'Venue'];
    const rows = nikahs.map((n: any) => [
      n.nikahNo || '',
      n.date ? new Date(n.date).toLocaleDateString() : '',
      n.groomName || n.groomId?.name || '',
      n.groomId?.phone || '',
      n.brideName || n.brideId?.name || '',
      n.brideId?.phone || '',
      `${n.mehr || 0} ${n.mehrCurrency || 'INR'}`,
      n.imamId?.name || '',
      n.venue || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'nikah_registrations_report.csv' };
  }

  static async exportCertificates(
    tenantId: string,
    query: { search?: string; status?: string; type?: string; startDate?: string; endDate?: string; month?: string; year?: string; format?: string },
  ): Promise<CsvResult | JsonResult> {
    const { search, status, type, startDate, endDate, month, year, format = 'csv' } = query;
    const filter: Record<string, any> = { tenantId, ...buildDateQuery(startDate, endDate, month, year, 'issuedAt') };

    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.isRevoked = status === 'revoked';

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ certificateNo: searchRegex }, { type: searchRegex }];
    }

    const certs = await ReportRepository.findCertificates(filter);
    if (format === 'json') return { format: 'json', data: certs };

    const headers = ['Certificate No', 'Type', 'Recipient Name', 'Recipient Phone', 'Issued Date', 'Expiry Date', 'Issued By', 'Status'];
    const rows = certs.map((c: any) => [
      c.certificateNo || '',
      c.type || '',
      c.recipientId?.name || '',
      c.recipientId?.phone || '',
      c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '',
      c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'N/A',
      c.issuedBy?.name || '',
      c.isRevoked ? 'Revoked' : 'Active / Issued',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'certificates_issued_report.csv' };
  }

  static async exportEvents(
    tenantId: string,
    query: { search?: string; startDate?: string; endDate?: string; month?: string; year?: string; format?: string },
  ): Promise<CsvResult | JsonResult> {
    const { search, startDate, endDate, month, year, format = 'csv' } = query;
    const filter: Record<string, any> = { tenantId, ...buildDateQuery(startDate, endDate, month, year, 'date') };

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ title: searchRegex }, { venue: searchRegex }, { description: searchRegex }];
    }

    const events = await ReportRepository.findEvents(filter);
    if (format === 'json') return { format: 'json', data: events };

    const headers = ['Event Title', 'Date', 'Venue', 'Paid Event', 'Fee (INR)', 'Capacity', 'Registrations Count', 'Description'];
    const rows = events.map((ev: any) => [
      ev.title || '',
      ev.date ? new Date(ev.date).toLocaleDateString() : '',
      ev.venue || '',
      ev.isPaid ? 'Yes' : 'Free',
      ev.fee || 0,
      ev.capacity || 'Unlimited',
      ev.registrations?.length || 0,
      ev.description || '',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'events_report.csv' };
  }

  static async exportDeath(
    tenantId: string,
    query: { search?: string; startDate?: string; endDate?: string; month?: string; year?: string; format?: string },
  ): Promise<CsvResult | JsonResult> {
    const { search, startDate, endDate, month, year, format = 'csv' } = query;
    const filter: Record<string, any> = { tenantId, ...buildDateQuery(startDate, endDate, month, year, 'dateOfDeath') };

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ causeOfDeath: searchRegex }, { janazahVenue: searchRegex }, { burialPlace: searchRegex }, { plotId: searchRegex }];
    }

    const records = await ReportRepository.findDeathRecords(filter);
    if (format === 'json') return { format: 'json', data: records };

    const headers = ['Deceased Name', 'Phone', 'Date of Death', 'Cause of Death', 'Janazah Date & Venue', 'Burial Place'];
    const rows = records.map((d: any) => [
      d.memberId?.name || '',
      d.memberId?.phone || '',
      d.dateOfDeath ? new Date(d.dateOfDeath).toLocaleDateString() : '',
      d.causeOfDeath || '',
      `${d.janazahDate ? new Date(d.janazahDate).toLocaleDateString() : ''} ${d.janazahVenue || ''}`.trim(),
      d.burialPlace || 'Mahallu Ground',
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'death_and_burial_report.csv' };
  }

  static async exportZakat(
    tenantId: string,
    query: { search?: string; status?: string; year?: string; format?: string },
  ): Promise<CsvResult | JsonResult> {
    const { search, status, year, format = 'csv' } = query;
    const filter: Record<string, any> = { tenantId };
    if (year && year !== 'all') filter.year = parseInt(year);

    const zakatRecords = await ReportRepository.findZakatRecords(filter);

    let flatItems: any[] = [];
    zakatRecords.forEach((z: any) => {
      (z.applicants || []).forEach((app: any) => {
        if (status && status !== 'all' && app.status !== status) return;
        if (search) {
          const cleanSearch = String(search).toLowerCase();
          const name = (app.memberId?.name || '').toLowerCase();
          const phone = (app.memberId?.phone || '').toLowerCase();
          if (!name.includes(cleanSearch) && !phone.includes(cleanSearch)) return;
        }
        flatItems.push({
          year: z.year,
          memberName: app.memberId?.name || 'N/A',
          phone: app.memberId?.phone || 'N/A',
          amountRequested: app.amountRequested || 0,
          amountApproved: app.amountApproved || 0,
          status: app.status || 'pending',
          notes: app.notes || '',
        });
      });
    });

    if (format === 'json') return { format: 'json', data: flatItems };

    const headers = ['Year', 'Applicant Name', 'Phone', 'Amount Requested (INR)', 'Amount Approved (INR)', 'Application Status', 'Notes'];
    const rows = flatItems.map((item) => [
      item.year || '',
      item.memberName,
      item.phone,
      item.amountRequested,
      item.amountApproved,
      item.status,
      item.notes,
    ]);
    return { format: 'csv', content: buildCSV(headers, rows), filename: 'zakat_distribution_report.csv' };
  }
}
