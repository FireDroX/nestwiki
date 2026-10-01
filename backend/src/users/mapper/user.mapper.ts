import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../../common/dto/response.dto.js';
import type { GlobalPermission } from '../../common/permissions.js';
import type { Group } from '../../permissions/entities/group.entity.js';
import { User } from '../entities/user.entity.js';
import type {
  AdminUserDetail,
  AdminUserListItem,
} from '../services/users.service.js';
import { AdminCreateUserResponseDto } from '../dto/out/admin-create-user-response.dto.js';
import { AdminUserDetailResponseDto } from '../dto/out/admin-user-detail-response.dto.js';
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

  static toAdminListItemDto(item: AdminUserListItem): UserResponseDto {
    return {
      ...UserMapper.toUserResponseDto(item.user),
      groups: item.groups,
      isActive: item.user.isActive,
      lockedUntil: item.user.lockedUntil,
    };
  }

  static toAdminPaginatedResponse(
    page: PaginatedResponseDto<AdminUserListItem>,
  ): ResponseDto<PaginatedResponseDto<UserResponseDto>> {
    return new ResponseDto({
      items: page.items.map((item) => UserMapper.toAdminListItemDto(item)),
      total: page.total,
      page: page.page,
      limit: page.limit,
    });
  }

  static toAdminDetailResponse(
    detail: AdminUserDetail,
  ): ResponseDto<AdminUserDetailResponseDto> {
    return new ResponseDto({
      ...UserMapper.toUserResponseDto(detail.user),
      groups: detail.groups,
      directPermissions: detail.directPermissions,
      lastLoginAt: detail.lastLoginAt,
      lockedUntil: detail.user.lockedUntil,
      failedLoginAttempts: detail.user.failedLoginAttempts,
      isActive: detail.user.isActive,
    });
  }

  static toAdminCreateResponse(result: {
    user: User;
    temporaryPassword: string | null;
  }): ResponseDto<AdminCreateUserResponseDto> {
    return new ResponseDto({
      user: UserMapper.toUserResponseDto(result.user),
      temporaryPassword: result.temporaryPassword,
    });
  }
}
