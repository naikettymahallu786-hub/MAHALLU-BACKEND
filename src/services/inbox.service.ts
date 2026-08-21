import { RegistrationStatus } from '../models/RegistrationRequest';
import { InboxRepository } from '../repositories/inbox.repository';

export class InboxService {
  static async getUnified(tenantId: string, statusQueryInput?: string) {
    const statusQuery = statusQueryInput || 'PENDING';

    let regStatusQuery: any = {
      $in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED, RegistrationStatus.REJECTED],
    };
    let genStatusQuery: any = { $in: ['pending', 'approved', 'rejected', 'PENDING', 'APPROVED', 'REJECTED'] };

    if (statusQuery !== 'ALL') {
      regStatusQuery = statusQuery.toUpperCase();
      genStatusQuery = statusQuery.toLowerCase();
      if (statusQuery === 'PENDING' || statusQuery === 'APPROVED' || statusQuery === 'REJECTED') {
        genStatusQuery = { $in: [statusQuery.toLowerCase(), statusQuery.toUpperCase()] };
      }
    }

    const registrations = await InboxRepository.findRegistrations(tenantId, regStatusQuery);

    // Cemetery/plot requests were removed from the codebase — this stays
    // permanently empty, matching the original file's dead `plots` array
    // (the forEach below is a harmless no-op preserved as-is).
    const plots: any[] = [];

    const certs = await InboxRepository.findCertificateRequests(tenantId, genStatusQuery);
    const rentals = await InboxRepository.findRentalRequests(tenantId, genStatusQuery);

    const inboxItems: any[] = [];

    registrations.forEach((reg: any) => {
      inboxItems.push({
        id: reg._id,
        type: 'REGISTRATION',
        title: `New ${reg.type.toLowerCase()} registration request`,
        description: `Name: ${reg.payload?.name || 'Unknown'}\nPhone: ${reg.payload?.phone || 'Unknown'}`,
        createdAt: reg.createdAt,
        status: reg.status,
        actionUrl: '/registrations',
      });
    });

    plots.forEach((plot: any) => {
      inboxItems.push({
        id: plot._id,
        type: 'PLOT_REQUEST',
        title: `Cemetery Plot Request`,
        description: `Plot ${plot.plotNo} requested by ${(plot.requestedBy as any)?.name || 'Unknown'} in ${(plot.cemeteryId as any)?.name || 'Unknown'}`,
        createdAt: plot.createdAt,
        status: plot.status.toUpperCase(),
        actionUrl: '/cemetery',
      });
    });

    certs.forEach((cert: any) => {
      inboxItems.push({
        id: cert._id,
        type: 'CERTIFICATE_REQUEST',
        title: `${(cert.type || '').toUpperCase()} Certificate Request`,
        description: `Requested by ${(cert.requestedBy as any)?.name || 'Unknown'}\nPurpose: ${cert.purpose}`,
        createdAt: cert.createdAt,
        status: cert.status.toUpperCase(),
        actionUrl: `/certificates/requests/${cert._id}`,
      });
    });

    rentals.forEach((rent: any) => {
      inboxItems.push({
        id: rent._id,
        type: 'RENTAL_REQUEST',
        title: `Property / Equipment Rental Request`,
        description: `Requested by ${(rent.requestedBy as any)?.name || 'Unknown'}\nItem: ${(rent.propertyId as any)?.name || 'Unknown'}\nQuantity: ${rent.quantityRequested}`,
        createdAt: rent.createdAt,
        status: rent.status.toUpperCase(),
        actionUrl: `/properties/requests/${rent._id}`,
      });
    });

    inboxItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return inboxItems;
  }
}
