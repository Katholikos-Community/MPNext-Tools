import { GroupWizard } from "./group-wizard";
import { parseToolParams } from "@/lib/tool-params";
import { getMpTimezone } from "@/components/shared-actions/domain";

interface GroupWizardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GroupWizardPage({ searchParams }: GroupWizardPageProps) {
  const [params, mpTimezone] = await Promise.all([
    parseToolParams(await searchParams),
    getMpTimezone(),
  ]);

  return <GroupWizard params={params} mpTimezone={mpTimezone} />;
}
