import { AddEditFamily } from "./add-edit-family";
import { parseToolParams } from "@/lib/tool-params";
import { FamilyService } from "@/services/familyService";

interface AddEditFamilyPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AddEditFamilyPage({ searchParams }: AddEditFamilyPageProps) {
  const params = await parseToolParams(await searchParams);

  let initialContactId: number | null = null;
  if (
    params.recordID &&
    params.recordID > 0 &&
    params.pageData?.Table_Name &&
    params.pageData?.Primary_Key &&
    params.pageData?.Contact_ID_Field
  ) {
    try {
      const service = await FamilyService.getInstance();
      initialContactId = await service.resolveContactIdFromPage(
        params.pageData.Table_Name,
        params.pageData.Primary_Key,
        params.recordID,
        params.pageData.Contact_ID_Field,
      );
    } catch (error) {
      console.warn("Failed to resolve Contact_ID from page record:", error);
    }
  }

  return <AddEditFamily params={params} initialContactId={initialContactId} />;
}

export async function generateMetadata() {
  return {
    title: "Add/Edit Family",
  };
}
