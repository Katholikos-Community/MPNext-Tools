'use server';

import { GroupService } from '@/services/groupService';
import { AuthorizationService } from '@/services/authorizationService';
import type {
  GroupWizardLookups,
  ContactSearchResult,
  GroupSearchResult,
  CreateGroupResult,
  UpdateGroupResult,
  ActionError,
} from './types';
import type { GroupWizardFormData } from './schema';

/**
 * Authorization gate for this feature's server actions.
 *
 * A server action is a callable POST endpoint whether or not the page that
 * renders it was ever fetched, so the page-level gate in the tools layout is
 * not sufficient on its own. This replaces the previous bare session check:
 * MP's OIDC endpoint authenticates ANY dp_Users record, and this app reads MP
 * with its own service account, so "a session exists" proves nothing about
 * whether the caller may see or change this data.
 *
 * The service layer gates again — that is deliberate defence in depth, and the
 * per-request memoization in AuthorizationService keeps it to one MP read.
 */
async function requireAccess(
  table: string,
  operation: 'read' | 'create' | 'update' | 'delete',
): Promise<number> {
  return AuthorizationService.getInstance().requireSecurityRole({ table, operation });
}


export async function fetchGroupWizardLookups(): Promise<GroupWizardLookups> {
  await requireAccess('Groups', 'read');
  const service = await GroupService.getInstance();
  return service.fetchAllLookups();
}

export async function searchContacts(term: string): Promise<ContactSearchResult[]> {
  await requireAccess('Contacts', 'read');
  if (!term || term.length < 2) return [];
  const service = await GroupService.getInstance();
  return service.searchContacts(term);
}

export async function searchGroups(term: string): Promise<GroupSearchResult[]> {
  await requireAccess('Groups', 'read');
  if (!term || term.length < 2) return [];
  const service = await GroupService.getInstance();
  return service.searchGroups(term);
}

export async function fetchGroupRecord(
  groupId: number,
): Promise<
  | {
      success: true;
      data: GroupWizardFormData;
      displayNames: { contacts: Record<number, string>; groups: Record<number, string> };
    }
  | ActionError
> {
  try {
    await requireAccess('Groups', 'read');
    const service = await GroupService.getInstance();
    const group = await service.getGroup(groupId);
    if (!group) return { success: false, error: 'Group not found' };
    return { success: true, data: group.data, displayNames: group.displayNames };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load group' };
  }
}

export async function createGroup(
  data: GroupWizardFormData,
): Promise<CreateGroupResult | ActionError> {
  try {
    await requireAccess('Groups', 'create');
    const service = await GroupService.getInstance();
    const result = await service.createGroup(data);
    return { success: true, groupId: result.Group_ID, groupName: result.Group_Name };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create group' };
  }
}

export async function updateGroup(
  groupId: number,
  data: GroupWizardFormData,
): Promise<UpdateGroupResult | ActionError> {
  try {
    await requireAccess('Groups', 'update');
    const service = await GroupService.getInstance();
    const result = await service.updateGroup(groupId, data);
    return { success: true, groupId: result.Group_ID, groupName: result.Group_Name };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update group' };
  }
}
