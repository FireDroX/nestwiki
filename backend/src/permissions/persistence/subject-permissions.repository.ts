export interface SubjectPermissionsRepository {
  findForUser(userId: string): Promise<string[]>;
  findForGroup(groupId: string): Promise<string[]>;
  findForGroups(groupIds: string[]): Promise<string[]>;
  setForUser(userId: string, permissions: string[]): Promise<void>;
  setForGroup(groupId: string, permissions: string[]): Promise<void>;
}
