import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Auth } from '../../../auth/services/auth';
import { RegistrationsService } from '../../../registration/services/RegistrationsService';
import { RegistrationDto } from '../../../registration/interfaces/RegistrationDto';
import { ApiResult } from '../../../response-control/interfaces/ApiResult';
import { SubjectDto } from '../../../subject/interfaces/SubjectDto';
import { SubjectsService } from '../../../subject/services/SubjectsService';
import { UserServices } from '../../../user/services/UserServices';

interface TeacherSubjectView extends SubjectDto {
  enrolledStudents: Array<{ id: string; name: string; email?: string }>;
}

@Component({
  selector: 'app-teachers',
  imports: [],
  templateUrl: './teachers.html',
})
export class Teachers implements OnInit {
  private authService = inject(Auth);
  private subjectsService = inject(SubjectsService);
  private registrationsService = inject(RegistrationsService);
  private usersService = inject(UserServices);

  public isLoading = signal(true);
  public error = signal<string | null>(null);
  public teacherName = signal('Profesor');
  public subjects = signal<SubjectDto[]>([]);
  public registrations = signal<RegistrationDto[]>([]);
  public refreshTime = signal('');

  public teacherSubjects = computed<TeacherSubjectView[]>(() => {
    const teacherId = this.authService.user()?.id;
    const registrationsBySubject = new Map<string, RegistrationDto[]>();

    this.registrations().forEach(registration => {
      registration.details?.forEach(detail => {
        const registrations = registrationsBySubject.get(detail.subjectId) ?? [];
        registrations.push(registration);
        registrationsBySubject.set(detail.subjectId, registrations);
      });
    });

    return this.subjects()
      .filter(subject => subject.estado === 1 && (!teacherId || subject.idUser === teacherId))
      .map(subject => {
        const students = new Map<string, { id: string; name: string; email?: string }>();
        registrationsBySubject.get(subject.id)?.forEach(registration => {
          if (registration.status !== 1 || students.has(registration.studentId)) return;
          students.set(registration.studentId, {
            id: registration.studentId,
            name: registration.studentName || 'Alumno sin nombre'
          });
        });

        return { ...subject, enrolledStudents: [...students.values()] };
      });
  });

  public totalStudents = computed(() => {
    const students = new Set<string>();
    this.teacherSubjects().forEach(subject => subject.enrolledStudents.forEach(student => students.add(student.id)));
    return students.size;
  });

  public totalEnrollments = computed(() =>
    this.teacherSubjects().reduce((total, subject) => total + subject.enrolledStudents.length, 0)
  );

  ngOnInit(): void {
    this.loadTeacher();
    this.loadData();
  }

  public loadData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    let subjectsLoaded = false;
    let registrationsLoaded = false;
    const finishLoading = () => {
      if (subjectsLoaded && registrationsLoaded) {
        this.isLoading.set(false);
        this.refreshTime.set(new Date().toLocaleTimeString());
      }
    };

    this.subjectsService.getAll().subscribe({
      next: (result: ApiResult<SubjectDto[]>) => {
        if (result.isSuccess && result.value) this.subjects.set(result.value);
        else this.error.set('No se pudieron cargar las materias asignadas.');
        subjectsLoaded = true;
        finishLoading();
      },
      error: () => {
        subjectsLoaded = true;
        this.error.set('No se pudieron cargar las materias asignadas.');
        finishLoading();
      }
    });

    this.registrationsService.getAll().subscribe({
      next: registrations => {
        this.registrations.set(registrations);
        registrationsLoaded = true;
        finishLoading();
      },
      error: () => {
        registrationsLoaded = true;
        this.error.set('No se pudieron cargar los alumnos matriculados.');
        finishLoading();
      }
    });
  }

  private loadTeacher(): void {
    const teacherId = this.authService.user()?.id;
    if (!teacherId) return;

    this.usersService.getAllTeachers().subscribe({
      next: teachers => {
        const teacher = teachers.find(item => item.id === teacherId);
        if (teacher) this.teacherName.set(`${teacher.name} ${teacher.lastName}`.trim());
      }
    });
  }
}
