/**
 * Tool query-string types and pure helpers.
 *
 * This module is CLIENT-SAFE and must stay that way: client components import
 * `ToolParams` and the `isNewRecord`/`isEditMode` helpers from here. It must
 * therefore never import a service — `ToolService` pulls in
 * `AuthorizationService`, `next/headers` and `MPHelper`, and Turbopack fails
 * the build with "You're importing a module that depends on next/headers".
 *
 * A dynamic `import()` is NOT sufficient: it still creates a graph edge, so the
 * server-only chain is still traced into the client bundle. The parser lives in
 * `./tool-params.server` instead.
 */
export interface PageData {
  Page_ID: number;
  Display_Name: string;
  Singular_Name: string;
  Table_Name: string;
  Primary_Key: string;
  Selected_Record_Expression?: string;
  Start_Date_Field?: string;
  End_Date_Field?: string;
  Contact_ID_Field?: string;
  Filter_Clause?: string;
  Global_Filter_ID_Field?: string;
}

export interface ToolParams {
  pageID?: number;
  s?: number;
  sc?: number;
  p?: number;
  q?: string;
  v?: number;
  recordID?: number;
  recordDescription?: string;
  addl?: string;
  pageData?: PageData;
}

export function isNewRecord(params: ToolParams): boolean {
  return params.recordID === -1 || params.recordID === undefined;
}

export function isEditMode(params: ToolParams): boolean {
  return !isNewRecord(params);
}
