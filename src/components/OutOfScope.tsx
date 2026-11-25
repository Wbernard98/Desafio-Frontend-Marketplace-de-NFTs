import { Link } from "@tanstack/react-router";

/**
 * Seções que existem no layout (menu superior e lateral), mas não fazem parte desta entrega.
 * Mostram um aviso claro em vez de fingir funcionalidade.
 */
export function OutOfScopeNotice({ title }: { title: string }) {
  return (
    <div role="status" className="max-w-xl border border-line bg-[#1d0f09] p-6">
      <h1 className="text-sm font-bold text-fg">{title}</h1>
      <p className="mt-2 text-xs text-muted">Esta seção aparece no layout, mas não faz parte desta entrega e ainda não está disponível.</p>
    </div>
  );
}

export function OutOfScopePage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-300 px-6 py-16">
      <OutOfScopeNotice title={title} />
      <Link to="/" search={{ tab: "all", sort: "recent", page: 1 }} className="mt-5 inline-block text-xs text-accent underline">
        Voltar ao início
      </Link>
    </div>
  );
}
