import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service';
import { generateSlug } from '../../common/utils/encryption.utils';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
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

  async inviteMember(orgId: string, invitedByUserId: string, dto: InviteMemberDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException('This user is already a member of the organization');
    }

    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: dto.role ?? MemberRole.MEMBER,
        invitedByUserId,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, avatarUrl: true, status: true },
        },
      },
    });

    return member;
  }

  async updateMemberRole(orgId: string, actorUserId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const targetMember = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (!targetMember) throw new NotFoundException('Member not found');
    if (targetMember.role === MemberRole.OWNER) {
      throw new ForbiddenException('Cannot change the role of the organization owner');
    }
    if (dto.role === MemberRole.OWNER) {
      throw new ForbiddenException('Cannot assign OWNER role');
    }

    return this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, avatarUrl: true, status: true },
        },
      },
    });
  }

  async removeMember(orgId: string, actorUserId: string, targetUserId: string) {
    const targetMember = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (!targetMember) throw new NotFoundException('Member not found');
    if (targetMember.role === MemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove the organization owner');
    }

    await this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });

    return { message: 'Member removed successfully' };
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
