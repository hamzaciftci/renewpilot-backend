import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        clientName: dto.clientName,
        colorTag: dto.colorTag,
        createdByUserId: userId,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        _count: { select: { assets: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: {
        assets: {
          where: { deletedAt: null },
          orderBy: { renewalDate: 'asc' },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(organizationId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOne(organizationId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.clientName !== undefined && { clientName: dto.clientName }),
        ...(dto.colorTag !== undefined && { colorTag: dto.colorTag }),
      },
    });
  }

  async remove(organizationId: string, projectId: string) {
    await this.findOne(organizationId, projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }
}
