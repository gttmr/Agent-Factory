import { Link, useParams } from "react-router-dom";
import { Panel, SectionHeader, EmptyState } from "../ui/primitives";

interface StagePlaceholderProps {
  stage: "design" | "build" | "verify" | "catalog";
  pr: string;
}

const stageMeta: Record<StagePlaceholderProps["stage"], { eyebrow: string; title: string; description: string }> = {
  design: {
    eyebrow: "af-design-boundaries",
    title: "Design 워크벤치 (예정)",
    description: "Graph IR 협업 + 모듈/Runtime/Remote A2A 계약 검토는 PR3 에서 구현됩니다."
  },
  build: {
    eyebrow: "af-build-runtime-stub",
    title: "Build 워크벤치 (예정)",
    description: "Scaffold-plan 검토와 runtime stub 생성은 PR4 에서 구현됩니다."
  },
  verify: {
    eyebrow: "af-verify-feedback",
    title: "Verify 워크벤치 (예정)",
    description: "validation 명령 실행과 catalog delta 제안은 PR4 에서 구현됩니다."
  },
  catalog: {
    eyebrow: "Reuse Hub",
    title: "Reuse Hub (예정)",
    description: "Catalog 탐색·재사용 핀·신규 등록 제안은 PR5 에서 구현됩니다."
  }
};

export default function StagePlaceholder({ stage, pr }: StagePlaceholderProps) {
  const params = useParams<{ reqId?: string }>();
  const reqId = params.reqId;
  const meta = stageMeta[stage];
  return (
    <Panel>
      <SectionHeader eyebrow={meta.eyebrow} title={meta.title} description={meta.description} />
      <EmptyState
        title={`${pr} 에서 구현 예정`}
        description={`현재 단계의 실제 UI는 다음 PR 에서 채워집니다. 임시로 Legacy wizard 에서 동일 작업을 진행하세요.`}
      />
      <div className="af-action-row">
        {reqId ? (
          <Link className="ui-button ui-button-secondary" to={`/af/${reqId}/analyze`}>
            Analyze 로 돌아가기
          </Link>
        ) : null}
        <Link className="ui-button ui-button-ghost" to="/legacy">
          Legacy 워크벤치
        </Link>
      </div>
    </Panel>
  );
}
