import type { Sentiment } from "@/lib/types";

// Lightweight bilingual (Arabic + English) lexicon sentiment scorer. This is a
// pragmatic heuristic that surfaces tone in the agent inbox; it is the seam
// where a trained classifier would later plug in.

const POSITIVE = [
  // English
  "thanks",
  "thank",
  "great",
  "good",
  "excellent",
  "perfect",
  "love",
  "happy",
  "awesome",
  "helpful",
  "amazing",
  "appreciate",
  // Arabic
  "شكرا",
  "شكراً",
  "ممتاز",
  "رائع",
  "جميل",
  "حلو",
  "تمام",
  "ممنون",
  "أحسنت",
  "مفيد",
  "سعيد",
  "جيد",
];

const NEGATIVE = [
  // English
  "bad",
  "terrible",
  "awful",
  "hate",
  "angry",
  "useless",
  "broken",
  "wrong",
  "slow",
  "refund",
  "complaint",
  "disappointed",
  "problem",
  "issue",
  // Arabic
  "سيء",
  "سيئة",
  "فظيع",
  "زعلان",
  "غاضب",
  "مشكلة",
  "خطأ",
  "بطيء",
  "استرجاع",
  "شكوى",
  "محبط",
  "تعطل",
  "ماشتغل",
  "زفت",
];

export function analyzeSentiment(text: string): Sentiment {
  const t = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const w of POSITIVE) if (t.includes(w)) score += 1;
  for (const w of NEGATIVE) if (t.includes(w)) score -= 1;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}
