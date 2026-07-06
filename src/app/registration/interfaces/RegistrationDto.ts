import { RegistrationDetailDto } from "./RegistrationDetailDto";

export interface RegistrationDto {
  id: string;
  studentId: string;
  studentName: string;
  status: number;
  details: RegistrationDetailDto[];
}
