import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { UserRole } from '../../../auth/interfaces/rol';
import { Auth } from '../../../auth/services/auth';

@Component({
  selector: 'front-navbar',
  imports: [
    RouterLink, RouterLinkActive
  ],
  templateUrl: './navbar.html',
})
export class Navbar {

  authService = inject(Auth);
  protected readonly UserRole = UserRole;
  private router = inject(Router);
 
  logoutAndGoToLogin() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

}
