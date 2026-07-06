import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Auth } from './auth';
import { UserServices } from '../../user/services/UserServices';

describe('Auth', () => {
  let service: Auth;
  let userServiceMock: jasmine.SpyObj<UserServices>;

  beforeEach(() => {
    userServiceMock = jasmine.createSpyObj('UserServices', ['login']);

    TestBed.configureTestingModule({
      providers: [
        Auth,
        { provide: UserServices, useValue: userServiceMock },
      ],
    });

    service = TestBed.inject(Auth);
    localStorage.clear();
  });

  it('should authenticate when the API returns the token in a token field', (done) => {
    const payload = btoa(JSON.stringify({ sub: 'user-1', role: 'ADMIN' }));
    const token = `header.${payload}.signature`;

    userServiceMock.login.and.returnValue(of({ isSuccess: true, token } as any));

    service.login('user@example.com', '12345678').subscribe((result) => {
      expect(result).toBeTrue();
      expect(localStorage.getItem('token')).toBe(token);
      done();
    });
  });
});
