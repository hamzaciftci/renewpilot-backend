import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
@Roles(MemberRole.ADMIN)
@Controller('organizations/:orgId/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Yeni üye daveti oluştur ve e-posta gönder (admin+)' })
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(org.organizationId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Organizasyonun tüm davetlerini listele (admin+)' })
  list(@CurrentOrg() org: OrgContext) {
    return this.invitationsService.listForOrg(org.organizationId);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bekleyen bir daveti iptal et (admin+)' })
  revoke(@CurrentOrg() org: OrgContext, @Param('invitationId') invitationId: string) {
    return this.invitationsService.revoke(org.organizationId, invitationId);
  }

  @Post(':invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bekleyen daveti tekrar gönder (token rotate ile) (admin+)' })
  resend(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationsService.resend(org.organizationId, invitationId, user.userId);
  }
}
