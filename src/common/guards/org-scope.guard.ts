import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId = request.params.orgId;

    if (!organizationId) {
      throw new NotFoundException('Organization ID is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.userId,
        },
      },
      include: {
        organization: {
          select: { id: true, status: true, deletedAt: true },
        },
      },
    });

    if (!membership || membership.organization.deletedAt) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    request.org = {
      organizationId,
      role: membership.role,
    };

    return true;
  }
}
