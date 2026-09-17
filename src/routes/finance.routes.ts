import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { PERMISSIONS } from '../config/constants';
import { Transaction } from '../models/Transaction';
import { Account } from '../models/Account';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// Default seed accounts for new tenants
const DEFAULT_ACCOUNTS = [
  { name: 'Mosque General Fund', code: 'MGF-01', description: 'General operational fund for mosque day-to-day expenses & collections', openingBalance: 0, isDefault: true },
  { name: 'Milad Fund', code: 'MLD-02', description: 'Special fund for Mawlid / Milad-un-Nabi functions and celebrations', openingBalance: 0, isDefault: false },
  { name: 'Construction & Renovation Fund', code: 'CNST-03', description: 'Fund dedicated to mosque building construction & renovation projects', openingBalance: 0, isDefault: false },
  { name: 'Zakat & Relief Fund', code: 'ZKT-04', description: 'Welfare fund for zakat distribution, emergency medical aid and poor support', openingBalance: 0, isDefault: false },
];

// GET /api/v1/finance/accounts - List all accounts with current income/expense breakdown
router.get('/accounts', authorize(PERMISSIONS.FINANCE_VIEW), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;

    let accounts = await Account.find({ tenantId, status: 'active' }).sort({ createdAt: -1 }).lean();

    // Auto-seed default accounts if none exist for this tenant
    if (accounts.length === 0) {
      const seeded = await Account.insertMany(
        DEFAULT_ACCOUNTS.map(acc => ({ ...acc, tenantId, currentBalance: acc.openingBalance }))
      );
      accounts = seeded.map(a => JSON.parse(JSON.stringify(a)));
    }

    // Calculate aggregated totals for each account
    const accountsWithTotals = await Promise.all(
      accounts.map(async (acc: any) => {
        const stats = await Transaction.aggregate([
          { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), accountId: new mongoose.Types.ObjectId(String(acc._id)) } },
          {
            $group: {
              _id: '$type',
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        let txCount = 0;

        stats.forEach((s) => {
          if (s._id === 'INCOME') totalIncome = s.total;
          if (s._id === 'EXPENSE') totalExpense = s.total;
          txCount += s.count;
        });

        const netBalance = (acc.openingBalance || 0) + totalIncome - totalExpense;

        return {
          ...acc,
          totalIncome,
          totalExpense,
          txCount,
          currentBalance: netBalance
        };
      })
    );

    res.json({ success: true, data: accountsWithTotals });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/finance/accounts - Create a new fund/account
router.post('/accounts', authorize(PERMISSIONS.FINANCE_CREATE), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, code, description, openingBalance = 0 } = req.body;

    if (!name || name.trim() === '') {
      throw new AppError('Account name is required', 400);
    }

    const numOpeningBalance = Number(openingBalance) || 0;

    const account = await Account.create({
      tenantId,
      name: name.trim(),
      code: code ? code.trim() : undefined,
      description: description ? description.trim() : undefined,
      openingBalance: numOpeningBalance,
      currentBalance: numOpeningBalance,
      status: 'active'
    });

    res.status(201).json({ success: true, data: account });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/finance/accounts/:id - Get single account details with statistics
router.get('/accounts/:id', authorize(PERMISSIONS.FINANCE_VIEW), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const account = await Account.findOne({ _id: req.params.id, tenantId }).lean();

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const stats = await Transaction.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), accountId: new mongoose.Types.ObjectId(String(account._id)) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let txCount = 0;

    stats.forEach((s) => {
      if (s._id === 'INCOME') totalIncome = s.total;
      if (s._id === 'EXPENSE') totalExpense = s.total;
      txCount += s.count;
    });

    const currentBalance = (account.openingBalance || 0) + totalIncome - totalExpense;

    res.json({
      success: true,
      data: {
        ...account,
        totalIncome,
        totalExpense,
        txCount,
        currentBalance
      }
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/v1/finance/accounts/:id - Update account info
router.put('/accounts/:id', authorize(PERMISSIONS.FINANCE_CREATE), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, code, description, status } = req.body;

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { name, code, description, status },
      { new: true }
    );

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    res.json({ success: true, data: account });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/v1/finance/accounts/:id - Archive/Delete account
router.delete('/accounts/:id', authorize(PERMISSIONS.FINANCE_DELETE), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const txCount = await Transaction.countDocuments({ tenantId, accountId: req.params.id });

    if (txCount > 0) {
      // Soft-delete / archive if transactions exist
      await Account.findOneAndUpdate({ _id: req.params.id, tenantId }, { status: 'archived' });
    } else {
      await Account.deleteOne({ _id: req.params.id, tenantId });
    }

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/finance/transactions - List transactions (supports accountId filter & year filter)
router.get('/transactions', authorize(PERMISSIONS.FINANCE_VIEW), async (req: AuthRequest, res, next) => {
  try {
    const { year, accountId, type, category, search } = req.query;
    const query: any = { tenantId: req.user!.tenantId };

    if (accountId) {
      query.accountId = accountId;
    }

    if (type && (type === 'INCOME' || type === 'EXPENSE')) {
      query.type = type;
    }

    if (category) {
      query.category = category;
    }

    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      query.date = { $gte: startDate, $lte: endDate };
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      query.$or = [
        { category: searchRegex },
        { description: searchRegex },
        { referenceNo: searchRegex }
      ];
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate('recordedBy', 'name')
      .populate('accountId', 'name code')
      .lean();

    res.json({ success: true, data: transactions });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/finance/transactions - Record income or expense for an account
router.post('/transactions', authorize(PERMISSIONS.FINANCE_CREATE), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { accountId, type, amount, category, date, description, referenceNo } = req.body;

    if (!type || !amount || !date) {
      throw new AppError('Missing required fields: type, amount, and date are required', 400);
    }

    // Resolve category (optional for EXPENSE, defaults to 'General Expense')
    const resolvedCategory = category?.trim() || (type === 'EXPENSE' ? 'General Expense' : 'General Income');

    // Description is optional
    const resolvedDescription = description?.trim() || '';

    // Auto-generate referenceNo if missing
    const resolvedRefNo = referenceNo?.trim() || (
      type === 'INCOME'
        ? `REC-INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
        : `REC-EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
    );

    // Resolve or fallback to default account if accountId is missing
    let targetAccountId = accountId;
    if (!targetAccountId) {
      let defaultAcc = await Account.findOne({ tenantId, status: 'active' });
      if (!defaultAcc) {
        defaultAcc = await Account.create({
          tenantId,
          name: 'Mosque General Fund',
          code: 'MGF-01',
          openingBalance: 0,
          currentBalance: 0,
          isDefault: true
        });
      }
      targetAccountId = defaultAcc._id;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new AppError('Invalid transaction amount', 400);
    }

    const transaction = await Transaction.create({
      tenantId,
      accountId: targetAccountId,
      type,
      amount: numAmount,
      category: resolvedCategory,
      date: new Date(date),
      description: resolvedDescription,
      referenceNo: resolvedRefNo,
      recordedBy: req.user!.userId
    });

    // Update account current balance
    const balanceChange = type === 'INCOME' ? numAmount : -numAmount;
    await Account.findOneAndUpdate(
      { _id: targetAccountId, tenantId },
      { $inc: { currentBalance: balanceChange } }
    );

    res.status(201).json({ success: true, data: transaction });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/v1/finance/transactions/:id - Delete a transaction
router.delete('/transactions/:id', authorize(PERMISSIONS.FINANCE_DELETE), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const transaction = await Transaction.findOne({ _id: req.params.id, tenantId });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    // Revert balance change if bound to account
    if (transaction.accountId) {
      const revertChange = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
      await Account.findOneAndUpdate(
        { _id: transaction.accountId, tenantId },
        { $inc: { currentBalance: revertChange } }
      );
    }

    await Transaction.deleteOne({ _id: req.params.id, tenantId });

    res.json({ success: true, message: 'Transaction deleted' });
  } catch (e) {
    next(e);
  }
});

export default router;
