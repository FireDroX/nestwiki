import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../../common/dto/response.dto.js';
import type { GlobalPermission } from '../../common/permissions.js';
import type { Group } from '../../permissions/entities/group.entity.js';
import { User } from '../entities/user.entity.js';
import { UserResponseDto } from '../dto/out/user-response.dto.js';

export interface UserResponseStats {
  commentsCount?: number;
  pagesCreatedCount?: number;
  pageEditsCount?: number;
}

export class UserMapper {
  static toUserResponseDto(
    entity: User,
    stats: UserResponseStats = {},
  ): UserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      role: entity.role,
      avatarUrl: entity.avatarUrl,
      createdAt: entity.createdAt,
      ...stats,
    };
  }

  static toResponse(
    entity: User,
    stats: UserResponseStats = {},
  ): ResponseDto<UserResponseDto> {
    return new ResponseDto(UserMapper.toUserResponseDto(entity, stats));
  }

  static toMeResponse(
    entity: User,
    stats: UserResponseStats,
    permissions: GlobalPermission[],
    groups: Group[],
  ): ResponseDto<UserResponseDto> {
    return new ResponseDto({
      ...UserMapper.toUserResponseDto(entity, stats),
      permissions,
      groups: groups.map((group) => ({ id: group.id, name: group.name })),
    });
  }

  static toPaginatedResponse(
    items: User[],
    total: number,
    page: number,
    limit: number,
  ): ResponseDto<PaginatedResponseDto<UserResponseDto>> {
    return new ResponseDto({
      items: items.map((item) => UserMapper.toUserResponseDto(item)),
      total,
      page,
      limit,
    });
  }
}
