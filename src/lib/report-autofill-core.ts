// Pure helpers for the upload autofill: no database, no network. Kept apart so
// the link rule and the text extraction can be tested on their own.

// How the team writes months in links: /bernardo-weekly-14-sept, /coded-planning-sept
const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function plain(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function monthAbbr(month: number): string {
  return MONTH_ABBR[month - 1] ?? "";
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

export type SlugParts = {
  // Client name as written ("Docsi App"); null for internal reports.
  client: string | null;
  // What the report is, in a few words ("weekly", "estrategia social").
  kind: string;
  // 1-31 when the report is tied to a specific day, otherwise null.
  day: number | null;
  // 1-12.
  month: number;
};

// The team's rule for links: client - what is being sent - date.
//   bernardo-weekly-14-sept · coded-planning-sept · docsiapp-estrategia-social-sept
// The client is one word ("Docsi App" -> docsiapp); the date is the day (only
// when there is one) and the month abbreviation, without the year.
export function buildSlug(parts: SlugParts): string {
  const client = plain(parts.client ?? "argus").replace(/[^a-z0-9]+/g, "");
  const kind = plain(parts.kind)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const day = parts.day && parts.day >= 1 && parts.day <= 31 ? String(parts.day) : "";
  const date = [day, monthAbbr(parts.month)].filter(Boolean).join("-");

  return [client || "argus", kind || "reporte", date]
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// "Septiembre 2026" or "Semana 38" style label, used when Claude gives none.
export function defaultPeriodLabel(month: number, year: number): string {
  return `${monthName(month)} ${year}`;
}

// Matches a model-provided client against the clients that already exist,
// ignoring case, accents and spacing, so the same account is never split.
export function matchKnownClient(client: string | null, known: string[]): string | null {
  const name = client?.trim();
  if (!name) return null;
  const key = (s: string) => plain(s).replace(/[^a-z0-9]+/g, "");
  const hit = known.find((k) => key(k) === key(name));
  return hit ?? name;
}

// ---------------------------------------------------------------- text
const DATA_URI = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*;base64,[A-Za-z0-9+/=]{100,}/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// The part of a report that says what it is: <title>, headings and the start
// of the visible text. Images, scripts and styles are noise (and cost tokens).
export function extractReportText(html: string, maxChars = 24_000): string {
  const clean = html.replace(DATA_URI, "");
  const title = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";

  const headings = [...clean.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 40);

  const body = decodeEntities(
    clean
      .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  const out = [
    title.trim() ? `TITLE: ${decodeEntities(title).replace(/\s+/g, " ").trim()}` : "",
    headings.length ? `HEADINGS:\n- ${headings.join("\n- ")}` : "",
    `TEXT:\n${body}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return out.length > maxChars ? `${out.slice(0, maxChars)}\n[…truncado]` : out;
}
