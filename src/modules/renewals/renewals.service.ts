import { Injectable } from '@nestjs/common';
import { AssetStatus, RenewalEventType } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service';
import { addInterval, daysUntilExpiry, getExpiryStatus } from '../../common/utils/date.utils';

@Injectable()
export class RenewalsService {
  constructor(private prisma: PrismaService) {}

  async getUpcoming(organizationId: string, days = 30) {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);

    const assets = await this.prisma.asset.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] },
        renewalDate: { gte: now, lte: threshold },
      },
      include: {
        project: { select: { id: true, name: true, colorTag: true } },
        assignedUser: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { renewalDate: 'asc' },
    });

    return assets.map((a) => ({
      ...a,
      daysUntilRenewal: daysUntilExpiry(a.renewalDate),
    }));
  }

  async getOverdue(organizationId: string) {
    const now = new Date();

    const assets = await this.prisma.asset.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] },
        renewalDate: { lt: now },
      },
      include: {
        project: { select: { id: true, name: true, colorTag: true } },
        assignedUser: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { renewalDate: 'asc' },
    });

    return assets.map((a) => ({
      ...a,
      daysOverdue: Math.abs(daysUntilExpiry(a.renewalDate)),
    }));
  }

  async getCalendar(organizationId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    return this.prisma.asset.findMany({
      where: {
        organizationId,
        deletedAt: null,
        renewalDate: { gte: start, lte: end },
        status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] },
      },
      select: {
        id: true,
        name: true,
        assetType: true,
        renewalDate: true,
        status: true,
        project: { select: { id: true, name: true, colorTag: true } },
      },
      orderBy: { renewalDate: 'asc' },
    });
  }

  async recordRenewal(
    organizationId: string,
    assetId: string,
    userId: string,
    newRenewalDate?: string,
  ) {
    const asset = await this.prisma.asset.findFirstOrThrow({
      where: { id: assetId, organizationId, deletedAt: null },
    });

    const nextDate = newRenewalDate
      ? new Date(newRenewalDate)
      : addInterval(
          asset.renewalDate,
          asset.renewalIntervalUnit ?? 'year',
          asset.renewalIntervalValue ?? 1,
        );

    const newStatus = getExpiryStatus(daysUntilExpiry(nextDate));

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.asset.update({
        where: { id: assetId },
        data: {
          renewalDate: nextDate,
          status: newStatus,
          lastRenewedAt: new Date(),
        },
      });

      await tx.renewalEvent.create({
        data: {
          assetId,
          eventType: RenewalEventType.RENEWED,
          oldRenewalDate: asset.renewalDate,
          newRenewalDate: nextDate,
          performedByUserId: userId,
        },
      });

      return updated;
    });
  }

  async getDashboardSummary(organizationId: string) {
    const now = new Date();
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const activeFilter = { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] };

    const [total, expiredCount, expiringIn7, expiringIn30, renewedThisMonth, renewalEvents, assetsByTypeRaw] =
      await Promise.all([
        this.prisma.asset.count({
          where: { organizationId, deletedAt: null, status: activeFilter },
        }),
        this.prisma.asset.count({
          where: { organizationId, deletedAt: null, renewalDate: { lt: now }, status: activeFilter },
        }),
        this.prisma.asset.count({
          where: { organizationId, deletedAt: null, renewalDate: { gte: now, lte: in7 }, status: activeFilter },
        }),
        this.prisma.asset.count({
          where: { organizationId, deletedAt: null, renewalDate: { gte: now, lte: in30 }, status: activeFilter },
        }),
        this.prisma.renewalEvent.count({
          where: {
            asset: { organizationId },
            eventType: RenewalEventType.RENEWED,
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        }),
        this.prisma.renewalEvent.findMany({
          where: {
            asset: { organizationId },
            eventType: RenewalEventType.RENEWED,
            createdAt: { gte: sixMonthsAgo },
          },
          select: { createdAt: true },
        }),
        this.prisma.asset.groupBy({
          by: ['assetType'],
          where: { organizationId, deletedAt: null, status: activeFilter },
          _count: { id: true },
        }),
      ]);

    // Activity by month (last 6 months)
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const activityMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      activityMap[`${d.getFullYear()}-${d.getMonth()}`] = 0;
    }
    for (const ev of renewalEvents) {
      const d = new Date(ev.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in activityMap) activityMap[key]++;
    }
    const activityByMonth = Object.entries(activityMap).map(([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return { month: monthNames[month], year, count };
    });

    // Asset breakdown by type
    const totalAssets = assetsByTypeRaw.reduce((s, r) => s + r._count.id, 0) || 1;
    const assetsByType = assetsByTypeRaw
      .sort((a, b) => b._count.id - a._count.id)
      .map((r) => ({
        type: r.assetType,
        count: r._count.id,
        pct: Math.round((r._count.id / totalAssets) * 100),
      }));

    return {
      total,
      expired: expiredCount,
      expiringIn7Days: expiringIn7,
      expiringIn30Days: expiringIn30,
      renewedThisMonth,
      activityByMonth,
      assetsByType,
    };
  }
}
