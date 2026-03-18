import { DateTime } from 'luxon';
import { AssetStatus } from '@prisma/client';

export function toOrgTimezone(utcDate: Date, tz: string): string {
  return DateTime.fromJSDate(utcDate).setZone(tz).toISO() ?? utcDate.toISOString();
}

export function daysUntilExpiry(renewalDate: Date): number {
  const now = DateTime.now().startOf('day');
  const expiry = DateTime.fromJSDate(renewalDate).startOf('day');
  return Math.ceil(expiry.diff(now, 'days').days);
}

export function getExpiryStatus(daysUntil: number): AssetStatus {
  if (daysUntil < 0) return AssetStatus.EXPIRED;
  if (daysUntil <= 30) return AssetStatus.EXPIRING_SOON;
  return AssetStatus.ACTIVE;
}

export function addInterval(date: Date, unit: string, value: number): Date {
  return DateTime.fromJSDate(date)
    .plus({ [unit + 's']: value })
    .toJSDate();
}
