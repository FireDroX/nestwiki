import { ResponseDto } from '../../common/dto/response.dto.js';
import type { VersionStatusResponseDto } from '../dto/out/version-status-response.dto.js';

export class VersionMapper {
  static toResponse(
    status: VersionStatusResponseDto,
  ): ResponseDto<VersionStatusResponseDto> {
    return new ResponseDto(status);
  }
}
