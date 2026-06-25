import * as store from "@/lib/store";
import type { NewBot } from "@/lib/store";

let seeded = false;

/**
 * Idempotently seed a default workspace and two demo bots so the platform is
 * immediately explorable. Safe to call on every server entry point.
 */
export function seedIfEmpty(): void {
  if (seeded) return;
  const tenant = store.defaultTenant();
  if (store.listBots(tenant.id).length > 0) {
    seeded = true;
    return;
  }

  const arabicBot: NewBot = {
    tenantId: tenant.id,
    name: "مساعد متجر نمو",
    description:
      "مساعد خدمة العملاء لمتجر نمو للإلكترونيات، يجيب عن المنتجات والشحن والإرجاع.",
    language: "ar",
    dialect: "levantine",
    persona:
      "أنت مساعد ودود ومحترف لمتجر نمو. تتحدث بلهجة شامية لطيفة، تساعد الزبائن باختصار ووضوح، وتقترح منتجات مناسبة عند الحاجة.",
    knowledge: [
      "متجر نمو يبيع الإلكترونيات: هواتف، لابتوبات، سماعات، وإكسسوارات.",
      "الشحن داخل عمّان خلال ٢٤ ساعة ومجاني للطلبات فوق ٥٠ ديناراً. باقي المحافظات خلال ٢-٣ أيام عمل برسوم ٣ دنانير.",
      "سياسة الإرجاع: يمكن إرجاع المنتج خلال ١٤ يوماً إذا كان بحالته الأصلية مع الفاتورة.",
      "طرق الدفع: نقداً عند الاستلام، بطاقة ائتمان، أو محفظة إلكترونية.",
      "ساعات الدعم: من السبت إلى الخميس، ٩ صباحاً حتى ٦ مساءً.",
      "أبرز العروض الحالية: خصم ١٠٪ على السماعات اللاسلكية وضمان سنتين على اللابتوبات.",
    ].join("\n"),
    welcomeMessage:
      "أهلاً وسهلاً في متجر نمو! 👋 كيف فيني ساعدك اليوم؟ اسألني عن المنتجات أو الشحن أو الإرجاع.",
    provider: "default",
    temperature: 0.4,
    status: "active",
  };

  const englishBot: NewBot = {
    tenantId: tenant.id,
    name: "Grow Support Bot",
    description:
      "Customer support assistant for the Grow SaaS product, covering plans, onboarding and billing.",
    language: "en",
    dialect: "auto",
    persona:
      "You are a concise, friendly support agent for Grow. Help users pick a plan, get started, and resolve billing questions.",
    knowledge: [
      "Grow offers three plans: Starter ($19/mo), Professional ($49/mo), and Enterprise ($99/mo).",
      "All plans include the bilingual Arabic/English admin, the web chat widget, and the channel API.",
      "The free trial lasts 14 days, no credit card required.",
      "Billing is monthly and can be cancelled anytime from the dashboard.",
      "Support hours are Sunday-Thursday, 9am-6pm (GMT+3).",
    ].join("\n"),
    welcomeMessage:
      "Hi there! 👋 I'm the Grow support bot. Ask me about plans, onboarding, or billing.",
    provider: "default",
    temperature: 0.4,
    status: "active",
  };

  store.createBot(arabicBot);
  store.createBot(englishBot);
  seeded = true;
}
