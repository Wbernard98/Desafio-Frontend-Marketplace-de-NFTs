import { useAnnouncement } from "./announcer";

/** Regiões vivas (polite/assertive) lidas por leitores de tela. */
export function Announcer() {
  const a = useAnnouncement();
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {a.politeness === "polite" ? a.message : ""}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {a.politeness === "assertive" ? a.message : ""}
      </div>
    </>
  );
}
