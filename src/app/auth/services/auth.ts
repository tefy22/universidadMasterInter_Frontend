import { computed, inject, Injectable, signal } from '@angular/core';
import { UserDto } from '../../user/interfaces/UserDto';
import { UserServices } from '../../user/services/UserServices';
import { catchError, map, Observable, of } from 'rxjs';
import { ApiResult } from '../../response-control/interfaces/ApiResult';
import { rxResource } from '@angular/core/rxjs-interop';
import { UserRole } from '../interfaces/rol';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

@Injectable({
  providedIn: 'root',
})
export class Auth {

  private _authStatus = signal<AuthStatus>('checking');
  private _user = signal<UserDto | null>(null);
  private _token = signal<string | null>(null);
  private _rol = signal<UserRole | null>(null);

  private userService = inject(UserServices);

  checkStatusResource = rxResource({
    stream: () => this.checkAuthStatus()
  });

  authStatus = computed<AuthStatus>(() => {
    if (this._authStatus() === 'checking') return 'checking';

    if (this._user()) return 'authenticated';

    return 'unauthenticated';
  });

  user = computed<UserDto | null>(() => this._user());
  token = computed<string | null>(() => this._token());
  rol = computed<UserRole | null>(() => this._rol());

  login(email: string, password: string): Observable<boolean> {
    return this.userService.login({ email, password }).pipe(
      map((response: ApiResult<string>) => {
        const token = response?.value ?? null;

        if (response?.isSuccess && token) {
          const decodedUser = this.decodeToken(token);
          const role = this.extractRoleFromClaims(decodedUser);

          localStorage.setItem('token', token);
          this._token.set(token);
          this._user.set({
            id: decodedUser?.sub ?? '',
            dni: 0,
            name: '',
            lastName: '',
            email,
            phoneNumber: '',
            roleId: role,
            status: 1,
          });
          this._rol.set((role as UserRole) || null);
          this._authStatus.set('authenticated');
          return true;
        }

        this._token.set(null);
        this._user.set(null);
        this._authStatus.set('unauthenticated');
        return false;
      }),
      catchError((error:any) => {
        this._token.set(null);
        this._user.set(null);
        this._authStatus.set('unauthenticated');
        return of(false);
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    this._token.set(null);
    this._user.set(null);
    this._authStatus.set('unauthenticated');
  }

  checkAuthStatus(): Observable<boolean> {
    const token = localStorage.getItem('token');

    if (!token) {
      this.logout();
      return of(false);
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return of(false);
    }

    this._token.set(token);
    this._authStatus.set('authenticated');

    if (!this._user()) {
      const decodedUser = this.decodeToken(token);
      const normalizedEmail = this.extractEmailFromClaims(decodedUser);
      const role = this.extractRoleFromClaims(decodedUser);
      this._user.set({
        id: decodedUser?.sub ?? '',
        dni: 0,
        name: '',
        lastName: '',
        email: normalizedEmail,
        phoneNumber: '',
        roleId: role,
        status: 1,
      });
      this._rol.set((role as UserRole) || null);
    }

    return of(true);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload?.exp) return false;

      return Math.floor(Date.now() / 1000) >= payload.exp;
    } catch {
      return true;
    }
  }

  private decodeToken(token: string): any {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  }

  private extractEmailFromClaims(decodedUser: any): string {
    const emailClaim =
      decodedUser?.email ??
      decodedUser?.unique_name ??
      decodedUser?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ??
      '';

    if (typeof emailClaim !== 'string') {
      return '';
    }

    const trimmedClaim = emailClaim.trim();
    const valueMatch = trimmedClaim.match(/Value\s*=\s*([^}\s]+)/i);

    if (valueMatch?.[1]) {
      return valueMatch[1].trim();
    }

    return trimmedClaim;
  }

  private extractRoleFromClaims(decodedUser: any): string {
    const rawRole =
      decodedUser?.roleId ??
      decodedUser?.RoleId ??
      decodedUser?.role ??
      decodedUser?.Role ??
      decodedUser?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
      '';

    return typeof rawRole === 'string' ? rawRole.trim().toUpperCase() : '';
  }



}

