import { Component, ElementRef, signal, ViewChild, computed, effect, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RegistrationDto } from '../../../registration/interfaces/RegistrationDto';
import { RegistrationsService } from '../../../registration/services/RegistrationsService';
import { StudentsService } from '../../../students/services/StudentsService';
import { SubjectsService } from '../../../subject/services/SubjectsService';
import { StudentDto } from '../../../students/interfaces/StudentDto';
import { SubjectDto } from '../../../subject/interfaces/SubjectDto';
import { ApiResult } from '../../../response-control/interfaces/ApiResult';
import { UserServices } from '../../../user/services/UserServices';
import { UserRole } from '../../../auth/interfaces/rol';
import { interval, Subscription, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-admin-registrations',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-registrations.html',
})
export class AdminRegistrations implements OnInit, OnDestroy {
  // 1. Inyección de dependencias moderna unificada con inject()
  private registrationsService = inject(RegistrationsService);
  private studentsService = inject(StudentsService);
  private subjectsService = inject(SubjectsService);
  private userServices = inject(UserServices);
  private fb = inject(FormBuilder);

  @ViewChild('registrationModal') modalElement!: ElementRef<HTMLDialogElement>;

  // Estado Reactivo (Signals)
  public registrations = signal<RegistrationDto[]>([]);
  public students = signal<StudentDto[]>([]);
  public subjects = signal<SubjectDto[]>([]);
  public isLoading = signal<boolean>(true);
  public isSubmitting = signal<boolean>(false);
  public successMessage = signal<string | null>(null);
  public errorMessage = signal<string | null>(null);
  public editingRegistration = signal<RegistrationDto | null>(null);
  public filterText = signal<string>('');
  public currentPage = signal<number>(1);
  public pageSize = signal<number>(10);
  public readonly pageSizeOptions = [5, 10, 20];
  public lastRefreshed = signal<string>('');

  private latestRegistrationsJson = '';
  private messageTimeout = 0;
  private readonly pollIntervalMs = 15000;

  // Manejador centralizado de suscripciones RxJS (Evita fugas de memoria)
  private subs = new Subscription();

  // Computeds impecables de tu lógica original
  public filteredRegistrations = computed(() => {
    const filter = this.filterText().trim().toLowerCase();
    if (!filter) return this.registrations();

    return this.registrations().filter(reg => {
      const studentName = reg.studentName?.toLowerCase() ?? '';
      const status = reg.status === 1 ? 'activo' : 'inactivo';
      return studentName.includes(filter) || status.includes(filter) || reg.id.includes(filter);
    });
  });

  public pageCount = computed(() => Math.max(1, Math.ceil(this.filteredRegistrations().length / this.pageSize())));

  public pagedRegistrations = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredRegistrations().slice(start, start + this.pageSize());
  });

  private synchronizePage = effect(() => {
    if (this.currentPage() > this.pageCount()) {
      this.currentPage.set(this.pageCount());
    }
  });

  public registrationForm!: FormGroup;

  constructor() {}

  // 2. El ciclo de vida correcto para arrancar flujos de datos
  ngOnInit(): void {
    this.initForm();
    this.loadStudents();
    this.loadSubjects();
    this.startPollingRegistrations(); // El polling se encarga de la primera carga y del ciclo continuo de forma segura
  }

  private initForm(): void {
    this.registrationForm = this.fb.group({
      studentId: ['', [Validators.required]],
      subjectIds: [[], [Validators.required]],
      status: [1]
    });
  }

  private formatBackendErrorPayload(rawError: any): string {
    if (!rawError) return 'No se pudo establecer comunicación con el servidor. Inténtalo de nuevo.';
    const payload = rawError?.error ?? rawError;

    if (typeof payload === 'string' && payload.trim()) return payload;

    if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        return payload.errors
          .map((item: any) => {
            const prop = item.propertyName || item.property || item.field || '';
            const msg = item.errorMessage || item.message || item.description || '';
            return prop ? `${prop}: ${msg}` : msg;
          })
          .filter(Boolean)
          .join(' | ');
      }
      if (payload.message && typeof payload.message === 'string' && payload.message.trim()) return payload.message;
      if (payload.title || payload.detail) return [payload.title, payload.detail].filter(Boolean).join(': ');
      if (payload.name && payload.name !== 'HttpErrorResponse') return payload.name;
    }

    if (typeof rawError.message === 'string' && rawError.message.trim()) return rawError.message;
    return 'Ocurrió un error al procesar la solicitud. Revisa los datos e inténtalo de nuevo.';
  }

  private loadRegistrations(showLoading: boolean = false): void {
    if (showLoading) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    this.subs.add(
      this.registrationsService.getAll().subscribe({
        next: (registrations) => {
          this.updateRegistrationsIfChanged(registrations);
          this.lastRefreshed.set(new Date().toLocaleTimeString());
          if (showLoading) this.isLoading.set(false);
        },
        error: (err) => {
          const message = this.formatBackendErrorPayload(err);
          this.showTemporaryError(message);
          if (showLoading) this.isLoading.set(false);
        }
      })
    );
  }

  private updateRegistrationsIfChanged(registrations: RegistrationDto[]): void {
    const json = JSON.stringify(registrations);
    if (json !== this.latestRegistrationsJson) {
      this.latestRegistrationsJson = json;
      this.registrations.set(registrations);
    }
  }

  private loadStudents(): void {
    this.subs.add(
      this.studentsService.getAll().subscribe({
        next: (result: ApiResult<StudentDto[]>) => {
          if (result.isSuccess && result.value && result.value.length > 0) {
            this.students.set(result.value);
          } else {
            this.loadStudentsFromUsersFallback();
          }
        },
        error: () => this.loadStudentsFromUsersFallback()
      })
    );
  }

  private loadStudentsFromUsersFallback(): void {
    this.subs.add(
      this.userServices.getAll().subscribe({
        next: (users) => {
          const students = users
            .filter(user => this.normalizeRoleId(user.roleId) === UserRole.Student)
            .map(user => ({
              id: user.id,
              dni: user.dni,
              name: user.name,
              lastname: user.lastName,
              email: user.email,
              phoneNumber: user.phoneNumber
            }));
          this.students.set(students);
        },
        error: (err) => console.error('Error al cargar estudiantes desde usuarios', err)
      })
    );
  }

  private normalizeRoleId(roleId: string | null | undefined): string {
    return (roleId ?? '').trim().toUpperCase();
  }

  private loadSubjects(): void {
    this.subs.add(
      this.subjectsService.getAll().subscribe({
        next: (result: ApiResult<SubjectDto[]>) => {
          if (result.isSuccess && result.value) {
            this.subjects.set(result.value.filter(subject => subject.estado === 1));
          } else {
            console.error('Error en respuesta de materias', result.error);
          }
        },
        error: (err) => console.error('Error al cargar materias', err)
      })
    );
  }

  // 3. Polling moderno optimizado usando RxJS puro
  private startPollingRegistrations(): void {
    this.subs.add(
      interval(this.pollIntervalMs).pipe(
        startWith(0), // Dispara inmediatamente la primera carga al suscribirse
        switchMap(() => {
          // Si es la primera carga (isLoading es true), mantenemos el spinner visible
          if (this.registrations().length === 0) this.isLoading.set(true);
          return this.registrationsService.getAll();
        })
      ).subscribe({
        next: (registrations) => {
          this.updateRegistrationsIfChanged(registrations);
          this.lastRefreshed.set(new Date().toLocaleTimeString());
          this.isLoading.set(false);
        },
        error: (err) => {
          const message = this.formatBackendErrorPayload(err);
          this.showTemporaryError(message);
          this.isLoading.set(false);
        }
      })
    );
  }

  private resetMessageTimer(): void {
    if (this.messageTimeout) {
      window.clearTimeout(this.messageTimeout);
      this.messageTimeout = 0;
    }
  }

  private showTemporaryError(message: string, durationMs = 5000): void {
    this.resetMessageTimer();
    this.successMessage.set(null);
    this.errorMessage.set(message);
    this.messageTimeout = window.setTimeout(() => this.errorMessage.set(null), durationMs);
  }

  private showTemporarySuccess(message: string, durationMs = 5000): void {
    this.resetMessageTimer();
    this.errorMessage.set(null);
    this.successMessage.set(message);
    this.messageTimeout = window.setTimeout(() => this.successMessage.set(null), durationMs);
  }

  public setFilter(text: string): void {
    this.currentPage.set(1);
    this.filterText.set(text);
  }

  public setPageSize(size: number): void {
    this.currentPage.set(1);
    this.pageSize.set(size);
  }

  public goToPreviousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(value => value - 1);
    }
  }

  public goToNextPage(): void {
    if (this.currentPage() < this.pageCount()) {
      this.currentPage.update(value => value + 1);
    }
  }

  public openModal(): void {
    this.editingRegistration.set(null);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.registrationForm.reset({ studentId: '', subjectIds: [], status: 1 });
    this.modalElement.nativeElement.showModal();
  }

  public closeModal(): void {
    this.editingRegistration.set(null);
    this.modalElement.nativeElement.close();
  }

  public getSelectedSubjectCount(): number {
    const selected = this.registrationForm.get('subjectIds')?.value;
    return Array.isArray(selected) ? selected.length : 0;
  }

  public getSelectedSubjectDetails(): Array<{ name: string; teacherName: string }> {
    const selectedIds = this.registrationForm.get('subjectIds')?.value;
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return [];

    return this.subjects()
      .filter(subject => selectedIds.includes(subject.id))
      .map(subject => ({ name: subject.name, teacherName: subject.userName ?? 'N/A' }));
  }

  public hasTooManySubjectsSelected(): boolean {
    return this.getSelectedSubjectCount() > 3;
  }

  public onSubmit(): void {
    if (this.registrationForm.invalid || this.hasTooManySubjectsSelected()) return;

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    const formValue = this.registrationForm.value;
    const createPayload = {
      studentId: formValue.studentId,
      subjectId: formValue.subjectIds,
      status: formValue.status
    };

    this.subs.add(
      this.registrationsService.create(createPayload).subscribe({
        next: () => {
          this.loadRegistrations(true);
          this.showTemporarySuccess('Registro guardado correctamente.', 5000);
          this.isSubmitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          console.error('Error crítico al guardar registro:', err);
          this.isSubmitting.set(false);
          this.closeModal();
          const message = this.formatBackendErrorPayload(err);
          this.showTemporaryError(`No se pudo crear: ${message}`);
        }
      })
    );
  }

  public onDelete(registration: RegistrationDto): void {
    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar el registro de ${registration.studentName}?`);
    if (!confirmDelete) return;

    this.isSubmitting.set(true);
    this.subs.add(
      this.registrationsService.delete(registration.id).subscribe({
        next: () => {
          this.loadRegistrations(true);
          this.showTemporarySuccess('Registro eliminado correctamente.', 5000);
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error('Error al eliminar registro:', err);
          this.isSubmitting.set(false);
          const message = this.formatBackendErrorPayload(err);
          this.showTemporaryError(`No se pudo eliminar: ${message}`);
        }
      })
    );
  }

  // 4. Limpieza masiva automática y segura al salir de la página
  public ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.resetMessageTimer();
  }
}
