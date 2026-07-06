import { Injectable } from '@angular/core';
import { SubjectDto } from '../interfaces/SubjectDto';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResult } from '../../response-control/interfaces/ApiResult';

@Injectable({
  providedIn: 'root',
})
export class SubjectsService {
  private base = '/api/subjects';

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResult<SubjectDto[]>> {
    return this.http.get<ApiResult<SubjectDto[]>>(`${this.base}/all`);
  }

  getById(id: string): Observable<ApiResult<SubjectDto>> {
    return this.http.get<ApiResult<SubjectDto>>(`${this.base}/${id}`);
  }

  create(payload: { name: string; credits: number; idUser?: string }): Observable<ApiResult<SubjectDto>> {
    return this.http.post<ApiResult<SubjectDto>>(this.base, payload);
  }

  update(id: string, payload: { name: string; credits: number; idTeacher: string; idUser?: string; estado: number }): Observable<ApiResult<SubjectDto>> {
    return this.http.patch<ApiResult<SubjectDto>>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
