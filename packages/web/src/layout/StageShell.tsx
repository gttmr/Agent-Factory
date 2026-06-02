import { useCallback, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

export type StageStepStatus = "done" | "current" | "todo" | "blocked";

export interface StageStep {
  id: string;
  label: string;
  status: StageStepStatus;
  /** 클릭으로 이동 가능한지. 기본 true. 선행 스텝 미완료 시 false 로 잠글 수 있다. */
  available?: boolean;
  /** 스텝 라벨 아래 짧은 보조 문구. */
  hint?: string;
}

export interface StageNextAction {
  label: string;
  onClick?: () => void;
  /** 라우팅용. onClick 과 동시 사용 금지. */
  to?: string;
  disabled?: boolean;
  /** "다음에 할 일" 설명 — 강한 가이드. */
  hint?: ReactNode;
  tone?: "primary" | "secondary";
  pending?: boolean;
}

interface StageShellProps {
  eyebrow?: string;
  title: string;
  steps: StageStep[];
  activeStep: string;
  onStepChange: (id: string) => void;
  /** 항상 보이는 핵심 산출물 요약 strip. */
  summary?: ReactNode;
  /** 강한 가이드 CTA — 하단 고정. */
  nextAction?: StageNextAction;
  children: ReactNode;
}

const stepGlyph: Record<StageStepStatus, string> = {
  done: "✓",
  current: "●",
  todo: "○",
  blocked: "⚠"
};

/**
 * `?step=` 쿼리 파라미터로 활성 스텝을 얕게 관리한다. 파라미터가 없거나
 * 유효하지 않으면 `fallback`(보통 첫 미완료 스텝)으로 착지한다 — 강한 가이드.
 */
export function useStageStep(stepIds: string[], fallback: string): [string, (id: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("step");
  const active = raw && stepIds.includes(raw) ? raw : fallback;
  const setActive = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("step", id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  return [active, setActive];
}

export function StageShell({
  eyebrow,
  title,
  steps,
  activeStep,
  onStepChange,
  summary,
  nextAction,
  children
}: StageShellProps) {
  return (
    <div className="af-stage-shell">
      <aside className="af-step-rail" aria-label="단계">
        <ol className="af-step-list">
          {steps.map((step, index) => {
            const isActive = step.id === activeStep;
            const locked = step.available === false;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={[
                    "af-step",
                    `af-step-${step.status}`,
                    isActive ? "af-step-active" : "",
                    locked ? "af-step-locked" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "step" : undefined}
                  disabled={locked}
                  onClick={() => onStepChange(step.id)}
                >
                  <span className="af-step-index" aria-hidden="true">
                    {step.status === "done" ? stepGlyph.done : index + 1}
                  </span>
                  <span className="af-step-body">
                    <span className="af-step-label">{step.label}</span>
                    {step.hint ? <span className="af-step-hint">{step.hint}</span> : null}
                  </span>
                  <span className="af-step-glyph" aria-hidden="true">
                    {stepGlyph[step.status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {nextAction?.hint ? (
          <div className="af-step-guide">
            <span className="af-step-guide-eyebrow">다음에 할 일</span>
            <p>{nextAction.hint}</p>
          </div>
        ) : null}
      </aside>

      <section className="af-stage-main">
        <header className="af-stage-main-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
        </header>

        {summary ? <div className="af-stage-summary">{summary}</div> : null}

        <div className="af-stage-step-content">{children}</div>

        {nextAction ? (
          <footer className="af-stage-cta">
            {nextAction.to ? (
              <Link
                to={nextAction.to}
                className={`ui-button ui-button-${nextAction.tone ?? "primary"}`}
                aria-disabled={nextAction.disabled}
              >
                {nextAction.label}
              </Link>
            ) : (
              <button
                type="button"
                className={`ui-button ui-button-${nextAction.tone ?? "primary"}`}
                onClick={nextAction.onClick}
                disabled={nextAction.disabled || nextAction.pending}
              >
                {nextAction.pending ? "처리 중…" : nextAction.label}
              </button>
            )}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
