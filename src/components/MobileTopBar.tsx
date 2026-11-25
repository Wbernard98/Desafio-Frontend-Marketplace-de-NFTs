import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

/** Barra superior dos frames mobile (voltar + título + ação). Só aparece abaixo de md. */
export function MobileTopBar({ title, right }: { title?: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="mb-4 grid h-12 grid-cols-[2.5rem_1fr_2.5rem] items-center md:hidden">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: "/", search: { tab: "all", sort: "recent", page: 1 } }))}
        aria-label="Voltar"
        className="grid size-9 place-items-center rounded-full bg-surface text-fg transition hover:text-accent"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      {title ? <p className="truncate text-center text-sm font-bold text-fg">{title}</p> : <span />}
      <div className="flex justify-end">{right}</div>
    </div>
  );
}
