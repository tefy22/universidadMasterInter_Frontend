import { Injectable } from '@angular/core';
import { RegistrationDto } from '../interfaces/RegistrationDto';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiResult } from '../../response-control/interfaces/ApiResult';
import { SharedSubjectDto } from '../../students/services/SharedSubjectDto';

@Injectable({
  providedIn: 'root',
})
export class RegistrationsService {
  private base = '/api/registrations';

  constructor(private http: HttpClient) {}

  getAll(): Observable<RegistrationDto[]> {
    return this.http.get<ApiResult<RegistrationDto[]>>(this.base).pipe(map(r => r.value ?? []));
  }

  create(payload: { studentId: string; subjectId: string[]; status: number }) {
    return this.http.post<ApiResult<string>>(this.base, payload);
  }

  delete(id: string) {
    return this.http.delete<ApiResult<string> | null>(`${this.base}/${id}`);
  }

  getBySharedSubject(StudentId: string): Observable<ApiResult<SharedSubjectDto[]>> {
    return this.http.get<ApiResult<SharedSubjectDto[]>>(`${this.base}/shared/${StudentId}`);
  }
}
