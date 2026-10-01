import { UserResponseDto } from './user-response.dto.js';

export interface AdminCreateUserResponseDto {
  user: UserResponseDto;
  temporaryPassword: string | null;
}
