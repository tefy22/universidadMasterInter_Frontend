import { Routes } from '@angular/router';
import { DashboardFrontLayout } from './layouts/dashboard-front-layout/dashboard-front-layout';
import { HomePage } from './pages/home-page/home-page';
import { Students } from './pages/students/students';
import { Teachers } from './pages/teachers/teachers';
import { AdminSubjects } from './pages/admin-subjects/admin-subjects';
import { AdminRegistrations } from './pages/admin-registrations/admin-registrations';
import { AdminUser } from './pages/admin-user/admin-user';
import { AuthGuard } from '../auth/guards/auth.guard';
import { roleGuard, roleLandingGuard } from '../auth/guards/admin-student.guard';
import { UserRole } from '../auth/interfaces/rol';

export const dashboardRoutes: Routes = [
  {
    path: '',
    component: DashboardFrontLayout,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        component: HomePage,
        canActivate: [roleLandingGuard]
      },
      {
        path: 'students',
        component: Students,
        canActivate: [roleGuard],
        data: { roles: [UserRole.Student] }
      },
      {
        path:'teachers',
        component: Teachers,
        canActivate: [roleGuard],
        data: { roles: [UserRole.Theacher] }
      },
      {
        path: 'admin/subjects',
        component: AdminSubjects,
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] }
      },
      {
        path: 'admin/registrations',
        component: AdminRegistrations,
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] }
      },
      {
        path: 'admin/users',
        component: AdminUser,
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] }
      }

    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
]

export default dashboardRoutes;
