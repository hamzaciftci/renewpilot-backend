import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { RenewalsService } from './renewals.service';

class RenewAssetDto {
  @IsOptional()
  @IsDateString()
  newRenewalDate?: string;
}

@ApiTags('Renewals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('organizations/:orgId/renewals')
export class RenewalsController {
  constructor(private renewalsService: RenewalsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard summary counts (total, expired, expiring soon)' })
  getSummary(@CurrentOrg() org: OrgContext) {
    return this.renewalsService.getDashboardSummary(org.organizationId);
  }

  @Get('upcoming')
  @ApiQuery({ name: 'days', required: false, description: 'Look-ahead days (default 30)' })
  @ApiOperation({ summary: 'List assets renewing within N days' })
  getUpcoming(
    @CurrentOrg() org: OrgContext,
    @Query('days') days?: string,
  ) {
    return this.renewalsService.getUpcoming(org.organizationId, days ? parseInt(days, 10) : 30);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'List expired / overdue assets' })
  getOverdue(@CurrentOrg() org: OrgContext) {
    return this.renewalsService.getOverdue(org.organizationId);
  }

  @Get('calendar')
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'month', required: true, description: '1-12' })
  @ApiOperation({ summary: 'Get renewals for a specific month (calendar view)' })
  getCalendar(
    @CurrentOrg() org: OrgContext,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.renewalsService.getCalendar(
      org.organizationId,
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  @Post('assets/:assetId/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an asset as renewed and advance its renewal date' })
  renew(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Param('assetId') assetId: string,
    @Body() dto: RenewAssetDto,
  ) {
    return this.renewalsService.recordRenewal(
      org.organizationId,
      assetId,
      user.userId,
      dto.newRenewalDate,
    );
  }
}
