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
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { AssetShareLinksService } from './asset-share-links.service';
import { CreateAssetShareLinkDto } from './dto/create-asset-share-link.dto';

@ApiTags('Asset Share Links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('organizations/:orgId/assets/:assetId/share-links')
export class AssetShareLinksController {
  constructor(private readonly service: AssetShareLinksService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a read-only public share link. The plaintext token is returned ONCE.',
  })
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Param('assetId') assetId: string,
    @Body() dto: CreateAssetShareLinkDto,
  ) {
    return this.service.create(org.organizationId, assetId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List share links for this asset (no plaintext tokens)' })
  list(@CurrentOrg() org: OrgContext, @Param('assetId') assetId: string) {
    return this.service.list(org.organizationId, assetId);
  }

  @Delete(':linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a share link (sets revokedAt; row preserved for audit)' })
  revoke(
    @CurrentOrg() org: OrgContext,
    @Param('assetId') assetId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.service.revoke(org.organizationId, assetId, linkId);
  }
}
