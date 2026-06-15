import type { GraphValidation, GraphValidationIssue } from "../../analyzer/types";

interface ValidationBannerProps {
  validation: GraphValidation | undefined;
  onFocus: (target: GraphValidationIssue) => void;
}

export function ValidationBanner({ validation, onFocus }: ValidationBannerProps) {
  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];
  const hasErrors = errors.length > 0;

  if (!hasErrors && warnings.length === 0) {
    return (
      <div className="graph-validation-banner ok">
        <strong>그래프 유효성 검증 통과</strong>
      </div>
    );
  }

  return (
    <div className={`graph-validation-banner ${hasErrors ? "has-errors" : "has-warnings"}`}>
      {hasErrors ? (
        <div className="graph-validation-banner-block error">
          <strong>유효성 오류 {errors.length}건</strong>
          <ul>
            {errors.map((issue, i) => (
              <li key={`e-${i}`}>
                <code>{issue.code}</code>
                <span>{issue.message}</span>
                {issue.target_id ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => onFocus(issue)}
                  >
                    {issue.target_id}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="graph-validation-banner-block warning">
          <strong>경고 {warnings.length}건</strong>
          <ul>
            {warnings.map((issue, i) => (
              <li key={`w-${i}`}>
                <code>{issue.code}</code>
                <span>{issue.message}</span>
                {issue.target_id ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => onFocus(issue)}
                  >
                    {issue.target_id}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
