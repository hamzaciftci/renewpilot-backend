import { Module } from '@nestjs/common';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgScopeGuard, RolesGuard],
  exports: [OrganizationsService, OrgScopeGuard, RolesGuard],
})
export class OrganizationsModule {}
