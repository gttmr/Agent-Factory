import {
  A2A_PART_FIELDS,
  A2A_ROLES,
  A2A_TASK_STATES,
  type A2AContract,
  type A2APartField,
  type A2ARole,
  type A2ATaskState
} from "../analyzer/types";
import { Button, Field, TextareaField } from "../ui/primitives";
import { A2ACheckGroup } from "./A2AContractEditorFields";

interface A2AContractCoreSectionsProps {
  draft: A2AContract;
  onUpdate: <K extends keyof A2AContract>(field: K, value: A2AContract[K]) => void;
  onUpdateAgentCard: (changes: Partial<A2AContract["agent_card"]>) => void;
  onUpdateMessageContract: (changes: Partial<A2AContract["message_contract"]>) => void;
  onUpdateTaskLifecycle: (changes: Partial<A2AContract["task_lifecycle"]>) => void;
  onUpdateTransition: (
    index: number,
    changes: Partial<A2AContract["task_lifecycle"]["allowed_transitions"][number]>
  ) => void;
}

export function A2AContractCoreSections({
  draft,
  onUpdate,
  onUpdateAgentCard,
  onUpdateMessageContract,
  onUpdateTaskLifecycle,
  onUpdateTransition
}: A2AContractCoreSectionsProps) {
  return (
    <>
      <section className="af-a2a-section">
        <h4>Agent Card</h4>
        <Field label="target_agent_name">
          <input value={draft.target_agent_name} onChange={(event) => onUpdate("target_agent_name", event.target.value)} />
        </Field>
        <TextareaField
          label="target_agent_purpose"
          rows={3}
          value={draft.target_agent_purpose}
          onChange={(event) => onUpdate("target_agent_purpose", event.target.value)}
        />
        <Field label="discovery_method">
          <input
            value={draft.agent_card.discovery_method}
            onChange={(event) => onUpdateAgentCard({ discovery_method: event.target.value })}
          />
        </Field>
        <Field label="agent_card_url">
          <input
            value={draft.agent_card.agent_card_url}
            onChange={(event) => onUpdateAgentCard({ agent_card_url: event.target.value })}
          />
        </Field>
        <Field label="version">
          <input
            value={draft.agent_card.version}
            onChange={(event) => onUpdateAgentCard({ version: event.target.value })}
          />
        </Field>
        <TextareaField
          label="notes"
          rows={3}
          value={draft.agent_card.notes}
          onChange={(event) => onUpdateAgentCard({ notes: event.target.value })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Message contract</h4>
        <A2ACheckGroup
          label="allowed_part_fields"
          values={A2A_PART_FIELDS}
          selected={draft.message_contract.allowed_part_fields}
          onChange={(next) => onUpdateMessageContract({ allowed_part_fields: next as A2APartField[] })}
        />
        <A2ACheckGroup
          label="allowed_roles"
          values={A2A_ROLES}
          selected={draft.message_contract.allowed_roles}
          onChange={(next) => onUpdateMessageContract({ allowed_roles: next as A2ARole[] })}
        />
      </section>

      <section className="af-a2a-section">
        <h4>Task lifecycle</h4>
        <A2ACheckGroup
          label="states"
          values={A2A_TASK_STATES}
          selected={draft.task_lifecycle.states}
          onChange={(next) => onUpdateTaskLifecycle({ states: next as A2ATaskState[] })}
        />
        <A2ACheckGroup
          label="terminal_states"
          values={A2A_TASK_STATES}
          selected={draft.task_lifecycle.terminal_states}
          onChange={(next) => onUpdateTaskLifecycle({ terminal_states: next as A2ATaskState[] })}
        />
        <div className="af-a2a-repeat">
          <div className="af-a2a-repeat-header">
            <strong>allowed_transitions</strong>
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                onUpdateTaskLifecycle({
                  allowed_transitions: [
                    ...draft.task_lifecycle.allowed_transitions,
                    { from: "TASK_STATE_SUBMITTED", to: "TASK_STATE_WORKING" }
                  ]
                })
              }
            >
              전이 추가
            </Button>
          </div>
          {draft.task_lifecycle.allowed_transitions.map((transition, index) => (
            <div key={`${transition.from}-${transition.to}-${index}`} className="af-a2a-transition-editor">
              <select
                value={transition.from}
                onChange={(event) => onUpdateTransition(index, { from: event.target.value as A2ATaskState })}
              >
                {A2A_TASK_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <span>→</span>
              <select
                value={transition.to}
                onChange={(event) => onUpdateTransition(index, { to: event.target.value as A2ATaskState })}
              >
                {A2A_TASK_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <TextareaField
          label="input_required_followup"
          rows={3}
          value={draft.task_lifecycle.input_required_followup}
          onChange={(event) => onUpdateTaskLifecycle({ input_required_followup: event.target.value })}
        />
        <TextareaField
          label="auth_required_followup"
          rows={3}
          value={draft.task_lifecycle.auth_required_followup}
          onChange={(event) => onUpdateTaskLifecycle({ auth_required_followup: event.target.value })}
        />
      </section>
    </>
  );
}
