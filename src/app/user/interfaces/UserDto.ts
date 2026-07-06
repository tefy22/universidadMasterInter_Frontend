export interface UserDto {
  id: string;
  dni: number;
  name: string;
  lastName: string;
  email: string;
  password?: string;
  phoneNumber: string;
  roleId: string;
  status: number;
}
