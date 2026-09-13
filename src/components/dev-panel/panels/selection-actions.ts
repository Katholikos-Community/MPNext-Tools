'use server';

import { requireDevSession } from './require-dev-session';
import { ToolService } from '@/services/toolService';

export interface SelectionResult {
  recordIds: number[];
  count: number;
}

export async function resolveSelection(
  selectionId: number,
  pageId: number
): Promise<SelectionResult> {
  await requireDevSession('Dev panel');

  const toolService = await ToolService.getInstance();
  // The acting MP User_ID comes from the authorization gate inside
  // getSelectionRecordIds — a selection belongs to a specific user.
  const recordIds = await toolService.getSelectionRecordIds(selectionId, pageId);

  return { recordIds, count: recordIds.length };
}
