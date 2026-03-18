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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { AssetsService } from './assets.service';
import { AssetFiltersDto } from './dto/asset-filters.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('organizations/:orgId/assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAssetDto,
  ) {
    return this.assetsService.create(org.organizationId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List assets with optional filters' })
  findAll(
    @CurrentOrg() org: OrgContext,
    @Query() filters: AssetFiltersDto,
  ) {
    return this.assetsService.findAll(org.organizationId, filters);
  }

  @Get(':assetId')
  @ApiOperation({ summary: 'Get a single asset with subtype details' })
  findOne(
    @CurrentOrg() org: OrgContext,
    @Param('assetId') assetId: string,
  ) {
    return this.assetsService.findOne(org.organizationId, assetId);
  }

  @Patch(':assetId')
  @ApiOperation({ summary: 'Update an asset' })
  update(
    @CurrentOrg() org: OrgContext,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assetsService.update(org.organizationId, assetId, dto);
  }

  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an asset' })
  remove(
    @CurrentOrg() org: OrgContext,
    @Param('assetId') assetId: string,
  ) {
    return this.assetsService.remove(org.organizationId, assetId);
  }

  @Get(':assetId/history')
  @ApiOperation({ summary: 'Get renewal event history for an asset' })
  getHistory(
    @CurrentOrg() org: OrgContext,
    @Param('assetId') assetId: string,
  ) {
    return this.assetsService.getHistory(org.organizationId, assetId);
  }
}
