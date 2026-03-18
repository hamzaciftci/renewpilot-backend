import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Post('organizations')
  @ApiOperation({ summary: 'Create a new organization workspace' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgsService.create(user.userId, dto);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations for the current user' })
  listMyOrgs(@CurrentUser() user: JwtPayload) {
    return this.orgsService.getUserOrganizations(user.userId);
  }

  @Get('organizations/:orgId')
  @UseGuards(OrgScopeGuard)
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('orgId') orgId: string) {
    return this.orgsService.findById(orgId);
  }

  @Patch('organizations/:orgId')
  @UseGuards(OrgScopeGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Update organization settings (admin+)' })
  update(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgsService.update(orgId, dto);
  }

  @Get('organizations/:orgId/members')
  @UseGuards(OrgScopeGuard)
  @ApiOperation({ summary: 'List organization members' })
  getMembers(
    @CurrentOrg() org: OrgContext,
  ) {
    return this.orgsService.getMembers(org.organizationId);
  }
}
