import { Group } from '../entities/group.entity.js';

export interface CreateGroupInput {
  name: string;
  description: string | null;
}

export interface GroupsRepository {
  findAll(): Promise<Group[]>;
  findById(id: string): Promise<Group | null>;
  findByName(name: string): Promise<Group | null>;
  create(input: CreateGroupInput): Promise<Group>;
  delete(id: string): Promise<void>;
  findMemberIds(groupId: string): Promise<string[]>;
  findGroupIdsForUser(userId: string): Promise<string[]>;
  setMembers(groupId: string, userIds: string[]): Promise<void>;
  findByIds(ids: string[]): Promise<Group[]>;
}
