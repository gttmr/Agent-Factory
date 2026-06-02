import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useRecentRoots } from "../state/useRecentRoots";

/**
 * ADK 런타임 실행 화면 — 승인 게이트가 없는 도구 화면.
 * ADK 연결 + 라이브 웹챗은 후속 작업(PR5)에서 BuildWorkbench 에서 이전한다.
 * 현재는 자리만 잡아 둔 스텁이다.
 */
export default function RunSandbox() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id가 없습니다" description="Landing 페이지에서 artifact root를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">
          Landing으로
        </Link>
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionHeader
        eyebrow={`실행 · ${reqId}`}
        title="ADK 런타임 실행"
        description="생성된 ADK 번들을 실제로 굴려 보는 샌드박스입니다. 승인 게이트가 없는 도구 화면입니다."
      />
      <EmptyState
        title="준비 중"
        description="ADK 연결과 라이브 웹챗을 이 화면으로 옮기는 작업이 예정되어 있습니다. 현재는 개발(Build) 화면에서 ADK 웹챗을 사용할 수 있습니다."
      />
    </Panel>
  );
}
