import { useEffect, useState } from "react";

export default function JsonSchemaEditor({
  label,
  value,
  onChange,
  minRows = 8
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  minRows?: number;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  return (
    <label className="json-editor">
      <span>{label}</span>
      <textarea
        value={text}
        rows={minRows}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          try {
            const parsed = JSON.parse(next);
            setError(null);
            onChange(parsed);
          } catch (parseError) {
            setError(parseError instanceof Error ? parseError.message : "JSON parse error");
          }
        }}
      />
      {error ? <em className="field-error">{error}</em> : null}
    </label>
  );
}
