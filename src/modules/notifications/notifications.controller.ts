import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('organizations/:orgId/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  list(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.getForUser(org.organizationId, user.userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(org.organizationId, user.userId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(org.organizationId, user.userId, notificationId);
  }
}
