import type { ReactNode } from "react";

export default function StatusBadge({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "success" | "warning" | "error" | "purple";
  children: ReactNode;
}) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
