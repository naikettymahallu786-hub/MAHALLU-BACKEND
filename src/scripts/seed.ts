import 'dotenv/config';
import { connectDB } from '../config/database';
import {
  Tenant,
  User,
  Member,
  Family,
  Madrasa,
  Settings,
  Student,
  Teacher,
  Class,
  Homework,
  Exam,
  Payment,
  Donation,
  Subscription,
  Property,
  Lease,
  Zakat,
  Nikah,
  DeathRecord,
  Event,
  EventTemplate,
  Notification,
  Survey,
  Receipt,
  RegistrationRequest,
  ImportExportLog,
  Attendance,
  Certificate,
  AuditLog,
  Mosque,
} from '../models';
import { logger } from '../config/logger';
import { UserRole } from '../types';
import mongoose from 'mongoose';

async function seed() {
  await connectDB();
  logger.info('🌱 Resetting database and initializing fresh empty Mahallu...');

  // Clear all existing data across all collections
  await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Member.deleteMany({}),
    Family.deleteMany({}),
    Madrasa.deleteMany({}),
    Settings.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Class.deleteMany({}),
    Homework.deleteMany({}),
    Exam.deleteMany({}),
    Payment.deleteMany({}),
    Donation.deleteMany({}),
    Subscription.deleteMany({}),
    Property.deleteMany({}),
    Lease.deleteMany({}),
    Zakat.deleteMany({}),
    Nikah.deleteMany({}),
    DeathRecord.deleteMany({}),
    Event.deleteMany({}),
    EventTemplate.deleteMany({}),
    Notification.deleteMany({}),
    Survey.deleteMany({}),
    Receipt.deleteMany({}),
    RegistrationRequest.deleteMany({}),
    ImportExportLog.deleteMany({}),
    Attendance.deleteMany({}),
    Certificate.deleteMany({}),
    AuditLog.deleteMany({}),
    Mosque.deleteMany({}),
  ]);

  logger.info('🧹 All collections cleared (0 members, 0 families, 0 students).');

  // 1. Create Default Single Mahallu Tenant
  const tenant = await Tenant.create({
    name: 'Jamia Masjid Mahallu',
    mahalluCode: 'JMM001',
    phone: '+919876543210',
    email: 'admin@jamaiamasjid.in',
    address: {
      line1: 'Main Road, Near Masjid',
      city: 'Kozhikode',
      district: 'Kozhikode',
      state: 'Kerala',
      pincode: '673001',
      country: 'India',
    },
    settings: {
      language: 'ml',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      prayerTimeMethod: '1',
    },
  });

  logger.info(`✅ Single Mahallu Tenant initialized: ${tenant.name}`);

  // 2. Create Super Admin User
  const superAdmin = await User.create({
    tenantId: tenant._id,
    name: 'System Administrator',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@mahallu.app',
    phone: '+919876543210',
    role: UserRole.SUPER_ADMIN,
    passwordHash: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
    isActive: true,
  });

  logger.info(`✅ Super Admin created: ${superAdmin.email}`);

  // 3. Create Dedicated Madrasa Admin / Principal User
  const madrasaAdmin = await User.create({
    tenantId: tenant._id,
    name: 'Madrasa Administrator',
    email: 'madrasa.admin@mahallu.app',
    phone: '+919876543220',
    role: UserRole.MADRASA_PRINCIPAL,
    passwordHash: 'Madrasa@123456',
    isActive: true,
  });

  // 4. Create Sadar Mualim User
  const sadarUser = await User.create({
    tenantId: tenant._id,
    name: 'Sadar Mualim',
    email: 'sadar@mahallu.app',
    phone: '+919876543221',
    role: UserRole.SADAR_MUALIM,
    passwordHash: 'Sadar@123456',
    isActive: true,
  });

  logger.info(`✅ Dedicated Madrasa Admin & Sadar Mualim created: ${madrasaAdmin.email}, ${sadarUser.email}`);

  // 5. Create Settings
  await Settings.create({
    tenantId: tenant._id,
    general: {
      mahalluName: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      address: `${tenant.address.city}, Kerala`,
    },
    notifications: { whatsappEnabled: false, smsEnabled: false, emailEnabled: true, pushEnabled: true },
    finance: { currency: 'INR', financialYearStart: 'April', autoReceiptEnabled: true },
    theme: { primaryColor: '#059669', mode: 'system', language: 'ml' },
  });

  logger.info('🎉 Database reset successfully with ZERO dummy members/families!');
  logger.info('📋 Admin Login Credentials:');
  logger.info('   Admin Portal:   admin@mahallu.app / Admin@123456');
  logger.info('   Madrasa Admin:  madrasa.admin@mahallu.app / Madrasa@123456');
  logger.info('   Sadar Mualim:   sadar@mahallu.app / Sadar@123456');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
