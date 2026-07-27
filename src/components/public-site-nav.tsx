import Link from "next/link";

export type PublicSiteSection = "supplements" | "lifespan" | "methodology";

type PublicSiteNavProps = {
  activeSection: PublicSiteSection;
  className?: string;
  showBrand?: boolean;
};

const publicSections = [
  { href: "/", id: "supplements", label: "Supplements" },
  { href: "/lifespan", id: "lifespan", label: "Lifespan" },
  { href: "/methodology", id: "methodology", label: "Methodology" }
] as const satisfies ReadonlyArray<{
  href: string;
  id: PublicSiteSection;
  label: string;
}>;

export function PublicSiteNav({
  activeSection,
  className = "",
  showBrand = true
}: PublicSiteNavProps) {
  return (
    <div
      className={`rounded-lg border border-line bg-white px-4 py-3 shadow-panel ${className}`.trim()}
    >
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-center ${
          showBrand ? "sm:justify-between" : "sm:justify-end"
        }`}
      >
        {showBrand ? (
          <Link
            aria-label="Apex Lifespan home"
            className="w-fit rounded-sm text-lg font-semibold tracking-normal text-ink outline-none transition-colors hover:text-signal focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
            href="/"
          >
            Apex Lifespan
          </Link>
        ) : null}

        <nav aria-label="Primary navigation" className="-mx-1 overflow-x-auto px-1">
          <ul className="flex min-w-max items-center gap-1" role="list">
            {publicSections.map((section) => {
              const isActive = section.id === activeSection;

              return (
                <li key={section.id}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 ${
                      isActive
                        ? "bg-mist text-signal"
                        : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                    }`}
                    href={section.href}
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
