"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";
import {
  IconDashboard,
  IconBots,
  IconChat,
  IconPlay,
  IconGlobe,
  IconWrench,
  IconChart,
  IconLink,
  IconMic,
} from "@/components/icons";

export function Sidebar() {
  const { t, lang, toggle } = useLang();
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: t.nav.dashboard, Icon: IconDashboard, exact: true },
    { href: "/dashboard/bots", label: t.nav.bots, Icon: IconBots },
    {
      href: "/dashboard/conversations",
      label: t.nav.conversations,
      Icon: IconChat,
    },
    { href: "/dashboard/playground", label: t.nav.playground, Icon: IconPlay },
    { href: "/dashboard/voice", label: t.nav.voice, Icon: IconMic },
    { href: "/dashboard/tools", label: t.nav.tools, Icon: IconWrench },
    {
      href: "/dashboard/integrations",
      label: t.nav.integrations,
      Icon: IconLink,
    },
    { href: "/dashboard/analytics", label: t.nav.analytics, Icon: IconChart },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-e border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">
          G
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-slate-900">{t.app.full}</div>
          <div className="text-[11px] text-slate-400">{t.app.tagline}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {links.map(({ href, label, Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={active ? "text-brand-600" : "text-slate-400"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={toggle}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <span className="flex items-center gap-3">
            <IconGlobe className="text-slate-400" />
            {t.common.language}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {lang === "ar" ? "العربية" : "English"}
          </span>
        </button>
      </div>
    </aside>
  );
}
