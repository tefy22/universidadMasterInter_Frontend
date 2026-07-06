import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiResult } from '../../response-control/interfaces/ApiResult';
import { UserDto } from '../interfaces/UserDto';

type LegacyCreateUserPayload = {
  personId: string;
  rolId: string;
  email: string;
  password: string;
};

type UserCreatePayload = Omit<UserDto, 'id'> & { password: string };
type UserUpdatePayload = Omit<UserDto, 'id' | 'password'> & { password?: string };

@Injectable({
  providedIn: 'root',
})
export class UserServices {

  private base = '/api/users';
  private headers = new HttpHeaders({
    'Content-Type': 'application/json'
  });

  constructor(private http: HttpClient) {}

  getStudentById(id: string): Observable<UserDto> {
    return this.http.get<ApiResult<UserDto>>(`${this.base}/students/${id}`).pipe(map(r => r.value ?? {} as UserDto));
  }

  getAllTeachers(): Observable<UserDto[]> {
    return this.http.get<ApiResult<UserDto[]>>(`${this.base}/teachers`).pipe(map(r => r.value ?? []));
  }

  getAll(): Observable<UserDto[]> {
    return this.http.get<ApiResult<UserDto[]>>(this.base).pipe(map(r => r.value ?? []));
  }

  create(payload: LegacyCreateUserPayload | UserCreatePayload): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.base}/register`, payload, { headers: this.headers });
  }

  update(id: string, payload: UserUpdatePayload): Observable<ApiResult<UserDto | string>> {
    return this.http.patch<ApiResult<UserDto | string>>(`${this.base}/${id}`, payload, { headers: this.headers });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  login(payload: { email: string; password: string }): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.base}/login`, payload, { headers: this.headers });
  }

}
