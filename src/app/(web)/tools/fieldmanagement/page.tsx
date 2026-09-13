import { FieldManagement } from "./field-management";
import { parseToolParams } from "@/lib/tool-params.server";

interface FieldManagementPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FieldManagementPage({ searchParams }: FieldManagementPageProps) {
  const params = await parseToolParams(await searchParams);

  return <FieldManagement params={params} />;
}
