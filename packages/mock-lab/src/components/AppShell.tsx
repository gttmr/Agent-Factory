import type { ReactNode } from "react";

export default function AppShell({
  header,
  workflow,
  catalog,
  editor,
  draft,
  server,
  smoke,
  footer
}: {
  header: ReactNode;
  workflow: ReactNode;
  catalog: ReactNode;
  editor: ReactNode;
  draft: ReactNode;
  server: ReactNode;
  smoke: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="afml-shell">
      {header}
      {workflow}
      <main className="afml-grid">
        <aside className="pane catalog-pane">{catalog}</aside>
        <section className="pane editor-pane">{editor}</section>
        <section className="pane draft-pane">{draft}</section>
        <section className="pane server-pane">{server}</section>
        <section className="pane smoke-pane">{smoke}</section>
      </main>
      {footer}
    </div>
  );
}
