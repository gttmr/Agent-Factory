import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WorkbenchLayout } from "../layout/WorkbenchLayout";
import { Panel } from "../ui/primitives";

const LandingPage = lazy(() => import("./LandingPage"));
const AnalyzeWorkbench = lazy(() => import("./AnalyzeWorkbench"));
const DesignWorkbench = lazy(() => import("./DesignWorkbench"));
const StagePlaceholder = lazy(() => import("./StagePlaceholder"));
const LegacyWizard = lazy(() => import("./LegacyWizard"));

function PageFallback() {
  return (
    <Panel>
      <p className="af-landing-message">화면을 불러오는 중…</p>
    </Panel>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/legacy" element={<LegacyWizard />} />
        <Route
          path="/"
          element={
            <WorkbenchLayout>
              <LandingPage />
            </WorkbenchLayout>
          }
        />
        <Route
          path="/catalog"
          element={
            <WorkbenchLayout>
              <StagePlaceholder stage="catalog" pr="PR5" />
            </WorkbenchLayout>
          }
        />
        <Route
          path="/af/:reqId/analyze"
          element={
            <WorkbenchLayout>
              <AnalyzeWorkbench />
            </WorkbenchLayout>
          }
        />
        <Route
          path="/af/:reqId/design"
          element={
            <WorkbenchLayout>
              <DesignWorkbench />
            </WorkbenchLayout>
          }
        />
        <Route
          path="/af/:reqId/build"
          element={
            <WorkbenchLayout>
              <StagePlaceholder stage="build" pr="PR4" />
            </WorkbenchLayout>
          }
        />
        <Route
          path="/af/:reqId/verify"
          element={
            <WorkbenchLayout>
              <StagePlaceholder stage="verify" pr="PR4" />
            </WorkbenchLayout>
          }
        />
        <Route path="/af/:reqId" element={<Navigate to="analyze" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
