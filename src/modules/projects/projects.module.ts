import { Module } from '@nestjs/common';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, OrgScopeGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
