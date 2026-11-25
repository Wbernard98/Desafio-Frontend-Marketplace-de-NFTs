import type { HTMLAttributes } from "react";

/** Skeleton com shimmer; dimensões vêm do className (evita deslocamento de layout). Respeita prefers-reduced-motion via CSS. */
export function Skeleton({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" data-skeleton className={`skeleton rounded ${className}`} {...rest} />;
}
