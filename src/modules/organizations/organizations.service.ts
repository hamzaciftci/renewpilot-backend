import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service';
import { generateSlug } from '../../common/utils/encryption.utils';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug ?? generateSlug(dto.name);

    const existing = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('An organization with this slug already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          ownerUserId: userId,
          timezone: dto.timezone ?? 'UTC',
          currency: dto.currency ?? 'USD',
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          role: MemberRole.OWNER,
        },
      });

      return org;
    });
  }

  async findById(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: {
        plan: true,
        subscription: true,
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    if (dto.slug) {
      const existing = await this.prisma.organization.findFirst({
        where: { slug: dto.slug, NOT: { id: orgId } },
      });
      if (existing) {
        throw new ConflictException('This slug is already taken');
      }
    }

    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.timezone && { timezone: dto.timezone }),
        ...(dto.currency && { currency: dto.currency }),
      },
    });
  }

  async getMembers(orgId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async getUserOrganizations(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
