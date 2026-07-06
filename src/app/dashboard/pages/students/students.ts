import { NgClass } from '@angular/common';
import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { SubjectDto } from '../../../subject/interfaces/SubjectDto';
import { SubjectsService } from '../../../subject/services/SubjectsService';
import { finalize, interval, Observable, of, startWith, Subscription, switchMap } from 'rxjs';
import { ApiResult } from '../../../response-control/interfaces/ApiResult';
import { SharedSubjectDto } from '../../../students/services/SharedSubjectDto';
import { RegistrationsService } from '../../../registration/services/RegistrationsService';
import { Auth } from '../../../auth/services/auth';
import { formatBackendErrorPayload } from '../../../response-control/error-formatter.utl';
import { UserServices } from '../../../user/services/UserServices';

@Component({
  selector: 'app-students',
  imports: [NgClass],
  templateUrl: './students.html',
})
export class Students implements OnInit, OnDestroy {
  // Inyecciones
  private authService = inject(Auth);
  private subjectsService = inject(SubjectsService);
  private usersService = inject(UserServices);
  private registrationsService = inject(RegistrationsService);

  // Estado Reactivo (Signals)
  estudianteNombre = 'Estudiante';
  public guidStudent = signal('');
  public subjects = signal<SubjectDto[]>([]);
  public sharedSubjects = signal<SharedSubjectDto[]>([]);

  public totalSeleccionadas = computed(() => this.subjects().filter(m => m.seleccionada).length);
  public limiteAlcanzado = computed(() => this.totalSeleccionadas() > 3);
  public puedeGuardar = computed(() => this.totalSeleccionadas() === 3);
  public hasExistingRegistrationWithSubjects = signal<boolean>(false);
  public selectedSubjects = computed(() => this.subjects().filter(m => m.seleccionada));

  // compañeros agrupados por materia optimizada con Signals
  public classmatesBySubject = computed(() => {
    const groupedBySubject = new Map<string, { subjectName: string; classmates: string[] }>();

    this.sharedSubjects().forEach(item => {
      const subjectId = this.normalizeId(this.getSubjectId(item));
      if (!subjectId) return;

      const classmateName = this.getClassmateName(item);
      if (!classmateName) return;

      const existing = groupedBySubject.get(subjectId) ?? {
        subjectName: this.getSubjectName(item),
        classmates: []
      };

      if (!existing.classmates.includes(classmateName)) {
        existing.classmates.push(classmateName);
      }

      groupedBySubject.set(subjectId, existing);
    });

    return this.selectedSubjects().map(subject => ({
      subjectName: groupedBySubject.get(this.normalizeId(subject.id))?.subjectName ?? subject.name,
      classmates: groupedBySubject.get(this.normalizeId(subject.id))?.classmates ?? []
    }));
  });

  public isLoading = signal<boolean>(true);
  public isSaving = signal<boolean>(false);
  public saveMessage = signal<string | null>(null);
  public saveMessageType = signal<'success' | 'error'>('success');
  public error = signal<string | null>(null);

  // Manejo de suscripciones y estados internos
  private subs = new Subscription();
  private pollingStarted = false;
  private selectedSubjectIdsFromServer = signal<string[]>([]);
  private currentRegistrationId: string | null = null;
  private saveMessageTimer: number | null = null;


  constructor() {}

  // inicializar datos
  ngOnInit() {
    this.loadStudentName();
    this.loadSubjects();
  }

  private loadStudentName() {
    const studentId = this.authService.user()?.id;
    if (!studentId) return;

    this.guidStudent.set(studentId);

    // Guardamos la suscripción para evitar fugas si el componente se destruye rápido
    this.subs.add(
      this.usersService.getStudentById(studentId).subscribe({
        next: (student) => {
          this.estudianteNombre = `${student.name} ${student.lastName}`;
          this.guidStudent.set(student.id || studentId);
          this.initSharedSubjectsFlow();
          this.loadSavedSubjectsSelection();
        },
        error: () => {
          this.initSharedSubjectsFlow();
          this.loadSavedSubjectsSelection();
        }
      })
    );
  }

  private initSharedSubjectsFlow() {
    this.startSharedSubjectsPolling();
    this.fetchSharedSubjects();
  }

  loadSubjects() {
    this.isLoading.set(true);
    this.error.set(null);

    this.subs.add(
      this.subjectsService.getAll().subscribe({
        next: (result: ApiResult<SubjectDto[]>) => {
          if (result.isSuccess && result.value) {
            this.subjects.set(result.value.filter(subject => subject.estado === 1));
            this.applySavedSelectionToSubjects();
          } else {
            this.error.set(result.error?.name ?? 'Ocurrió un error al procesar las materias');
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          this.setHttpError(err);
          this.isLoading.set(false);
        }
      })
    );
  }

  private startSharedSubjectsPolling() {
    if (this.pollingStarted || !this.guidStudent()) return;
    this.pollingStarted = true;

    this.subs.add(
      interval(15000).pipe(
        startWith(0),
        switchMap(() => this.registrationsService.getBySharedSubject(this.guidStudent()))
      ).subscribe({
        next: (result: ApiResult<SharedSubjectDto[]>) => this.handleSharedSubjectsResult(result),
        error: (err) => this.handleSharedSubjectsError(err)
      })
    );
  }

  private handleSharedSubjectsResult(result: ApiResult<SharedSubjectDto[]>) {
    if (result.isSuccess && Array.isArray(result.value)) {
      this.sharedSubjects.set(result.value);
    } else {
      this.sharedSubjects.set([]);
      this.error.set(result.error?.name ?? 'No se pudieron cargar los compañeros por materia');
    }
  }

  private handleSharedSubjectsError(err: any) {
    this.sharedSubjects.set([]);
    this.setHttpError(err);
  }

  toggleMateria(id: string) {
    if (this.hasExistingRegistrationWithSubjects()) return;

    const materiaAsociada = this.subjects().find(m => m.id === id);
    if (!materiaAsociada) return;

    if (!materiaAsociada.seleccionada && this.totalSeleccionadas() >= 3) return;

    this.subjects.update(lista =>
      lista.map(m => m.id === id ? { ...m, seleccionada: !m.seleccionada } : m)
    );

    this.fetchSharedSubjects();
  }

  saveSelectedSubjects() {
    if (!this.guidStudent()) return;

    if (this.hasExistingRegistrationWithSubjects()) {
      this.showTemporaryError('Ya tienes materias registradas. No es posible volver a guardar desde este formulario.');
      return;
    }

    if (this.totalSeleccionadas() !== 3) {
      this.showTemporaryError('Debes seleccionar exactamente 3 materias para guardar.');
      return;
    }

    const selectedSubjectIds = this.selectedSubjects().map(subject => subject.id);
    const createRequest$: Observable<ApiResult<string>> = selectedSubjectIds.length
      ? this.registrationsService.create({
          studentId: this.guidStudent(),
          subjectId: selectedSubjectIds,
          status: 1
        })
      : of({ isSuccess: true, value: 'Materias actualizadas correctamente.' });

    const request$: Observable<ApiResult<string>> = this.currentRegistrationId
      ? this.registrationsService.delete(this.currentRegistrationId).pipe(
          switchMap((deleteResult: ApiResult<string> | null) => {
            if (deleteResult && !deleteResult.isSuccess) return of(deleteResult);
            return createRequest$;
          })
        )
      : createRequest$;

    this.isSaving.set(true);
    this.error.set(null);
    this.saveMessage.set(null);

    this.subs.add(
      request$.pipe(
        finalize(() => this.isSaving.set(false))
      ).subscribe({
        next: (result: ApiResult<string>) => {
          if (result.isSuccess) {
            const successMessage = typeof result.value === 'string' && result.value.trim()
              ? 'Materias guardadas correctamente bajo el id: ' + result.value
              : 'Materias guardadas correctamente.';
            this.showTemporarySuccess(successMessage);
            this.loadSavedSubjectsSelection();
            this.fetchSharedSubjects();
            return;
          }
          this.showTemporaryError(result.error?.name ?? 'No se pudieron guardar las materias.');
        },
        error: (err) => {
          const message = formatBackendErrorPayload(err);
          this.showTemporaryError(`No se pudo guardar: ${message}`);
        }
      })
    );
  }

  private fetchSharedSubjects() {
    if (!this.guidStudent()) return;

    this.subs.add(
      this.registrationsService.getBySharedSubject(this.guidStudent()).subscribe({
        next: (result: ApiResult<SharedSubjectDto[]>) => this.handleSharedSubjectsResult(result),
        error: (err) => this.handleSharedSubjectsError(err)
      })
    );
  }

  private setHttpError(err: any) {
    this.error.set(formatBackendErrorPayload(err));
  }

  private loadSavedSubjectsSelection() {
    if (!this.guidStudent()) return;

    this.subs.add(
      this.registrationsService.getAll().subscribe({
        next: (registrations) => {
          const normalizedStudentId = this.normalizeId(this.guidStudent());
          const studentRegistrations = registrations.filter(registration =>
            this.normalizeId(registration.studentId) === normalizedStudentId
          );

          const currentRegistration = studentRegistrations.find(registration => registration.status === 1)
            ?? studentRegistrations[0]
            ?? null;

          this.currentRegistrationId = currentRegistration?.id ?? null;
          const hasExistingRegistration = (currentRegistration?.details?.length ?? 0) > 0;
          const hadExistingRegistration = this.hasExistingRegistrationWithSubjects();
          this.hasExistingRegistrationWithSubjects.set(hasExistingRegistration);

          if (hasExistingRegistration && !hadExistingRegistration) {
            this.showTemporaryError('Ya tienes materias registradas. El guardado queda deshabilitado para evitar duplicados.');
          }

          const selectedIds = currentRegistration?.details?.map(detail => detail.subjectId) ?? [];
          this.selectedSubjectIdsFromServer.set(selectedIds);
          this.applySavedSelectionToSubjects();
        },
        error: (err) => {
          this.currentRegistrationId = null;
          this.hasExistingRegistrationWithSubjects.set(false);
          this.selectedSubjectIdsFromServer.set([]);
          this.error.set(formatBackendErrorPayload(err));
        }
      })
    );
  }

  private applySavedSelectionToSubjects() {
    if (!this.subjects().length) return;

    const selectedSet = new Set(
      this.selectedSubjectIdsFromServer().map(subjectId => this.normalizeId(subjectId))
    );

    this.subjects.update(subjects =>
      subjects.map(subject => ({
        ...subject,
        seleccionada: selectedSet.has(this.normalizeId(subject.id))
      }))
    );
  }

  private resetMessageTimer(): void {
    if (this.saveMessageTimer) {
      window.clearTimeout(this.saveMessageTimer);
      this.saveMessageTimer = null;
    }
  }

  private showTemporaryError(message: string, durationMs = 5000): void {
    this.resetMessageTimer();
    this.saveMessageType.set('error');
    this.saveMessage.set(message);
    this.saveMessageTimer = window.setTimeout(() => this.saveMessage.set(null), durationMs);
  }

  private showTemporarySuccess(message: string, durationMs = 5000): void {
    this.resetMessageTimer();
    this.saveMessageType.set('success');
    this.saveMessage.set(message);
    this.saveMessageTimer = window.setTimeout(() => this.saveMessage.set(null), durationMs);
  }

  // Angular llama a esta función al destruir la vista
  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.resetMessageTimer();
  }

  private normalizeId(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private getSubjectId(item: SharedSubjectDto): string {
    return (item.subjectId ?? '').trim();
  }

  private getSubjectName(item: SharedSubjectDto): string {
    return (item.subjectName ?? '').trim();
  }

  private getClassmateName(item: SharedSubjectDto): string {
    return (item.nameStudent ?? '').trim();
  }
}
