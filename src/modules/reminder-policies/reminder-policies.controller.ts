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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MemberRole } from '@prisma/client';
import { CreateReminderPolicyDto } from './dto/create-reminder-policy.dto';
import { UpdateReminderPolicyDto } from './dto/update-reminder-policy.dto';
import { ReminderPoliciesService } from './reminder-policies.service';

@ApiTags('Reminder Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
@Controller('organizations/:orgId/reminder-policies')
export class ReminderPoliciesController {
  constructor(private readonly service: ReminderPoliciesService) {}

  @Post()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Create a reminder policy' })
  create(@CurrentOrg() org: OrgContext, @Body() dto: CreateReminderPolicyDto) {
    return this.service.create(org.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all reminder policies' })
  findAll(@CurrentOrg() org: OrgContext) {
    return this.service.findAll(org.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reminder policy' })
  findOne(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.service.findOne(org.organizationId, id);
  }

  @Patch(':id')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Update a reminder policy' })
  update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateReminderPolicyDto,
  ) {
    return this.service.update(org.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a reminder policy' })
  remove(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.service.remove(org.organizationId, id);
  }

  @Post('ensure-default')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Ensure org has a default reminder policy (auto-creates if missing)' })
  ensureDefault(@CurrentOrg() org: OrgContext) {
    return this.service.ensureDefault(org.organizationId);
  }
}
