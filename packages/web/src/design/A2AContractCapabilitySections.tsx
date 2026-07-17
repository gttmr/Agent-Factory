import {
  A2A_HTTP_PATHS,
  A2A_OPERATION_NAMES,
  A2A_STREAM_WRAPPERS,
  type A2AContract,
  type A2AHttpPath,
  type A2AOperationName,
  type A2AStreamWrapper
} from "../analyzer/types";
import { Field, TextareaField } from "../ui/primitives";
import {
  A2ACheckGroup,
  A2AInterfaceEditor,
  A2ARuntimePolicyEditor,
  A2ASecurityEditor,
  A2ATextListField
} from "./A2AContractEditorFields";
import { createEmptyA2AInterface } from "./A2AContractPanelModel";

interface A2AContractCapabilitySectionsProps {
  draft: A2AContract;
  onUpdate: <K extends keyof A2AContract>(field: K, value: A2AContract[K]) => void;
  onUpdateStreaming: (changes: Partial<A2AContract["streaming"]>) => void;
  onUpdateArtifactContract: (changes: Partial<A2AContract["artifact_contract"]>) => void;
  onUpdateInterface: (index: number, changes: Partial<A2AContract["supported_interfaces"][number]>) => void;
  onUpdateSecurityScheme: (index: number, changes: Partial<A2AContract["security_schemes"][number]>) => void;
  onUpdateSecurityRequirement: (
    index: number,
    changes: Partial<A2AContract["security_requirements"][number]>
  ) => void;
}

export function A2AContractCapabilitySections({
  draft,
  onUpdate,
  onUpdateStreaming,
  onUpdateArtifactContract,
  onUpdateInterface,
  onUpdateSecurityScheme,
  onUpdateSecurityRequirement
}: A2AContractCapabilitySectionsProps) {
  return (
    <>
      <section className="af-a2a-section">
        <h4>Task capability</h4>
        <A2AInterfaceEditor
          contract={draft}
          onAdd={() => onUpdate("supported_interfaces", [...draft.supported_interfaces, createEmptyA2AInterface()])}
          onUpdate={onUpdateInterface}
        />
        <A2ATextListField
          label="input_modes"
          values={draft.input_modes}
          onChange={(values) => onUpdate("input_modes", values)}
        />
        <A2ATextListField
          label="output_modes"
          values={draft.output_modes}
          onChange={(values) => onUpdate("output_modes", values)}
        />
        <A2ATextListField label="skills" values={draft.skills} onChange={(values) => onUpdate("skills", values)} />
        <A2ATextListField
          label="extensions"
          values={draft.extensions}
          onChange={(values) => onUpdate("extensions", values)}
        />
        <A2ACheckGroup
          label="operations"
          values={A2A_OPERATION_NAMES}
          selected={draft.operations}
          onChange={(next) => onUpdate("operations", next as A2AOperationName[])}
        />
        <A2ACheckGroup
          label="http_paths"
          values={A2A_HTTP_PATHS}
          selected={draft.http_paths}
          onChange={(next) => onUpdate("http_paths", next as A2AHttpPath[])}
        />
        <Field label="adk_host_mapping">
          <input value={draft.adk_host_mapping} onChange={(event) => onUpdate("adk_host_mapping", event.target.value)} />
        </Field>
        <Field label="timeout">
          <input value={draft.timeout} onChange={(event) => onUpdate("timeout", event.target.value)} />
        </Field>
        <A2ACheckGroup
          label="streaming.wrappers"
          values={A2A_STREAM_WRAPPERS}
          selected={draft.streaming.wrappers}
          onChange={(next) => onUpdateStreaming({ wrappers: next as A2AStreamWrapper[] })}
        />
        <label className="af-a2a-toggle">
          <input
            type="checkbox"
            checked={draft.streaming.supported}
            onChange={(event) => onUpdateStreaming({ supported: event.target.checked })}
          />
          <span>streaming.supported</span>
        </label>
        <TextareaField
          label="streaming.non_streaming_fallback"
          rows={3}
          value={draft.streaming.non_streaming_fallback}
          onChange={(event) => onUpdateStreaming({ non_streaming_fallback: event.target.value })}
        />
        <TextareaField
          label="artifact_contract.mutation_rules"
          rows={3}
          value={draft.artifact_contract.mutation_rules}
          onChange={(event) => onUpdateArtifactContract({ mutation_rules: event.target.value })}
        />
        <TextareaField
          label="artifact_contract.chunking_policy"
          rows={3}
          value={draft.artifact_contract.chunking_policy}
          onChange={(event) => onUpdateArtifactContract({ chunking_policy: event.target.value })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Auth / Retry / Fallback / Audit / Data</h4>
        <A2ASecurityEditor
          contract={draft}
          onAddScheme={() =>
            onUpdate("security_schemes", [...draft.security_schemes, { name: "needs_info", scheme: "needs_info" }])
          }
          onAddRequirement={() =>
            onUpdate("security_requirements", [
              ...draft.security_requirements,
              { scheme_name: "needs_info", scopes: [] }
            ])
          }
          onUpdateScheme={onUpdateSecurityScheme}
          onUpdateRequirement={onUpdateSecurityRequirement}
        />
        <A2ARuntimePolicyEditor
          policy={draft.adk_runtime_policy}
          onChange={(adkRuntimePolicy) => onUpdate("adk_runtime_policy", adkRuntimePolicy)}
        />
        <TextareaField label="auth" rows={3} value={draft.auth} onChange={(event) => onUpdate("auth", event.target.value)} />
        <TextareaField
          label="token_handling"
          rows={3}
          value={draft.token_handling}
          onChange={(event) => onUpdate("token_handling", event.target.value)}
        />
        <TextareaField label="retry" rows={3} value={draft.retry} onChange={(event) => onUpdate("retry", event.target.value)} />
        <TextareaField
          label="fallback"
          rows={3}
          value={draft.fallback}
          onChange={(event) => onUpdate("fallback", event.target.value)}
        />
        <TextareaField
          label="cancellation"
          rows={3}
          value={draft.cancellation}
          onChange={(event) => onUpdate("cancellation", event.target.value)}
        />
        <TextareaField
          label="unsupported_operation"
          rows={3}
          value={draft.unsupported_operation}
          onChange={(event) => onUpdate("unsupported_operation", event.target.value)}
        />
        <TextareaField
          label="get_task_fallback"
          rows={3}
          value={draft.get_task_fallback}
          onChange={(event) => onUpdate("get_task_fallback", event.target.value)}
        />
        <TextareaField label="audit" rows={3} value={draft.audit} onChange={(event) => onUpdate("audit", event.target.value)} />
        <TextareaField
          label="data_policy"
          rows={3}
          value={draft.data_policy}
          onChange={(event) => onUpdate("data_policy", event.target.value)}
        />
        <TextareaField
          label="push_notification_policy"
          rows={3}
          value={draft.push_notification_policy ?? ""}
          onChange={(event) =>
            onUpdate("push_notification_policy", event.target.value.trim() ? event.target.value : null)
          }
          hint="비어 있으면 null 로 저장합니다."
        />
      </section>
    </>
  );
}
