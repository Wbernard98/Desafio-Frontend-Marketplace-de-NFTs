interface Props { page: number; totalPages: number; onChange: (page: number) => void }

export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const base = "flex h-7 min-w-7 items-center justify-center border border-line px-2";
  return (
    <nav aria-label="Paginação" className="mt-7 flex justify-end gap-1.5">
      {pages.map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)} aria-current={p === page ? "page" : undefined}
          aria-label={`Página ${p}`} className={`${base} ${p === page ? "border-accent bg-accent text-bg" : "hover:text-accent"}`}>
          {p}
        </button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Próxima página"
        className={`${base} disabled:opacity-40`}>›</button>
    </nav>
  );
}
