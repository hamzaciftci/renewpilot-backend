import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssetShareLinksService } from './asset-share-links.service';

/**
 * Public, unauthenticated read endpoint. The token in the URL IS the secret;
 * possessing it grants view access to the sanitized asset payload.
 *
 * Mounted at /share/:token — sibling of /invitations/:token.
 */
@ApiTags('Asset Share Links — Public')
@Controller('share')
export class PublicAssetShareLinksController {
  constructor(private readonly service: AssetShareLinksService) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'Resolve a share link by its token. No auth required — the token is the secret.',
  })
  resolve(@Param('token') token: string) {
    return this.service.resolveByToken(token);
  }
}
