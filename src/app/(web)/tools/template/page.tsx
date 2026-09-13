import { TemplateTool } from "./template-tool";
import { parseToolParams } from "@/lib/tool-params.server";

interface TemplatePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TemplateToolPage({ searchParams }: TemplatePageProps) {
  const params = await parseToolParams(await searchParams);
  
  return <TemplateTool params={params} />;
}
