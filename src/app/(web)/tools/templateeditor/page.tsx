import { TemplateEditor } from "./template-editor";
import { parseToolParams } from "@/lib/tool-params.server";

interface TemplateEditorPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TemplateEditorPage({ searchParams }: TemplateEditorPageProps) {
  const params = await parseToolParams(await searchParams);

  return <TemplateEditor params={params} />;
}
