import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { CreateReminderPolicyDto } from './dto/create-reminder-policy.dto';
import { UpdateReminderPolicyDto } from './dto/update-reminder-policy.dto';

@Injectable()
export class ReminderPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, dto: CreateReminderPolicyDto) {
    // Validate offsetDays are unique + sorted
    const offsets = Array.from(new Set(dto.offsetDays)).sort((a, b) => b - a);

    // If this is being set as default, unset other defaults first
    if (dto.isDefault) {
      await this.prisma.reminderPolicy.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.reminderPolicy.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        offsetDays: offsets,
        channelConfig: (dto.channelConfig ?? {}) as any,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.reminderPolicy.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(orgId: string, id: string) {
    const policy = await this.prisma.reminderPolicy.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!policy) throw new NotFoundException('Reminder policy not found');
    return policy;
  }

  async update(orgId: string, id: string, dto: UpdateReminderPolicyDto) {
    await this.findOne(orgId, id);

    // If setting as default, unset others
    if (dto.isDefault) {
      await this.prisma.reminderPolicy.updateMany({
        where: { organizationId: orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.offsetDays !== undefined) {
      data.offsetDays = Array.from(new Set(dto.offsetDays)).sort((a, b) => b - a);
    }
    if (dto.channelConfig !== undefined) data.channelConfig = dto.channelConfig;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

    return this.prisma.reminderPolicy.update({
      where: { id },
      data,
    });
  }

  async remove(orgId: string, id: string) {
    const policy = await this.findOne(orgId, id);
    if (policy.isDefault) {
      throw new BadRequestException('Cannot delete the default policy. Set another as default first.');
    }
    await this.prisma.reminderPolicy.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Ensures the org has at least one default reminder policy.
   * Creates a sensible default if none exists.
   */
  async ensureDefault(orgId: string) {
    const existing = await this.prisma.reminderPolicy.findFirst({
      where: { organizationId: orgId, isDefault: true },
    });
    if (existing) return existing;

    return this.prisma.reminderPolicy.create({
      data: {
        organizationId: orgId,
        name: 'Varsayılan Politika',
        offsetDays: [60, 30, 14, 7, 3, 1, 0, -1, -3, -7] as any,
        channelConfig: { email: true, sms: false, whatsapp: false, push: false } as any,
        isDefault: true,
      },
    });
  }
}
