"use server";

import { requireDevSession } from "./require-dev-session";
import { ToolService } from "@/services/toolService";

export async function getUserTools(): Promise<string[]> {
  await requireDevSession("Dev panel");

  // The acting MP User_ID is resolved by the authorization gate inside
  // getUserTools, which is also what refuses a caller with no MP security role.
  const toolService = await ToolService.getInstance();
  return toolService.getUserTools();
}
