"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Integration, IntegrationType } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { IconTrash, IconLink } from "@/components/icons";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400";

interface CatalogEntry {
  type: IntegrationType;
  label: string;
  tools: string[];
}

export function IntegrationsView({
  integrations,
  catalog,
}: {
  integrations: Integration[];
  catalog: CatalogEntry[];
}) {
  const { t } = useLang();
  const router = useRouter();
  const [type, setType] = useState<IntegrationType>(catalog[0]?.type ?? "shopify");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const labelOf = (ty: string) =>
    catalog.find((c) => c.type === ty)?.label ?? ty;
  const toolsOf = (ty: IntegrationType) =>
    catalog.find((c) => c.type === ty)?.tools ?? [];

  async function connect() {
    setSaving(true);
    try {
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          name: name || labelOf(type),
          baseUrl: baseUrl || undefined,
          apiKey: apiKey || undefined,
        }),
      });
      setName("");
      setBaseUrl("");
      setApiKey("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.integrations.deleteConfirm)) return;
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title={t.integrations.title}
        subtitle={t.integrations.subtitle}
      />

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.integrations.type}
          </span>
          <select
            className={inputCls}
            value={type}
            onChange={(e) => setType(e.target.value as IntegrationType)}
          >
            {catalog.map((c) => (
              <option key={c.type} value={c.type}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.integrations.name}
          </span>
          <input
            className={inputCls}
            value={name}
            placeholder={labelOf(type)}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.integrations.baseUrl}
          </span>
          <input
            dir="ltr"
            className={inputCls}
            value={baseUrl}
            placeholder="https://store.example.com"
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.integrations.apiKey}
          </span>
          <input
            dir="ltr"
            type="password"
            className={inputCls}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2">
          <div className="mb-3 text-xs text-slate-400">
            {t.integrations.provides}:{" "}
            <span dir="ltr" className="font-mono">
              {toolsOf(type).join(", ") || "—"}
            </span>
            <span className="block">{t.integrations.demoNote}</span>
          </div>
          <button
            onClick={connect}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <IconLink className="h-4 w-4" />
            {t.integrations.connect}
          </button>
        </div>
      </div>

      <div className="mt-6">
        {integrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t.integrations.empty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {integrations.map((i) => (
                <li
                  key={i.id}
                  className="flex items-start justify-between gap-4 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{i.name}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {t.integrations.connected}
                      </span>
                      {!i.baseUrl && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                          demo
                        </span>
                      )}
                    </div>
                    <p
                      dir="ltr"
                      className="mt-0.5 truncate font-mono text-xs text-slate-400"
                    >
                      {toolsOf(i.type).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(i.id)}
                    className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                    aria-label="delete"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
