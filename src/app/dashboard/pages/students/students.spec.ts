import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Students } from './students';
import { SubjectsService } from '../../../subject/services/SubjectsService';
import { StudentsService } from '../../../students/services/StudentsService';
import { ApiResult } from '../../../response-control/interfaces/ApiResult';
import { SubjectDto } from '../../../subject/interfaces/SubjectDto';
import { SharedSubjectDto } from '../../../students/services/SharedSubjectDto';

describe('Students', () => {
  let fixture: ComponentFixture<Students>;
  let component: Students;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Students],
      providers: [
        {
          provide: SubjectsService,
          useValue: {
            getAll: () => of({ isSuccess: true, value: [] as SubjectDto[] } as ApiResult<SubjectDto[]>),
          },
        },
        {
          provide: StudentsService,
          useValue: {
            getBySharedSubject: () =>
              of({
                isSuccess: true,
                value: [
                  { SubjectId: 'mat-1', SubjectName: 'Matemáticas', NameStudent: 'Juan Pérez' },
                  { SubjectId: 'mat-1', SubjectName: 'Matemáticas', NameStudent: 'Ana Torres' },
                ] as SharedSubjectDto[],
              } as ApiResult<SharedSubjectDto[]>),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Students);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('agrupa a los compañeros desde el servicio para la materia seleccionada', () => {
    component.subjects.set([
      { id: 'mat-1', name: 'Matemáticas', credits: 4, idTeacher: 't1', teacherName: 'Prof.', estado: 1, seleccionada: false },
    ]);

    component.toggleMateria('mat-1');

    const groups = component.classmatesBySubject();

    expect(groups).toEqual([
      {
        subjectName: 'Matemáticas',
        classmates: ['Juan Pérez', 'Ana Torres'],
      },
    ]);
  });
});
