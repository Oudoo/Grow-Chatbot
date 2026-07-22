import type { Dialect } from "@/lib/types";

// Heuristic Arabic dialect detector. Scores characteristic markers per dialect.
// This is the seam where a trained classifier would later plug in; the rest of
// the app only depends on the `detectDialect` signature.

const AR_RE = /[؀-ۿ]/;

const MARKERS: Record<Exclude<Dialect, "auto">, string[]> = {
  egyptian: [
    "ازيك", "ازاي", "عايز", "عاوز", "مش", "دلوقتي", "كده", "اوي", "بتاع",
    "ايه", "خالص", "معلش", "علشان", "عشان",
  ],
  levantine: [
    "كيفك", "شو", "هلق", "هيك", "بدي", "منيح", "كتير", "لهيك", "عنجد",
    "كرمال", "شلون عمك", "تمام", "بدك",
  ],
  gulf: [
    "شلون", "وش", "وايد", "زين", "تبي", "تبغى", "يبه", "عقب", "مرة حلو",
    "ابغى", "ايش", "كذا",
  ],
  maghrebi: [
    "بزاف", "واخا", "دابا", "كيفاش", "علاش", "مزيان", "بصح", "نتا", "ديال",
    "شحال", "بغيت", "واش",
  ],
  msa: [
    "ماذا", "كيف", "هل", "الآن", "أريد", "جداً", "جدا", "نعم", "لماذا",
    "من فضلك", "حضرتك",
  ],
};

/**
 * Detect the Arabic dialect of a message. Returns "auto" when the text is not
 * Arabic (unknown), otherwise the best-scoring dialect (default "msa").
 */
export function detectDialect(text: string): Dialect {
  if (!AR_RE.test(text)) return "auto";
  const t = ` ${text} `;
  let best: Dialect = "msa";
  let bestScore = 0;
  for (const key of Object.keys(MARKERS) as Exclude<Dialect, "auto">[]) {
    let score = 0;
    for (const w of MARKERS[key]) if (t.includes(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}
