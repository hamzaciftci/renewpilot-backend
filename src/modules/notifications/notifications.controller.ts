import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { NotificationsService } from './notifications.service';
import type { UpdatePreferencesDto } from './notifications.service';
import { NotificationDispatcherService } from './dispatchers/notification-dispatcher.service';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('organizations/:orgId/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  getPreferences(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(org.organizationId, user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(org.organizationId, user.userId, dto);
  }

  @Post('test')
  @ApiOperation({ summary: 'Send a test notification through a specific channel' })
  async testNotification(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Body() body: { channel: NotificationChannel },
  ) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, fullName: true, phoneNumber: true },
    });

    if (!userRecord) throw new Error('User not found');

    const channel = body.channel;
    const result = await this.dispatcher.dispatch({
      to: {
        userId: user.userId,
        email: userRecord.email,
        phoneNumber: userRecord.phoneNumber ?? undefined,
        fullName: userRecord.fullName,
      },
      channel,
      subject: 'RenewPilot Test Bildirimi ✓',
      body: `Merhaba ${userRecord.fullName},\n\n${channel} kanalı başarıyla yapılandırılmış. Yenileme hatırlatıcılarınız bu kanal üzerinden gelecek.\n\n— RenewPilot`,
      html: `<div style="font-family:sans-serif;padding:20px;"><h2>✓ Test Başarılı</h2><p>Merhaba <strong>${userRecord.fullName}</strong>,</p><p><strong>${channel}</strong> kanalı başarıyla yapılandırılmış.</p><p>Yenileme hatırlatıcılarınız bu kanal üzerinden gelecek.</p><p>— RenewPilot</p></div>`,
      pushUrl: '/notifications',
    });

    return result;
  }
}
