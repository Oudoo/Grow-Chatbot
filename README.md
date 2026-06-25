# Grow-Chatbot (Mujeeb)

An **Arabic-first conversational AI platform** — a multi-tenant chatbot builder
with a bilingual (Arabic / English) RTL admin dashboard, a backend-switchable
**multi-provider LLM engine**, a channel-ready API, and an **embeddable web chat
widget**.

This repository is the **foundation MVP**: it runs end-to-end out of the box —
**no API keys and no external database required** — thanks to a built-in mock
provider and a file-backed store. Add a provider key to switch from demo replies
to real, knowledge-grounded AI.

---

## Highlights

- **Multi-provider, backend-controlled LLM layer.** Claude, OpenAI, and Gemini
  behind one `LLMProvider` interface. The provider is chosen by the **backend**
  (a global default plus a per-bot override) — never exposed to end users. If a
  selected provider has no key configured, the engine transparently falls back
  to the mock provider so the app always responds.
- **Bilingual RTL admin.** Full Arabic ⇄ English UI with automatic
  right-to-left layout. Arabic is the default.
- **Channel-ready API.** One channel-agnostic `POST /api/chat` endpoint serves
  the web widget today and is shaped for WhatsApp, Messenger, Instagram, and
  Telegram next.
- **Embeddable widget.** A one-line `<script>` snippet drops a floating chat
  launcher onto any website, or link directly to a standalone chat page.
- **Per-bot persona, dialect & knowledge.** Each bot has a language, an Arabic
  dialect hint (Gulf / Levantine / Egyptian / Maghrebi / MSA / auto), a persona,
  and a plain-text knowledge base the engine grounds answers in.
- **Bilingual sentiment tagging** on inbound messages, surfaced in a unified
  conversation inbox.
- **Zero-setup persistence.** A swappable file-backed JSON store (`.data/`) so
  the whole thing runs locally with no services to provision.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000  → redirects to /dashboard
```

The dashboard seeds two demo bots on first load (an Arabic Levantine store
assistant and an English SaaS support bot). Head to **Playground** to chat with
one immediately — it works with no keys via the mock provider.

### Production build

```bash
npm run build
npm start
```

### Type checking

```bash
npm run typecheck
```

---

## Configuration

Copy `.env.example` → `.env.local` and set what you need. Everything is optional;
the platform runs without any of it.

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | Backend **global default** provider: `mock` \| `anthropic` \| `openai` \| `gemini` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Enable Claude |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Enable OpenAI |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Enable Gemini |
| `DATA_DIR` | Where the file store writes (default `./.data`) |

### How provider selection works (backend-driven)

1. A bot's **provider override** wins if set to a concrete provider.
2. Otherwise the **global default** (`LLM_PROVIDER`) is used.
3. If the resolved provider has **no key configured**, the engine falls back to
   `mock` and flags `fellBack: true` in the response metadata.

End users never choose a model — selection lives entirely in the backend/admin,
addressing the "single-vendor lock-in" gap by making the vendor a config switch.

---

## The API

### `POST /api/chat` — channel-agnostic message ingestion

```jsonc
// request
{
  "botId": "…",            // required
  "message": "…",          // required
  "conversationId": "…",   // optional — omit to start a new conversation
  "channel": "web",        // web | whatsapp | messenger | instagram | telegram | api
  "endUserName": "…"       // optional
}

// response
{
  "conversationId": "…",
  "reply": "…",
  "sentiment": "positive | negative | neutral",
  "meta": { "provider": "mock", "model": "mock-1", "latencyMs": 121, "fellBack": false }
}
```

CORS is open on this route so it can power embedded widgets and external
channels. Other endpoints:

| Method & path | Description |
| --- | --- |
| `GET/POST /api/bots` | List / create bots |
| `GET/PUT/DELETE /api/bots/:id` | Read / update / delete a bot |
| `GET /api/conversations` | List conversations (optional `?botId=`) |
| `GET/PATCH /api/conversations/:id` | Thread + messages / change status |
| `GET /api/providers` | Provider catalog (labels + configured flags) |
| `GET /api/health` | Health + default provider |

---

## Embedding the widget

From a bot's editor, copy the snippet (host is your deployment):

```html
<script src="https://YOUR_HOST/embed.js" data-bot="BOT_ID" async></script>
```

Optional attributes: `data-title`, `data-color`, `data-position="left|right"`.
Or link directly to the standalone page: `https://YOUR_HOST/widget/BOT_ID`.

---

## Project structure

```
src/
  app/
    api/                 # route handlers (chat, bots, conversations, providers, health)
    dashboard/           # bilingual RTL admin (overview, bots, conversations, playground)
    widget/[botId]/      # standalone embeddable chat page
  components/            # React UI (ChatPanel, BotForm, inbox, sidebar, i18n provider…)
  lib/
    llm/                 # provider abstraction + mock/anthropic/openai/gemini + factory
    engine/              # prompt builder, sentiment, runChat orchestration
    store/               # file-backed repositories (swap for Postgres later)
    i18n/                # ar/en dictionaries
    types.ts             # shared domain types
public/embed.js          # drop-in widget loader
```

### Architecture in one line

`channel → /api/chat → engine.processTurn → buildSystemPrompt + sentiment →
resolveProvider(bot) → LLMProvider.chat → persist → inbox`

---

## Roadmap (intentional seams)

This MVP is built so the strategic differentiators slot into existing seams:

- **Agentic workflows** — tool/function-calling in the `LLMProvider` interface
  and `engine` orchestration.
- **Live human handoff** — conversations already carry a `handoff` status; the
  inbox is the place for agent takeover.
- **Native dialect NLP** — `Dialect` steering + an `analyzeSentiment` seam are
  ready to swap generic models for trained Arabic ones.
- **Data sovereignty** — the `store/` layer is a single swap point for a
  self-hosted DB; the `LLMProvider` interface accepts a self-hosted model.
- **CRM / e-commerce integrations, voice, analytics, A/B testing** — layer onto
  the engine and inbox.

---

## Notes

- The file-backed store is for development convenience; for production, swap
  `src/lib/store` for a real database (Postgres/Prisma) — it is the only module
  the rest of the app depends on for persistence.
- The mock provider is a deterministic, language-matched stand-in so the product
  is fully demoable without credentials.
