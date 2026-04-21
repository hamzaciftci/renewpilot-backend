import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/db/prisma.module';
import { NotificationsServerlessModule } from '../notifications/notifications-serverless.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { PublicInvitationsController } from './public-invitations.controller';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationsServerlessModule],
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
