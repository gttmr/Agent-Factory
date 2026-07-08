import { useEffect, useRef, useState } from "react";
import { formatProcessStreamLogLine, type ProcessStreamEvent, type StreamLogEntry } from "../../state/useStreamingProcess";

export type BuildProcessLogOwner = "artifact-sync" | "runtime-stub";
export type { StreamLogEntry };

export function useBuildProcessLog() {
  const [entries, setEntries] = useState<readonly StreamLogEntry[]>([]);
  const [owner, setOwner] = useState<BuildProcessLogOwner | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries]);

  function reset(nextOwner: BuildProcessLogOwner) {
    setOwner(nextOwner);
    setEntries([]);
  }

  function append(event: ProcessStreamEvent) {
    const text = formatProcessStreamLogLine(event);
    if (!text) return;
    sequence.current += 1;
    setEntries((current) => [
      ...current.slice(-199),
      { id: sequence.current, text }
    ]);
  }

  return { append, entries, logRef, owner, reset };
}
