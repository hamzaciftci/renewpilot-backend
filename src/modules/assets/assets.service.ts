import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RenewalEventType } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service';
import { daysUntilExpiry, getExpiryStatus } from '../../common/utils/date.utils';
import { AssetFiltersDto } from './dto/asset-filters.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateAssetDto) {
    const renewalDate = new Date(dto.renewalDate);
    const status = getExpiryStatus(daysUntilExpiry(renewalDate));

    // Credit cards are monthly-recurring by nature.
    const isCreditCard = dto.assetType === 'CREDIT_CARD';
    const renewalIntervalUnit = isCreditCard ? 'month' : undefined;
    const renewalIntervalValue = isCreditCard ? 1 : undefined;

    const asset = await this.prisma.asset.create({
      data: {
        organizationId,
        assetType: dto.assetType,
        name: dto.name,
        vendorName: dto.vendorName,
        renewalDate,
        status,
        priceAmount: dto.priceAmount ? new Prisma.Decimal(dto.priceAmount) : undefined,
        priceCurrency: dto.priceCurrency ?? 'USD',
        projectId: dto.projectId,
        assignedUserId: dto.assignedUserId,
        notes: dto.notes,
        metadata: dto.metadata as any,
        ...(renewalIntervalUnit && { renewalIntervalUnit }),
        ...(renewalIntervalValue && { renewalIntervalValue }),
        createdByUserId: userId,
      },
    });

    await this.prisma.renewalEvent.create({
      data: {
        assetId: asset.id,
        eventType: RenewalEventType.CREATED,
        newRenewalDate: renewalDate,
        performedByUserId: userId,
      },
    });

    return asset;
  }

  async findAll(organizationId: string, filters: AssetFiltersDto) {
    const where: Prisma.AssetWhereInput = {
      organizationId,
      deletedAt: null,
      ...(filters.assetType && { assetType: filters.assetType }),
      ...(filters.status && { status: filters.status }),
      ...(filters.projectId && { projectId: filters.projectId }),
      ...(filters.assignedUserId && { assignedUserId: filters.assignedUserId }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          { vendorName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
      ...(filters.renewalFrom || filters.renewalTo
        ? {
            renewalDate: {
              ...(filters.renewalFrom && { gte: new Date(filters.renewalFrom) }),
              ...(filters.renewalTo && { lte: new Date(filters.renewalTo) }),
            },
          }
        : {}),
    };

    return this.prisma.asset.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, colorTag: true } },
        assignedUser: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { renewalDate: 'asc' },
    });
  }

  async findOne(organizationId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, organizationId, deletedAt: null },
      include: {
        project: true,
        assignedUser: { select: { id: true, fullName: true, email: true } },
        domain: true,
        server: true,
        sslCertificate: true,
        license: true,
        hostingService: true,
        cdnService: true,
      },
    });

    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(organizationId: string, assetId: string, dto: UpdateAssetDto) {
    await this.findOne(organizationId, assetId);

    const updateData: Prisma.AssetUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.vendorName !== undefined && { vendorName: dto.vendorName }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.projectId !== undefined && { project: { connect: { id: dto.projectId } } }),
      ...(dto.assignedUserId !== undefined && {
        assignedUser: { connect: { id: dto.assignedUserId } },
      }),
      ...(dto.priceAmount !== undefined && {
        priceAmount: new Prisma.Decimal(dto.priceAmount),
      }),
      ...(dto.priceCurrency !== undefined && { priceCurrency: dto.priceCurrency }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata as any }),
    };

    if (dto.renewalDate) {
      const newDate = new Date(dto.renewalDate);
      updateData.renewalDate = newDate;
      updateData.status = getExpiryStatus(daysUntilExpiry(newDate));
    }

    return this.prisma.asset.update({
      where: { id: assetId },
      data: updateData,
    });
  }

  async remove(organizationId: string, assetId: string) {
    await this.findOne(organizationId, assetId);
    await this.prisma.asset.update({
      where: { id: assetId },
      data: { deletedAt: new Date() },
    });
  }

  async getHistory(organizationId: string, assetId: string) {
    await this.findOne(organizationId, assetId);
    return this.prisma.renewalEvent.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
