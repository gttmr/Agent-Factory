import { useNavigate, useParams } from "react-router-dom";
import { useArtifactRoots } from "../state/useArtifactRoot";

export function ArtifactRootSwitcher() {
  const navigate = useNavigate();
  const params = useParams<{ reqId?: string; stage?: string }>();
  const { data: roots = [] } = useArtifactRoots();
  const currentId = params.reqId ?? "";
  const stage = params.stage ?? "analyze";

  if (!currentId) return null;

  return (
    <label className="af-root-switcher">
      <span className="af-root-switcher-label">Artifact root</span>
      <select
        value={currentId}
        onChange={(event) => {
          const next = event.target.value;
          if (next) navigate(`/af/${next}/${stage}`);
        }}
      >
        {!roots.some((root) => root.requirement_id === currentId) ? (
          <option value={currentId}>{currentId}</option>
        ) : null}
        {roots.map((root) => (
          <option key={root.requirement_id} value={root.requirement_id}>
            {root.requirement_id} ({root.current_stage})
          </option>
        ))}
      </select>
    </label>
  );
}
