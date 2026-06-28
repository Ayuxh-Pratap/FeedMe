import { redirect } from "next/navigation"

type WorkspaceIndexPageProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function WorkspaceIndexPage({
  params,
}: WorkspaceIndexPageProps) {
  const { workspaceSlug } = await params

  redirect(`/${workspaceSlug}/reports`)
}
