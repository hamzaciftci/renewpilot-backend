import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export interface OrgContext {
  organizationId: string;
  role: MemberRole;
}

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.org;
  },
);
