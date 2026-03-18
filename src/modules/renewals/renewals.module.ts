import { Module } from '@nestjs/common';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { RenewalsController } from './renewals.controller';
import { RenewalsService } from './renewals.service';

@Module({
  controllers: [RenewalsController],
  providers: [RenewalsService, OrgScopeGuard],
  exports: [RenewalsService],
})
export class RenewalsModule {}
