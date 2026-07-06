import { Component, ElementRef, signal, ViewChild, computed, effect, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SubjectDto } from '../../../subject/interfaces/SubjectDto';
import { SubjectsService } from '../../../subject/services/SubjectsService';
import { ApiResult } from '../../../response-control/interfaces/ApiResult';
import { UserRole } from '../../../auth/interfaces/rol';
import { formatBackendErrorPayload } from '../../../response-control/error-formatter.utl';
import { UserDto } from '../../../user/interfaces/UserDto';
import { UserServices } from '../../../user/services/UserServices';
import { interval, Subscription, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-admin-subjects',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-subjects.html',
})
export class AdminSubjects implements OnInit, OnDestroy {
  // Inyección de dependencias moderna
  private subjectsService = inject(SubjectsService);
  private userServices = inject(UserServices);
  private fb = inject(FormBuilder);

  @ViewChild('subjectModal') modalElement!: ElementRef<HTMLDialogElement>;

  // Estado Reactivo con Signals
  public subjects = signal<SubjectDto[]>([]);
  public users = signal<UserDto[]>([]);
  public isLoading = signal<boolean>(true);
  public isSubmitting = signal<boolean>(false);
  public successMessage = signal<string | null>(null);
  public errorMessage = signal<string | null>(null);
  public editingSubject = signal<SubjectDto | null>(null);
  public filterText = signal<string>('');
  public currentPage = signal<number>(1);
  public pageSize = signal<number>(10);
  public readonly pageSizeOptions = [5, 10, 20];
  public lastRefreshed = signal<string>('');

  private latestSubjectsJson = '';
  private messageTimeout = 0;
  private readonly pollIntervalMs = 15000;

  // Contenedor centralizado para la desconexión de suscripciones
  private subs = new Subscription();

  public subjectForm!: FormGroup;

  // Selectores Computados Optimizados
  public filteredSubjects = computed(() => {
    const filter = this.filterText().trim().toLowerCase();
    if (!filter) return this.subjects();

    return this.subjects().filter(subject => {
      const name = subject.name?.toLowerCase() ?? '';
      const teacher = subject.userName?.toLowerCase() ?? '';
      return name.includes(filter) || teacher.includes(filter);
    });
  });

  public pageCount = computed(() => Math.max(1, Math.ceil(this.filteredSubjects().length / this.pageSize())));

  public pagedSubjects = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredSubjects().slice(start, start + this.pageSize());
  });

  private synchronizePage = effect(() => {
    if (this.currentPage() > this.pageCount()) {
      this.currentPage.set(this.pageCount());
    }
  });

  // Ciclo de vida correcto de inicialización
  ngOnInit(): void {
    this.initForm();
    this.loadTeachers();
    this.startPollingSubjects();
  }

  private initForm(): void {
    this.subjectForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      credits: [null, [Validators.required, Validators.min(1)]],
      idUser: ['', [Validators.required]],
      estado: [1]
    });

    // Se añade al contenedor global para evitar fugas de memoria
    this.subs.add(
      this.subjectForm.get('credits')?.valueChanges.subscribe((value) => {
        if (value === null || value === '' || value === undefined) return;

        const numericValue = Number(value);
        if (!Number.isNaN(numericValue)) {
          this.subjectForm.patchValue({ credits: numericValue }, { emitEvent: false });
        }
      })
    );
  }

  private loadSubjects(showLoading: boolean = false): void {
    if (showLoading) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    this.subs.add(
      this.subjectsService.getAll().subscribe({
        next: (result: ApiResult<SubjectDto[]>) => {
          if (result.isSuccess && result.value) {
            this.updateSubjectsIfChanged(result.value);
            this.lastRefreshed.set(new Date().toLocaleTimeString());
          } else if (showLoading) {
            this.showTemporaryError(result.error?.name ?? 'Ocurrió un error al procesar las materias');
          }
          if (showLoading) this.isLoading.set(false);
        },
        error: (err) => {
          if (showLoading) {
            const message = formatBackendErrorPayload(err);
            this.showTemporaryError(message);
            this.isLoading.set(false);
          }
        }
      })
    );
  }

  private updateSubjectsIfChanged(subjects: SubjectDto[]): void {
    const json = JSON.stringify(subjects);
    if (json !== this.latestSubjectsJson) {
      this.latestSubjectsJson = json;
      this.subjects.set(subjects);
    }
  }

  // Polling reactivo y controlado mediante RxJS
  private startPollingSubjects(): void {
    this.subs.add(
      interval(this.pollIntervalMs).pipe(
        startWith(0),
        switchMap(() => {
          if (this.subjects().length === 0) this.isLoading.set(true);
          return this.subjectsService.getAll();
        })
      ).subscribe({
        next: (result: ApiResult<SubjectDto[]>) => {
          if (result.isSuccess && result.value) {
            this.updateSubjectsIfChanged(result.value);
            this.lastRefreshed.set(new Date().toLocaleTimeString());
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          const message = formatBackendErrorPayload(err);
          this.showTemporaryError(message);
          this.isLoading.set(false);
        }
      })
    );
  }

  private loadTeachers(): void {
    this.subs.add(
      this.userServices.getAllTeachers().subscribe({
        next: (list) => {
          if (Array.isArray(list) && list.length > 0) {
            this.users.set(list);
            return;
          }
          this.loadTeachersFromUsersFallback();
        },
        error: () => this.loadTeachersFromUsersFallback()
      })
    );
  }

  private loadTeachersFromUsersFallback(): void {
    this.subs.add(
      this.userServices.getAll().subscribe({
        next: (list) => {
          this.users.set(list.filter(user => this.normalizeRoleId(user.roleId) === UserRole.Theacher));
        },
        error: (err) => console.error('Error al cargar profesores', err)
      })
    );
  }

  private normalizeRoleId(roleId: string | null | undefined): string {
    return (roleId ?? '').trim().toUpperCase();
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
    this.editingSubject.set(null);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.subjectForm.reset({ name: '', credits: null, idUser: '', estado: 1 });
    this.modalElement.nativeElement.showModal();
  }

  public closeModal(): void {
    this.editingSubject.set(null);
    this.modalElement.nativeElement.close();
  }

  public onSubmit(): void {
    if (this.subjectForm.invalid) return;

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    const formValue = this.subjectForm.value;
    const editing = this.editingSubject();

    if (editing) {
      const updatePayload = {
        name: formValue.name,
        credits: formValue.credits,
        idTeacher: formValue.idUser,
        idUser: formValue.idUser,
        estado: formValue.estado ?? editing.estado ?? 1
      };

      this.subs.add(
        this.subjectsService.update(editing.id, updatePayload).subscribe({
          next: (result: ApiResult<SubjectDto>) => {
            if (result.isSuccess) {
              this.loadSubjects(true);
              this.showTemporarySuccess('Materia actualizada correctamente.', 5000);
              this.closeModal();
            } else {
              const message = formatBackendErrorPayload(result.error ?? result);
              this.showTemporaryError(`No se pudo actualizar: ${message}`);
            }
            this.isSubmitting.set(false);
          },
          error: (err) => {
            console.error('Error crítico al actualizar materia:', err);
            this.isSubmitting.set(false);
            this.closeModal();
            const message = formatBackendErrorPayload(err);
            this.showTemporaryError(`No se pudo actualizar: ${message}`);
          }
        })
      );
    } else {
      const createPayload = {
        name: formValue.name,
        credits: formValue.credits,
        idUser: formValue.idUser
      };

      this.subs.add(
        this.subjectsService.create(createPayload).subscribe({
          next: (result: ApiResult<SubjectDto>) => {
            if (result.isSuccess) {
              this.loadSubjects(true);
              this.showTemporarySuccess('Materia guardada correctamente.');
              this.closeModal();
            } else {
              const message = formatBackendErrorPayload(result.error ?? result);
              this.showTemporaryError(`No se pudo crear: ${message}`);
            }
            this.isSubmitting.set(false);
          },
          error: (err) => {
            console.error('Error crítico al guardar materia:', err);
            this.isSubmitting.set(false);
            this.closeModal();
            const message = formatBackendErrorPayload(err);
            this.showTemporaryError(`${message}`);
          }
        })
      );
    }
  }

  public onEdit(subject: SubjectDto): void {
    this.editingSubject.set(subject);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.subjectForm.reset({
      name: subject.name ?? '',
      credits: subject.credits ?? null,
      idUser: subject.idUser ?? '',
      estado: subject.estado ?? 1
    });
    this.modalElement.nativeElement.showModal();
  }

  public onDelete(subject: SubjectDto): void {
    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar la materia "${subject.name}"?`);
    if (!confirmDelete) return;

    this.isSubmitting.set(true);
    this.subs.add(
      this.subjectsService.delete(subject.id).subscribe({
        next: () => {
          this.loadSubjects(true);
          this.showTemporarySuccess('Materia eliminada correctamente.');
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error('Error al eliminar materia:', err);
          this.isSubmitting.set(false);
          const message = formatBackendErrorPayload(err);
          this.showTemporaryError(`No se pudo eliminar: ${message}`);
        }
      })
    );
  }

  // Destrucción total y segura de flujos asíncronos y temporizadores
  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.resetMessageTimer();
  }
}
