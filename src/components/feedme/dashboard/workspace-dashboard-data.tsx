"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { WorkspaceReport } from "@/lib/reports"
import type { WorkspaceTeamMember } from "@/lib/team-members"

type RegisterReportsInput = {
  reports: WorkspaceReport[]
  selectedReportId?: string | null
  visibleReportIds: string[]
}

type RegisterMembersInput = {
  members: WorkspaceTeamMember[]
  selectedMemberId?: string | null
  visibleMemberIds: string[]
}

type WorkspaceDashboardData = {
  dashboardSearchQuery: string
  membersReady: boolean
  registerMembers: (input: RegisterMembersInput) => void
  registerReports: (input: RegisterReportsInput) => void
  reportRailReady: boolean
  reportRailReports: WorkspaceReport[]
  reportRailSelectedReportId: string | null
  reportRailVisibleIds: string[]
  selectedMemberId: string | null
  setDashboardSearchQuery: (query: string) => void
  setReportRailSelectedReportId: (reportId: string | null) => void
  setSelectedMemberId: (memberId: string | null) => void
  teamMembers: WorkspaceTeamMember[]
  teamVisibleMemberIds: string[]
  updateReport: (report: WorkspaceReport) => void
}

const WorkspaceDashboardDataContext =
  createContext<WorkspaceDashboardData | null>(null)

function areArraysEqual(first: string[], second: string[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  )
}

export function WorkspaceDashboardDataProvider({
  children,
  initialDashboardSearchQuery = "",
}: {
  children: ReactNode
  initialDashboardSearchQuery?: string
}) {
  const [dashboardSearchQuery, setDashboardSearchQueryState] = useState(
    initialDashboardSearchQuery.trim()
  )
  const [reportRailReady, setReportRailReady] = useState(false)
  const [reportRailReports, setReportRailReports] = useState<WorkspaceReport[]>([])
  const [reportRailVisibleIds, setReportRailVisibleIds] = useState<string[]>([])
  const [reportRailSelectedReportId, setReportRailSelectedReportIdState] =
    useState<string | null>(null)
  const [membersReady, setMembersReady] = useState(false)
  const [teamMembers, setTeamMembers] = useState<WorkspaceTeamMember[]>([])
  const [teamVisibleMemberIds, setTeamVisibleMemberIds] = useState<string[]>([])
  const [selectedMemberId, setSelectedMemberIdState] = useState<string | null>(null)

  const registerReports = useCallback((input: RegisterReportsInput) => {
    setReportRailReady(true)
    setReportRailReports((currentReports) =>
      currentReports === input.reports ? currentReports : input.reports
    )
    setReportRailVisibleIds((currentIds) =>
      areArraysEqual(currentIds, input.visibleReportIds)
        ? currentIds
        : input.visibleReportIds
    )
    setReportRailSelectedReportIdState((currentId) => {
      const nextId = input.selectedReportId ?? null
      return currentId === nextId ? currentId : nextId
    })
  }, [])

  const registerMembers = useCallback((input: RegisterMembersInput) => {
    setMembersReady(true)
    setTeamMembers((currentMembers) =>
      currentMembers === input.members ? currentMembers : input.members
    )
    setTeamVisibleMemberIds((currentIds) =>
      areArraysEqual(currentIds, input.visibleMemberIds)
        ? currentIds
        : input.visibleMemberIds
    )
    setSelectedMemberIdState((currentId) => {
      const nextId = input.selectedMemberId ?? null
      return currentId === nextId ? currentId : nextId
    })
  }, [])

  const setReportRailSelectedReportId = useCallback((reportId: string | null) => {
    setReportRailSelectedReportIdState((currentId) =>
      currentId === reportId ? currentId : reportId
    )
  }, [])

  const setSelectedMemberId = useCallback((memberId: string | null) => {
    setSelectedMemberIdState((currentId) =>
      currentId === memberId ? currentId : memberId
    )
  }, [])

  const setDashboardSearchQuery = useCallback((query: string) => {
    const nextQuery = query.trim()

    setDashboardSearchQueryState((currentQuery) =>
      currentQuery === nextQuery ? currentQuery : nextQuery
    )
  }, [])

  const updateReport = useCallback((nextReport: WorkspaceReport) => {
    setReportRailReports((currentReports) =>
      currentReports.map((report) =>
        report.id === nextReport.id ? nextReport : report
      )
    )
  }, [])

  const value = useMemo(
    () => ({
      dashboardSearchQuery,
      membersReady,
      registerMembers,
      registerReports,
      reportRailReady,
      reportRailReports,
      reportRailSelectedReportId,
      reportRailVisibleIds,
      selectedMemberId,
      setDashboardSearchQuery,
      setReportRailSelectedReportId,
      setSelectedMemberId,
      teamMembers,
      teamVisibleMemberIds,
      updateReport,
    }),
    [
      dashboardSearchQuery,
      membersReady,
      registerMembers,
      registerReports,
      reportRailReady,
      reportRailReports,
      reportRailSelectedReportId,
      reportRailVisibleIds,
      selectedMemberId,
      setDashboardSearchQuery,
      setReportRailSelectedReportId,
      setSelectedMemberId,
      teamMembers,
      teamVisibleMemberIds,
      updateReport,
    ]
  )

  return (
    <WorkspaceDashboardDataContext.Provider value={value}>
      {children}
    </WorkspaceDashboardDataContext.Provider>
  )
}

export function useWorkspaceDashboardData() {
  const context = useContext(WorkspaceDashboardDataContext)

  if (!context) {
    throw new Error(
      "useWorkspaceDashboardData must be used inside WorkspaceDashboardDataProvider."
    )
  }

  return context
}
