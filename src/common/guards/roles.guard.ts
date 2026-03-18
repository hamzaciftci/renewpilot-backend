import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<MemberRole, number> = {
  [MemberRole.OWNER]: 4,
  [MemberRole.ADMIN]: 3,
  [MemberRole.MEMBER]: 2,
  [MemberRole.VIEWER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const orgContext = request.org;

    if (!orgContext) {
      throw new ForbiddenException('Organization context not found');
    }

    const userLevel = ROLE_HIERARCHY[orgContext.role as MemberRole] ?? 0;
    const hasRole = requiredRoles.some(
      (role) => userLevel >= ROLE_HIERARCHY[role],
    );

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    return true;
  }
}
