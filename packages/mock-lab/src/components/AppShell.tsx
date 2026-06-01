import type { ReactNode } from "react";

export default function AppShell({
  header,
  catalog,
  editor,
  generate,
  server,
  smoke,
  footer
}: {
  header: ReactNode;
  catalog: ReactNode;
  editor: ReactNode;
  generate: ReactNode;
  server: ReactNode;
  smoke: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="afml-shell">
      {header}
      <main className="afml-grid">
        <aside className="pane catalog-pane">{catalog}</aside>
        <section className="pane editor-pane">{editor}</section>
        <section className="pane generate-pane">{generate}</section>
        <section className="pane server-pane">{server}</section>
        <section className="pane smoke-pane">{smoke}</section>
      </main>
      {footer}
    </div>
  );
}
