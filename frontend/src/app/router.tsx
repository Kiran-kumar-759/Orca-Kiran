import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { FishermanWorkspace } from "../features/fisherman/FishermanWorkspace";
import { MarineMonitoringWorkspace } from "../features/marine-monitoring/MarineMonitoringWorkspace";
import { ProtectedAreasWorkspace } from "../features/protected-areas/ProtectedAreasWorkspace";
import { CoastalAuthorityWorkspace } from "../features/coastal-authority/CoastalAuthorityWorkspace";
import { DisasterManagementWorkspace } from "../features/disaster-management/DisasterManagementWorkspace";
import { HazardDemoWorkspace } from "../features/hazard-demo/HazardDemoWorkspace";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/fisherman" replace />,
      },
      {
        path: "fisherman",
        element: <FishermanWorkspace />,
      },
      {
        path: "marine-monitoring",
        element: <MarineMonitoringWorkspace />,
      },
      {
        path: "protected-areas",
        element: <ProtectedAreasWorkspace />,
      },
      {
        path: "coastal-authority",
        element: <CoastalAuthorityWorkspace />,
      },
      {
        path: "disaster-management",
        element: <DisasterManagementWorkspace />,
      },
      {
        path: "hazard-demo",
        element: <HazardDemoWorkspace />,
      },
      {
        path: "*",
        element: <Navigate to="/fisherman" replace />,
      },
    ],
  },
]);
