"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { McpServer } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { IconPlus, IconTrash } from "@/components/icons";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400";

type Probe = { name: string; description?: string }[];

export function McpServersView({ servers }: { servers: McpServer[] }) {
  const { t } = useLang();
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [probes, setProbes] = useState<Record<string, Probe | "error" | "loading">>({});

  useEffect(() => setOrigin(window.location.origin), []);

  async function create() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setName("");
      setUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.mcp.deleteConfirm)) return;
    await fetch(`/api/mcp/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function probe(id: string) {
    setProbes((p) => ({ ...p, [id]: "loading" }));
    try {
      const res = await fetch(`/api/mcp/${id}/tools`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      setProbes((p) => ({ ...p, [id]: data.tools as Probe }));
    } catch {
      setProbes((p) => ({ ...p, [id]: "error" }));
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700">{t.mcp.title}</h2>
      <p className="mb-3 mt-1 text-xs text-slate-400">{t.mcp.subtitle}</p>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.mcp.name}
          </span>
          <input
            className={inputCls}
            value={name}
            placeholder="Demo MCP"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.mcp.url}
          </span>
          <input
            dir="ltr"
            className={inputCls}
            value={url}
            placeholder="https://host/mcp"
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              setUrl(`${origin}/api/mcp/demo`);
              if (!name) setName("Demo MCP");
            }}
            className="mt-1 text-xs font-medium text-brand-600 hover:underline"
          >
            {t.mcp.demo}
          </button>
        </label>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 sm:col-span-2">
            {error}
          </div>
        )}
        <div className="sm:col-span-2">
          <button
            onClick={create}
            disabled={saving || !name.trim() || !url.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <IconPlus className="h-4 w-4" />
            {t.mcp.create}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {servers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t.mcp.empty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {servers.map((s) => (
                <li key={s.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{s.name}</div>
                      <p dir="ltr" className="truncate text-xs text-slate-400">
                        {s.url}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => probe(s.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        {t.mcp.probe}
                      </button>
                      <button
                        onClick={() => remove(s.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                        aria-label="delete"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {probes[s.id] && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {probes[s.id] === "loading" && (
                        <span className="text-xs text-slate-400">…</span>
                      )}
                      {probes[s.id] === "error" && (
                        <span className="text-xs text-red-500">×</span>
                      )}
                      {Array.isArray(probes[s.id]) &&
                        (probes[s.id] as Probe).map((tool) => (
                          <span
                            key={tool.name}
                            dir="ltr"
                            title={tool.description}
                            className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-[11px] font-medium text-violet-700"
                          >
                            {tool.name}
                          </span>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
