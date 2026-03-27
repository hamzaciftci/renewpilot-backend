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
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
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
  getMembers(@CurrentOrg() org: OrgContext) {
    return this.orgsService.getMembers(org.organizationId);
  }

  @Post('organizations/:orgId/members/invite')
  @UseGuards(OrgScopeGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Invite a user to the organization (admin+)' })
  inviteMember(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgsService.inviteMember(org.organizationId, user.userId, dto);
  }

  @Patch('organizations/:orgId/members/:userId/role')
  @UseGuards(OrgScopeGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Update member role (admin+)' })
  updateMemberRole(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.orgsService.updateMemberRole(org.organizationId, user.userId, targetUserId, dto);
  }

  @Delete('organizations/:orgId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgScopeGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member from the organization (admin+)' })
  removeMember(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetUserId: string,
  ) {
    return this.orgsService.removeMember(org.organizationId, user.userId, targetUserId);
  }
}
