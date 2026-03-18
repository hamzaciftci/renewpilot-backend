import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('organizations/:orgId/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project within an organization' })
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(org.organizationId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects in the organization' })
  findAll(@CurrentOrg() org: OrgContext) {
    return this.projectsService.findAll(org.organizationId);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get a project with its assets' })
  findOne(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.findOne(org.organizationId, projectId);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(org.organizationId, projectId, dto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive (soft-delete) a project' })
  remove(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.remove(org.organizationId, projectId);
  }
}
