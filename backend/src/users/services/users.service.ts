import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { AvatarNotFoundException } from '../../common/exceptions/users/avatar-not-found.exception.js';
import { EmailAlreadyExistsException } from '../../common/exceptions/auth/email-already-exists.exception.js';
import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import { GroupNotFoundException } from '../../common/exceptions/permissions/group-not-found.exception.js';
import { LastActiveAdminException } from '../../common/exceptions/users/last-active-admin.exception.js';
import { SelfActionNotAllowedException } from '../../common/exceptions/users/self-action-not-allowed.exception.js';
import { UserNotFoundException } from '../../common/exceptions/users/user-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { GlobalPermission } from '../../common/permissions.js';
import {
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_MAX_SIZE_MB,
  AVATAR_MIME_TO_EXTENSION,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_REGEX,
  MAX_LIMIT,
  MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
  MIN_PASSWORD_LENGTH,
  PASSWORD_COMPLEXITY_REGEX,
} from '../../common/variables.global.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import type { GroupsRepository } from '../../permissions/persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../../permissions/persistence/page-access-rules.repository.js';
import type { SubjectPermissionsRepository } from '../../permissions/persistence/subject-permissions.repository.js';
import { assertActorCanGrantGroupMembership } from '../../permissions/services/group-grant.util.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import { assertActorIsAdminToActOnAdmin } from './admin-target.util.js';
import { AdminUpdateUserDto } from '../dto/in/admin-update-user.dto.js';
import { CreateAdminUserDto } from '../dto/in/create-admin-user.dto.js';
import { CreateUserDto } from '../dto/in/create-user.dto.js';
import { ListUsersQueryDto } from '../dto/in/list-users-query.dto.js';
import { UpdateProfileDto } from '../dto/in/update-profile.dto.js';
import { UpdateRoleDto } from '../dto/in/update-role.dto.js';
import { User, USER_ROLES, UserRole } from '../entities/user.entity.js';
import type { UserRepository } from '../persistence/user.repository.js';

const SALT_ROUNDS = 10;
const TEMPORARY_PASSWORD_SUFFIX = 'A1!';

export interface UploadedAvatarFile {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface AdminUserListItem {
  user: User;
  groups: { id: string; name: string }[];
}

export interface AdminUserDetail {
  user: User;
  groups: { id: string; name: string }[];
  directPermissions: GlobalPermission[];
  lastLoginAt: Date | null;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject('UsersRepository') private readonly userRepository: UserRepository,
    private readonly adminAuditLogService: AdminAuditLogService,
    @Inject('StorageService') private readonly storageService: StorageService,
    @Inject('AvatarBucket') private readonly avatarBucket: string,
    private readonly userActivityLogService: UserActivityLogService,
    @Inject('GroupsRepository')
    private readonly groupsRepository: GroupsRepository,
    @Inject('SubjectPermissionsRepository')
    private readonly subjectPermissionsRepository: SubjectPermissionsRepository,
    @Inject('PageAccessRulesRepository')
    private readonly pageAccessRulesRepository: PageAccessRulesRepository,
    private readonly permissionsService: PermissionsService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new UserNotFoundException();
    }
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  create(data: CreateUserDto): Promise<User> {
    return this.userRepository.create(data);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    this.validateUpdateProfile(dto);
    await this.findById(id);
    return this.userRepository.update(id, dto);
  }

  async uploadAvatar(
    id: string,
    file: UploadedAvatarFile | undefined,
  ): Promise<User> {
    if (!file) {
      throw new ValidationException('No file provided');
    }
    this.validateAvatar(file);

    await this.findById(id);
    await this.deleteExistingAvatarFiles(id);

    const extension = AVATAR_MIME_TO_EXTENSION[file.mimetype];
    const key = UsersService.avatarKey(id, extension);
    await this.storageService.upload(
      this.avatarBucket,
      key,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.userRepository.updateAvatar(id, extension);
    void this.userActivityLogService.record({
      userId: id,
      action: 'user.avatar_uploaded',
      targetType: 'User',
      targetId: id,
    });
    return updated;
  }

  async removeAvatar(id: string): Promise<User> {
    await this.findById(id);
    await this.deleteExistingAvatarFiles(id);

    const updated = await this.userRepository.updateAvatar(id, null);
    void this.userActivityLogService.record({
      userId: id,
      action: 'user.avatar_removed',
      targetType: 'User',
      targetId: id,
    });
    return updated;
  }

  async getAvatarRedirectUrl(id: string): Promise<string> {
    const user = await this.findById(id);
    if (!user.avatarExtension) {
      throw new AvatarNotFoundException();
    }

    const key = UsersService.avatarKey(id, user.avatarExtension);
    return this.storageService.getPresignedUrl(
      this.avatarBucket,
      key,
      MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
    );
  }

  async findAllPaginated(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResponseDto<User>> {
    const page = UsersService.parsePage(query.page);
    const limit = UsersService.parseLimit(query.limit);
    const { items, total } = await this.userRepository.findAllPaginated(
      page,
      limit,
    );
    return { items, total, page, limit };
  }

  async updateRole(
    adminId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<User> {
    this.validateRole(dto.role);
    const previous = await this.findById(id);
    const updated = await this.userRepository.updateRole(id, dto.role);
    await this.adminAuditLogService.record({
      adminId,
      action: 'user.role.update',
      targetType: 'user',
      targetId: id,
      metadata: { previousRole: previous.role, newRole: updated.role },
    });
    return updated;
  }

  async deleteUser(admin: AuthenticatedUser, id: string): Promise<void> {
    UsersService.assertNotSelf(admin.id, id);
    const user = await this.findById(id);
    assertActorIsAdminToActOnAdmin(admin, user);
    await this.assertNotRemovingLastActiveAdmin(user);

    await this.userRepository.delete(id);
    await this.adminAuditLogService.record({
      adminId: admin.id,
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
      metadata: { email: user.email },
    });
  }

  async findAllFilteredPaginated(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResponseDto<AdminUserListItem>> {
    const page = UsersService.parsePage(query.page);
    const limit = UsersService.parseLimit(query.limit);

    if (query.role) {
      this.validateRole(query.role as User['role']);
    }

    let userIds: string[] | undefined;
    if (query.groupId) {
      userIds = await this.groupsRepository.findMemberIds(query.groupId);
    }
    const active =
      query.active === undefined ? undefined : query.active === 'true';

    const { items, total } = await this.userRepository.findAllFiltered(
      {
        search: query.search,
        role: query.role as User['role'] | undefined,
        active,
        userIds,
      },
      page,
      limit,
    );

    const groupIdsByUser = await Promise.all(
      items.map((user) => this.groupsRepository.findGroupIdsForUser(user.id)),
    );
    const allGroupIds = [...new Set(groupIdsByUser.flat())];
    const groups =
      allGroupIds.length > 0
        ? await this.groupsRepository.findByIds(allGroupIds)
        : [];
    const groupById = new Map(groups.map((group) => [group.id, group]));

    const enriched: AdminUserListItem[] = items.map((user, index) => ({
      user,
      groups: groupIdsByUser[index]
        .map((groupId) => groupById.get(groupId))
        .filter((group): group is NonNullable<typeof group> => !!group)
        .map((group) => ({ id: group.id, name: group.name })),
    }));

    return { items: enriched, total, page, limit };
  }

  async getAdminDetail(id: string): Promise<AdminUserDetail> {
    const user = await this.findById(id);
    const [groupIds, directPermissions, lastLoginPage] = await Promise.all([
      this.groupsRepository.findGroupIdsForUser(id),
      this.subjectPermissionsRepository.findForUser(id),
      this.userActivityLogService.list({
        userId: id,
        action: 'auth.login',
        page: '1',
        limit: '1',
      }),
    ]);
    const groups =
      groupIds.length > 0
        ? await this.groupsRepository.findByIds(groupIds)
        : [];

    return {
      user,
      groups: groups.map((group) => ({ id: group.id, name: group.name })),
      directPermissions: directPermissions as GlobalPermission[],
      lastLoginAt: lastLoginPage.items[0]?.createdAt ?? null,
    };
  }

  async createByAdmin(
    actor: AuthenticatedUser,
    dto: CreateAdminUserDto,
  ): Promise<{ user: User; temporaryPassword: string | null }> {
    this.validateEmail(dto.email);
    this.validateDisplayNameValue(dto.displayName);
    const role = dto.role ?? 'member';
    this.validateRole(role);
    UsersService.assertActorCanSetRole(actor, role);

    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    if (dto.groupIds && dto.groupIds.length > 0) {
      await this.assertGroupsExist(dto.groupIds);
      const actorEntity = await this.findById(actor.id);
      for (const groupId of dto.groupIds) {
        await assertActorCanGrantGroupMembership(
          this.permissionsService,
          this.subjectPermissionsRepository,
          this.pageAccessRulesRepository,
          actorEntity,
          groupId,
        );
      }
    }

    const temporaryPassword = dto.password
      ? null
      : UsersService.generateTemporaryPassword();
    const plainPassword = dto.password ?? temporaryPassword!;
    this.validatePasswordComplexity(plainPassword);
    const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role,
    });

    if (dto.groupIds && dto.groupIds.length > 0) {
      await this.groupsRepository.setGroupsForUser(user.id, dto.groupIds);
    }

    await this.adminAuditLogService.record({
      adminId: actor.id,
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return { user, temporaryPassword };
  }

  async adminUpdate(
    actor: AuthenticatedUser,
    id: string,
    dto: AdminUpdateUserDto,
  ): Promise<User> {
    const target = await this.findById(id);
    assertActorIsAdminToActOnAdmin(actor, target);

    if (dto.displayName !== undefined) {
      this.validateDisplayNameValue(dto.displayName);
    }
    if (dto.email !== undefined) {
      this.validateEmail(dto.email);
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new EmailAlreadyExistsException();
      }
    }
    if (dto.role !== undefined) {
      this.validateRole(dto.role);
      UsersService.assertActorCanSetRole(actor, dto.role);
      if (dto.role !== target.role) {
        if (dto.role !== 'admin') {
          UsersService.assertNotSelf(actor.id, id);
        }
        if (target.role === 'admin' && dto.role !== 'admin') {
          await this.assertNotRemovingLastActiveAdmin(target);
        }
      }
    }

    const updated = await this.userRepository.adminUpdate(id, {
      displayName: dto.displayName,
      email: dto.email,
      role: dto.role,
    });

    await this.adminAuditLogService.record({
      adminId: actor.id,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      metadata: { before: UsersService.auditSnapshot(target), after: dto },
    });

    return updated;
  }

  async setStatus(
    actor: AuthenticatedUser,
    id: string,
    isActive: boolean,
  ): Promise<User> {
    if (typeof isActive !== 'boolean') {
      throw new ValidationException('isActive must be a boolean');
    }
    const target = await this.findById(id);
    assertActorIsAdminToActOnAdmin(actor, target);
    if (!isActive) {
      UsersService.assertNotSelf(actor.id, id);
      await this.assertNotRemovingLastActiveAdmin(target);
    }

    const updated = await this.userRepository.updateStatus(id, isActive);
    await this.adminAuditLogService.record({
      adminId: actor.id,
      action: 'user.status.update',
      targetType: 'user',
      targetId: id,
      metadata: { isActive },
    });
    return updated;
  }

  async resetPassword(actor: AuthenticatedUser, id: string): Promise<string> {
    const target = await this.findById(id);
    assertActorIsAdminToActOnAdmin(actor, target);
    const temporaryPassword = UsersService.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
    await this.userRepository.updatePassword(id, passwordHash);

    await this.adminAuditLogService.record({
      adminId: actor.id,
      action: 'user.password.reset',
      targetType: 'user',
      targetId: id,
    });
    return temporaryPassword;
  }

  async unlock(actor: AuthenticatedUser, id: string): Promise<User> {
    const target = await this.findById(id);
    assertActorIsAdminToActOnAdmin(actor, target);
    const updated = await this.userRepository.resetFailedLoginAttempts(id);
    await this.adminAuditLogService.record({
      adminId: actor.id,
      action: 'user.unlock',
      targetType: 'user',
      targetId: id,
    });
    return updated;
  }

  async setGroups(
    actor: AuthenticatedUser,
    id: string,
    groupIds: string[],
  ): Promise<void> {
    if (!Array.isArray(groupIds)) {
      throw new ValidationException('groupIds must be an array of strings');
    }
    await this.findById(id);
    if (groupIds.length > 0) {
      await this.assertGroupsExist(groupIds);
    }

    const previousGroupIds =
      await this.groupsRepository.findGroupIdsForUser(id);
    const addedGroupIds = groupIds.filter(
      (groupId) => !previousGroupIds.includes(groupId),
    );
    if (addedGroupIds.length > 0) {
      const actorEntity = await this.findById(actor.id);
      for (const groupId of addedGroupIds) {
        await assertActorCanGrantGroupMembership(
          this.permissionsService,
          this.subjectPermissionsRepository,
          this.pageAccessRulesRepository,
          actorEntity,
          groupId,
        );
      }
    }

    await this.groupsRepository.setGroupsForUser(id, groupIds);
    await this.adminAuditLogService.record({
      adminId: actor.id,
      action: 'user.groups.update',
      targetType: 'user',
      targetId: id,
      metadata: { groupIds },
    });
  }

  private async assertGroupsExist(groupIds: string[]): Promise<void> {
    const found = await this.groupsRepository.findByIds(groupIds);
    if (found.length !== new Set(groupIds).size) {
      throw new GroupNotFoundException();
    }
  }

  private async assertNotRemovingLastActiveAdmin(target: User): Promise<void> {
    if (target.role !== 'admin' || !target.isActive) {
      return;
    }
    const activeAdmins = await this.userRepository.countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new LastActiveAdminException();
    }
  }

  private static assertNotSelf(actorId: string, targetId: string): void {
    if (actorId === targetId) {
      throw new SelfActionNotAllowedException();
    }
  }

  private static assertActorCanSetRole(
    actor: AuthenticatedUser,
    role: UserRole,
  ): void {
    if (role === 'admin' && actor.role !== 'admin') {
      throw new InsufficientPermissionException();
    }
  }

  private static auditSnapshot(
    user: User,
  ): Pick<User, 'displayName' | 'email' | 'role'> {
    return {
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    };
  }

  private validateEmail(email: string): void {
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ValidationException('email must be a valid email');
    }
  }

  private validateDisplayNameValue(displayName: string): void {
    if (
      !displayName ||
      displayName.length < DISPLAY_NAME_MIN_LENGTH ||
      displayName.length > DISPLAY_NAME_MAX_LENGTH
    ) {
      throw new ValidationException(
        `displayName must be between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters`,
      );
    }
  }

  private validatePasswordComplexity(password: string): void {
    if (
      password.length < MIN_PASSWORD_LENGTH ||
      !PASSWORD_COMPLEXITY_REGEX.test(password)
    ) {
      throw new ValidationException(
        `password must be at least ${MIN_PASSWORD_LENGTH} characters and include an uppercase letter, a digit, and a special character`,
      );
    }
  }

  private static generateTemporaryPassword(): string {
    const random = randomBytes(9).toString('base64url');
    return `${random}${TEMPORARY_PASSWORD_SUFFIX}`;
  }

  incrementFailedLoginAttempts(id: string): Promise<User> {
    return this.userRepository.incrementFailedLoginAttempts(id);
  }

  lockAccount(id: string, lockedUntil: Date): Promise<User> {
    return this.userRepository.lockAccount(id, lockedUntil);
  }

  resetFailedLoginAttempts(id: string): Promise<User> {
    return this.userRepository.resetFailedLoginAttempts(id);
  }

  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.userRepository.updatePassword(id, passwordHash);
  }

  private validateAvatar(file: UploadedAvatarFile): void {
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      throw new ValidationException(
        `Avatar exceeds maximum size of ${AVATAR_MAX_SIZE_MB}MB`,
      );
    }
    if (!AVATAR_MIME_TO_EXTENSION[file.mimetype]) {
      throw new ValidationException('Unsupported avatar file type');
    }
  }

  private async deleteExistingAvatarFiles(id: string): Promise<void> {
    await Promise.all(
      Object.values(AVATAR_MIME_TO_EXTENSION).map(async (extension) => {
        try {
          await this.storageService.delete(
            this.avatarBucket,
            UsersService.avatarKey(id, extension),
          );
        } catch {
          // Nothing to delete for this extension — not an error.
        }
      }),
    );
  }

  private static avatarKey(id: string, extension: string): string {
    return `avatars/${id}/avatar.${extension}`;
  }

  private validateRole(role: User['role']): void {
    if (!USER_ROLES.includes(role)) {
      throw new ValidationException(
        `role must be one of the following values: ${USER_ROLES.join(', ')}`,
      );
    }
  }

  private static parsePage(raw?: string): number {
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
  }

  private static parseLimit(raw?: string): number {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
  }

  private validateUpdateProfile(dto: UpdateProfileDto): void {
    const errors: string[] = [];

    if (dto.displayName !== undefined) {
      if (dto.displayName.length < DISPLAY_NAME_MIN_LENGTH) {
        errors.push(
          `displayName must be longer than or equal to ${DISPLAY_NAME_MIN_LENGTH} characters`,
        );
      } else if (dto.displayName.length > DISPLAY_NAME_MAX_LENGTH) {
        errors.push(
          `displayName must be shorter than or equal to ${DISPLAY_NAME_MAX_LENGTH} characters`,
        );
      }
    }

    if (errors.length > 0) {
      throw new ValidationException(errors.join(', '));
    }
  }
}
