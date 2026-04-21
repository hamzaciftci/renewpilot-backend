import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvitationsService } from './invitations.service';

/**
 * Public-ish endpoints for invitation acceptance flow.
 * GET /invitations/:token — no auth; the token IS the secret.
 * POST /invitations/:token/accept — requires login (must match invite email).
 */
@ApiTags('Invitations — Public')
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Davet detaylarını token ile getir (public, auth gerektirmez)',
  })
  getByToken(@Param('token') token: string) {
    return this.invitationsService.getByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Daveti kabul et — giriş yapmış kullanıcının e-postası davetle eşleşmeli',
  })
  accept(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.invitationsService.accept(token, user.userId);
  }
}
