import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    diff?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({ data: params as any });
  }

  async findAll(organizationId: string, resourceType?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(resourceType && { resourceType }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
