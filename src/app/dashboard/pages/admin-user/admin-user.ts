import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiResult } from '../../../response-control/interfaces/ApiResult';
import { UserRole } from '../../../auth/interfaces/rol';
import { formatBackendErrorPayload } from '../../../response-control/error-formatter.utl';
import { UserDto } from '../../../user/interfaces/UserDto';
import { UserServices } from '../../../user/services/UserServices';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-user',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-user.html',
})
export class AdminUser implements OnInit, OnDestroy {
  // Inyección moderna de dependencias unificada
  private userService = inject(UserServices);
  private fb = inject(FormBuilder);

  @ViewChild('userModal') modalElement!: ElementRef<HTMLDialogElement>;

  // Estado Reactivo con Signals
  public users = signal<UserDto[]>([]);
  public isLoading = signal<boolean>(true);
  public isSubmitting = signal<boolean>(false);
  public successMessage = signal<string | null>(null);
  public errorMessage = signal<string | null>(null);
  public editingUser = signal<UserDto | null>(null);
  public filterText = signal<string>('');
  public currentPage = signal<number>(1);
  public pageSize = signal<number>(10);
  public readonly pageSizeOptions = [5, 10, 20];
  public lastRefreshed = signal<string>('');

  // Diccionarios y opciones de renderizado
  private readonly roleLabelById: Readonly<Record<UserRole, string>> = {
    [UserRole.Admin]: 'Administrador',
    [UserRole.Student]: 'Estudiante',
    [UserRole.Theacher]: 'Profesor'
  };

  public readonly roleOptions = Object.values(UserRole).map((roleId) => ({
    value: roleId,
    label: this.roleLabelById[roleId]
  }));

  public readonly statusOptions = [
    { value: 1, label: 'Activo' },
    { value: 0, label: 'Inactivo' }
  ];

  private messageTimeout = 0;
  public userForm!: FormGroup;

  // Manejador centralizado de suscripciones RxJS
  private subs = new Subscription();

  // Selectores Computados Reactivos
  public filteredUsers = computed(() => {
    const filter = this.filterText().trim().toLowerCase();
    if (!filter) return this.users();

    return this.users().filter(user => {
      const dni = user.dni?.toString() ?? '';
      const name = user.name?.toLowerCase() ?? '';
      const lastName = user.lastName?.toLowerCase() ?? '';
      const email = user.email?.toLowerCase() ?? '';
      const phone = user.phoneNumber?.toLowerCase() ?? '';
      const role = this.getRoleLabel(user.roleId).toLowerCase();
      const status = this.getStatusLabel(user.status).toLowerCase();

      return (
        dni.includes(filter) ||
        name.includes(filter) ||
        lastName.includes(filter) ||
        email.includes(filter) ||
        phone.includes(filter) ||
        role.includes(filter) ||
        status.includes(filter)
      );
    });
  });

  public pageCount = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize())));

  public pagedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  private synchronizePage = effect(() => {
    if (this.currentPage() > this.pageCount()) {
      this.currentPage.set(this.pageCount());
    }
  });

  constructor() {}

  // Ciclo de vida correcto para la inicialización segura del componente
  ngOnInit(): void {
    this.initForm();
    this.loadUsers(true);
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      dni: [null, [Validators.required, Validators.min(1)]],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      lastName: ['', [Validators.required, Validators.maxLength(200)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phoneNumber: ['', [Validators.required, Validators.maxLength(30)]],
      roleId: [UserRole.Student, [Validators.required]],
      status: [1, [Validators.required]]
    });

    this.configurePasswordValidation(false);

    // Protección contra fuga de memoria acoplando las escuchas al contenedor global
    this.subs.add(
      this.userForm.get('dni')?.valueChanges.subscribe((value) => {
        if (value === null || value === '' || value === undefined) return;
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue)) {
          this.userForm.patchValue({ dni: numericValue }, { emitEvent: false });
        }
      })
    );

    this.subs.add(
      this.userForm.get('status')?.valueChanges.subscribe((value) => {
        if (value === null || value === '' || value === undefined) return;
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue)) {
          this.userForm.patchValue({ status: numericValue }, { emitEvent: false });
        }
      })
    );
  }

  private configurePasswordValidation(isEditing: boolean): void {
    const passwordControl = this.userForm.get('password');
    if (!passwordControl) return;

    if (isEditing) {
      // Si editas, puedes dejar que sea opcional para no sobreescribirla siempre en el payload
      passwordControl.setValidators([Validators.minLength(6)]);
    } else {
      passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
  }

  private buildUserPayload() {
    const formValue = this.userForm.value;
    const password = (formValue.password ?? '').trim();

    return {
      dni: Number(formValue.dni),
      name: (formValue.name ?? '').trim(),
      lastName: (formValue.lastName ?? '').trim(),
      email: (formValue.email ?? '').trim(),
      phoneNumber: (formValue.phoneNumber ?? '').trim(),
      roleId: this.resolveRoleId(formValue.roleId),
      status: Number(formValue.status),
      ...(password ? { password } : {})
    };
  }

  public refreshUsers(): void {
    this.loadUsers(true);
  }

  private loadUsers(showLoading: boolean): void {
    if (showLoading) {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);

    this.subs.add(
      this.userService.getAll().subscribe({
        next: (users) => {
          this.users.set(users);
          this.lastRefreshed.set(new Date().toLocaleTimeString());
          this.isLoading.set(false);
        },
        error: (err) => {
          this.showTemporaryError(formatBackendErrorPayload(err));
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
    this.successMessage.set(null); // Asegura limpiar errores antiguos antes de setear éxito
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
    this.editingUser.set(null);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.configurePasswordValidation(false);
    this.userForm.reset({
      dni: null,
      name: '',
      lastName: '',
      email: '',
      password: '',
      phoneNumber: '',
      roleId: UserRole.Student,
      status: 1
    });
    this.modalElement.nativeElement.showModal();
  }

  public closeModal(): void {
    this.editingUser.set(null);
    this.modalElement.nativeElement.close();
  }

  public onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    const editing = this.editingUser();
    const payload = this.buildUserPayload();

    if (editing) {
      this.subs.add(
        this.userService.update(editing.id, payload).subscribe({
          next: (result: ApiResult<UserDto | string>) => {
            if (!result.isSuccess) {
              const message = formatBackendErrorPayload(result.error ?? result);
              this.closeModal();
              this.showTemporaryError(`No se pudo actualizar: ${message}`);
              this.isSubmitting.set(false);
              return;
            }

            this.users.update(items => items.map(user =>
              user.id === editing.id ? { ...user, id: editing.id, ...payload } : user
            ));
            this.lastRefreshed.set(new Date().toLocaleTimeString());
            this.showTemporarySuccess('Usuario actualizado correctamente.', 5000);
            this.isSubmitting.set(false);
            this.closeModal();
          },
          error: (err) => {
            this.isSubmitting.set(false);
            const message = formatBackendErrorPayload(err);
            this.closeModal();
            this.showTemporaryError(`No se pudo actualizar: ${message}`);
          }
        })
      );
      return;
    }

    const createPayload = {
      ...payload,
      password: (this.userForm.get('password')?.value ?? '').trim()
    };

    this.subs.add(
      this.userService.create(createPayload).subscribe({
        next: (result: ApiResult<string>) => {
          if (!result.isSuccess) {
            const message = formatBackendErrorPayload(result.error ?? result);
            this.showTemporaryError(`No se pudo crear: ${message}`);
            this.isSubmitting.set(false);
            return;
          }

          this.loadUsers(false);
          this.showTemporarySuccess('Usuario guardado correctamente.', 5000);
          this.isSubmitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const message = formatBackendErrorPayload(err);
          this.showTemporaryError(`No se pudo crear: ${message}`);
        }
      })
    );
  }

  public onEdit(user: UserDto): void {
    this.editingUser.set(user);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.configurePasswordValidation(true);
    this.userForm.reset({
      dni: user.dni ?? null,
      name: user.name ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      password: '',
      phoneNumber: user.phoneNumber ?? '',
      roleId: this.resolveRoleId(user.roleId),
      status: user.status ?? 1
    });
    this.modalElement.nativeElement.showModal();
  }

  public onDelete(user: UserDto): void {
    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar al usuario "${user.name} ${user.lastName}"?`);
    if (!confirmDelete) return;

    this.isSubmitting.set(true);
    this.subs.add(
      this.userService.delete(user.id).subscribe({
        next: () => {
          this.users.update(items => items.filter(item => item.id !== user.id));
          this.lastRefreshed.set(new Date().toLocaleTimeString());
          this.showTemporarySuccess('Usuario eliminado correctamente.', 5000);
          this.isSubmitting.set(false);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const message = formatBackendErrorPayload(err);
          this.showTemporaryError(`No se pudo eliminar: ${message}`);
        }
      })
    );
  }

  public getRoleLabel(roleId: string): string {
    const normalizedRoleId = this.resolveRoleId(roleId);
    return this.roleLabelById[normalizedRoleId] ?? 'Sin rol';
  }

  private resolveRoleId(rawRoleId: string | null | undefined): UserRole {
    const normalized = (rawRoleId ?? '').trim().toUpperCase();
    const validRole = Object.values(UserRole).find(role => role === normalized);
    return (validRole as UserRole | undefined) ?? UserRole.Student;
  }

  public getStatusLabel(status: number): string {
    const found = this.statusOptions.find(option => option.value === status);
    return found?.label ?? 'Desconocido';
  }

  // Destrucción segura y limpieza total de la memoria
  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.resetMessageTimer();
  }
}
