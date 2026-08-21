import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RegistrationService } from '../services/registration.service';

// ---------------------------------------------------------
// PUBLIC ENDPOINTS (Called by Mobile App during registration)
// ---------------------------------------------------------

export const submitRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mahalluCode, type, payload } = req.body;
    const registration = await RegistrationService.submitRegistration(mahalluCode, type, payload);

    res.status(201).json({
      success: true,
      message: 'Registration request submitted successfully. Please wait for admin approval.',
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

export const getFamiliesForRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mahalluCode } = req.params;
    const formatted = await RegistrationService.getFamiliesForRegistration(mahalluCode);
    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------
// PROTECTED ENDPOINTS (Called by Admin Dashboard)
// ---------------------------------------------------------

export const getPendingRegistrations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registrations = await RegistrationService.getPendingRegistrations(req.user!.tenantId);
    res.status(200).json({
      success: true,
      message: 'Pending registrations fetched successfully',
      data: registrations,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectRegistration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await RegistrationService.rejectRegistration(req.user!.tenantId, req.params.id);
    res.status(200).json({ success: true, message: 'Registration request rejected' });
  } catch (error) {
    next(error);
  }
};

export const approveRegistration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await RegistrationService.approveRegistration(req.user!.tenantId, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Registration approved successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
};
