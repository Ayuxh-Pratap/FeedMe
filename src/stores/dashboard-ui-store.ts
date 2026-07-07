"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type DashboardUiState = {
  commandMenuOpen: boolean
  extensionInstallDialogOpen: boolean
  lastMyWorkScopeByWorkspace: Record<string, "assigned" | "reported">
  reportDensityByWorkspace: Record<string, "comfortable" | "compact">
  rightRailOpenByWorkspace: Record<string, boolean>
  sidebarCollapsedByWorkspace: Record<string, boolean>
  setCommandMenuOpen: (open: boolean) => void
  setExtensionInstallDialogOpen: (open: boolean) => void
  setLastMyWorkScope: (
    workspaceSlug: string,
    scope: "assigned" | "reported"
  ) => void
  setReportDensity: (
    workspaceSlug: string,
    density: "comfortable" | "compact"
  ) => void
  setRightRailOpen: (workspaceSlug: string, open: boolean) => void
  setSidebarCollapsed: (workspaceSlug: string, collapsed: boolean) => void
}

export const useDashboardUiStore = create<DashboardUiState>()(
  persist(
    (set) => ({
      commandMenuOpen: false,
      extensionInstallDialogOpen: false,
      lastMyWorkScopeByWorkspace: {},
      reportDensityByWorkspace: {},
      rightRailOpenByWorkspace: {},
      sidebarCollapsedByWorkspace: {},
      setCommandMenuOpen: (open) => set({ commandMenuOpen: open }),
      setExtensionInstallDialogOpen: (open) =>
        set({ extensionInstallDialogOpen: open }),
      setLastMyWorkScope: (workspaceSlug, scope) =>
        set((state) => ({
          lastMyWorkScopeByWorkspace: {
            ...state.lastMyWorkScopeByWorkspace,
            [workspaceSlug]: scope,
          },
        })),
      setReportDensity: (workspaceSlug, density) =>
        set((state) => ({
          reportDensityByWorkspace: {
            ...state.reportDensityByWorkspace,
            [workspaceSlug]: density,
          },
        })),
      setRightRailOpen: (workspaceSlug, open) =>
        set((state) => ({
          rightRailOpenByWorkspace: {
            ...state.rightRailOpenByWorkspace,
            [workspaceSlug]: open,
          },
        })),
      setSidebarCollapsed: (workspaceSlug, collapsed) =>
        set((state) => ({
          sidebarCollapsedByWorkspace: {
            ...state.sidebarCollapsedByWorkspace,
            [workspaceSlug]: collapsed,
          },
        })),
    }),
    {
      name: "feedme-dashboard-ui",
      partialize: (state) => ({
        lastMyWorkScopeByWorkspace: state.lastMyWorkScopeByWorkspace,
        reportDensityByWorkspace: state.reportDensityByWorkspace,
        rightRailOpenByWorkspace: state.rightRailOpenByWorkspace,
        sidebarCollapsedByWorkspace: state.sidebarCollapsedByWorkspace,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)
