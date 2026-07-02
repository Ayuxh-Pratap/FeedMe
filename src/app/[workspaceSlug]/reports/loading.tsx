import { DashboardTableLoading } from "@/components/feedme/dashboard/dashboard-route-loading"

export default function ReportsLoading() {
  return (
    <DashboardTableLoading
      title="Loading reports"
      subtitle="Fetching captured feedback and preparing the inspector."
    />
  )
}
