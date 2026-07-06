import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const isAuthRoute = req.url.includes('/api/users/login') || req.url.includes('/api/users/register');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token && !isAuthRoute) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Access-Token'] = token;
  }

  const authReq = req.clone({ setHeaders: headers });

  return next(authReq);
};
