import { Module } from '@nestjs/common';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { AssetShareLinksController } from './asset-share-links.controller';
import { AssetShareLinksService } from './asset-share-links.service';
import { PublicAssetShareLinksController } from './public-asset-share-links.controller';

@Module({
  controllers: [AssetShareLinksController, PublicAssetShareLinksController],
  providers: [AssetShareLinksService, OrgScopeGuard],
  exports: [AssetShareLinksService],
})
export class AssetShareLinksModule {}
