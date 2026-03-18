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

    const [total, expiredCount, expiringIn7, expiringIn30] = await Promise.all([
      this.prisma.asset.count({
        where: { organizationId, deletedAt: null, status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] } },
      }),
      this.prisma.asset.count({
        where: { organizationId, deletedAt: null, renewalDate: { lt: now }, status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] } },
      }),
      this.prisma.asset.count({
        where: { organizationId, deletedAt: null, renewalDate: { gte: now, lte: in7 }, status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] } },
      }),
      this.prisma.asset.count({
        where: { organizationId, deletedAt: null, renewalDate: { gte: now, lte: in30 }, status: { notIn: [AssetStatus.CANCELLED, AssetStatus.ARCHIVED] } },
      }),
    ]);

    return { total, expired: expiredCount, expiringIn7Days: expiringIn7, expiringIn30Days: expiringIn30 };
  }
}
