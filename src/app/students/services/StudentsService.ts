import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StudentDto } from '../interfaces/StudentDto';
import { map, Observable } from 'rxjs';
import { ApiResult } from '../../response-control/interfaces/ApiResult';

@Injectable({
  providedIn: 'root',
})
export class StudentsService {
  private base = '/api/students';

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResult<StudentDto[]>> {
    return this.http.get<ApiResult<StudentDto[]>>(this.base);
  }

  getById(id: string) {
    return this.http.get<ApiResult<StudentDto>>(`${this.base}/${id}`).pipe(map(r => r.value!));
  }

  getByDni(dni: number) {
    return this.http.get<ApiResult<StudentDto>>(`${this.base}/${dni}`).pipe(map(r => r.value!));
  }

  getByEmail(email: string) {
    return this.http.get<ApiResult<StudentDto>>(`${this.base}/${encodeURIComponent(email)}`).pipe(map(r => r.value!));
  }

  create(payload: { dni: number; name: string; lastname: string; email: string; phoneNumber: string }) {
    return this.http.post<ApiResult<string>>(this.base, payload);
  }

  update(id: string, payload: { dni: number; name: string; lastName: string; email: string; phoneNumber: string }) {
    return this.http.put<ApiResult<any>>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

}
