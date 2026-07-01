import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  addWorkspaceDomain,
  listWorkspaceDomains,
} from "@/server/workspaces/domain-service"
import { addWorkspaceDomainInputSchema } from "@/server/workspaces/validation"

export const runtime = "nodejs"

type WorkspaceDomainsRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export async function GET(_request: Request, { params }: WorkspaceDomainsRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const result = await listWorkspaceDomains(currentSession.user.id, workspaceSlug)

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, { params }: WorkspaceDomainsRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const input = addWorkspaceDomainInputSchema.parse(await readJson(request))
    const result = await addWorkspaceDomain(
      currentSession.user.id,
      workspaceSlug,
      input
    )

    return ok(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
