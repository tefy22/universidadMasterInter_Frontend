export interface SubjectDto {
  id: string;
  name: string;
  credits: number;
  idUser: string;
  userName: string;
  estado: number;
  seleccionada: boolean; // Nueva propiedad para indicar si la materia está seleccionada
}
