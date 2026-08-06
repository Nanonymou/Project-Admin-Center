import { ProjectMarginClient } from "@/components/margin/project-margin-client";

export default async function ProjectMarginPage({
  params,
}: {
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  return <ProjectMarginClient projectCode={projectCode} />;
}
