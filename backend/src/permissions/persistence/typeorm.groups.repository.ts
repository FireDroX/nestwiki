import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group } from '../entities/group.entity.js';
import { GroupMember } from '../entities/group-member.entity.js';
import {
  CreateGroupInput,
  GroupsRepository,
  UpdateGroupInput,
} from './groups.repository.js';

@Injectable()
export class TypeormGroupsRepository implements GroupsRepository {
  constructor(
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly members: Repository<GroupMember>,
  ) {}

  findAll(): Promise<Group[]> {
    return this.groups.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Group | null> {
    return this.groups.findOneBy({ id });
  }

  findByName(name: string): Promise<Group | null> {
    return this.groups.findOneBy({ name });
  }

  create(input: CreateGroupInput): Promise<Group> {
    return this.groups.save(this.groups.create(input));
  }

  async update(id: string, input: UpdateGroupInput): Promise<Group> {
    await this.groups.update(id, input);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.groups.delete(id);
  }

  async findMemberIds(groupId: string): Promise<string[]> {
    const rows = await this.members.findBy({ groupId });
    return rows.map((row) => row.userId);
  }

  async findGroupIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.members.findBy({ userId });
    return rows.map((row) => row.groupId);
  }

  async setMembers(groupId: string, userIds: string[]): Promise<void> {
    await this.members.delete({ groupId });
    if (userIds.length === 0) {
      return;
    }
    await this.members.save(
      userIds.map((userId) => this.members.create({ groupId, userId })),
    );
  }

  findByIds(ids: string[]): Promise<Group[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.groups.findBy({ id: In(ids) });
  }
}
