export function calculateNextDueDate(
  type?: 'monthly' | 'yearly' | 'none',
  day: number = 1,
  month: number = 1,
  lastPaymentDate?: Date
): Date | undefined {
  if (!type || type === 'none') return undefined;

  const now = lastPaymentDate ? new Date(lastPaymentDate) : new Date();
  const safeDay = Math.min(Math.max(1, day || 1), 28);
  const safeMonth = Math.min(Math.max(1, month || 1), 12);

  if (type === 'monthly') {
    const candidate = new Date(now.getFullYear(), now.getMonth(), safeDay);
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  if (type === 'yearly') {
    const candidate = new Date(now.getFullYear(), safeMonth - 1, safeDay);
    if (candidate <= now) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return candidate;
  }

  return undefined;
}
