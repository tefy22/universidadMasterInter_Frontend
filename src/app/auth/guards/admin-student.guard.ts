import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../services/auth';
import { UserRole } from '../interfaces/rol';

export const roleGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const authService = inject(Auth);
  const router = inject(Router);

  const allowedRoles = (route.data?.['roles'] as UserRole[] | undefined) ?? [];

  if (!allowedRoles.length) {
    return true;
  }

  const isAuthenticated = await firstValueFrom(authService.checkAuthStatus());

  if (!isAuthenticated) {
    router.navigateByUrl('/auth/login');
    return false;
  }

  const userRole = authService.rol();
  const hasAccess = userRole !== null && allowedRoles.includes(userRole);

  if (!hasAccess) {
    router.navigateByUrl('/');
    return false;
  }

  return true;
};

export const roleLandingGuard: CanActivateFn = async () => {
  const authService = inject(Auth);
  const router = inject(Router);

  const isAuthenticated = await firstValueFrom(authService.checkAuthStatus());

  if (!isAuthenticated) {
    return router.createUrlTree(['/auth/login']);
  }

  const userRole = authService.rol();

  if (userRole === UserRole.Student) {
    return router.createUrlTree(['/students']);
  }

  if (userRole === UserRole.Theacher) {
    return router.createUrlTree(['/teachers']);
  }

  if (userRole === UserRole.Admin) {
    return router.createUrlTree(['/admin/subjects']);
  }

  return true;
};
