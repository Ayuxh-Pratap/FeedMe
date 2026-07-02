import { DashboardTableLoading } from "@/components/feedme/dashboard/dashboard-route-loading"

export default function TeamLoading() {
  return (
    <DashboardTableLoading
      title="Loading team"
      subtitle="Fetching workspace members and role context."
    />
  )
}
