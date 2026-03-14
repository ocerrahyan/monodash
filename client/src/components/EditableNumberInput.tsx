import { useState, useEffect, useRef } from "react";

export function EditableNumberInput({ value, onCommit, step, min, className, testId, style }: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  className?: string;
  testId?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={editing ? text : String(value)}
      onFocus={() => {
        setEditing(true);
        setText(String(value));
        setTimeout(() => inputRef.current?.select(), 0);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) {
          let v = parsed;
          if (min !== undefined) v = Math.max(min, v);
          onCommit(v);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      step={step}
      className={className}
      style={style}
      data-testid={testId}
    />
  );
}
