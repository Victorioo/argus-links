// Reports are served from the same origin as the app, so script inside one could
// act on a visitor's session. Anything that arrives through automation (Claude
// applying comments, Claude publishing over MCP) is therefore never allowed to
// carry executable content. People can still upload such HTML themselves.

type Rule = { label: string; re: RegExp };

const RULES: Rule[] = [
  { label: "<script>", re: /<script\b/gi },
  { label: "<iframe>", re: /<iframe\b/gi },
  { label: "<object>", re: /<object\b/gi },
  { label: "<embed>", re: /<embed\b/gi },
  { label: "<form>", re: /<form\b/gi },
  { label: "meta refresh (redirección automática)", re: /<meta[^>]+http-equiv\s*=\s*["']?refresh/gi },
  { label: "atributos de evento (onclick=, onload=…)", re: /[\s"'/]on[a-z]+\s*=/gi },
  { label: "enlaces javascript:", re: /javascript\s*:/gi },
];

export type ActiveContentFinding = { label: string; count: number; example: string };

// Everything executable found in a whole document, with a short example each.
export function findActiveContent(html: string): ActiveContentFinding[] {
  const findings: ActiveContentFinding[] = [];
  for (const { label, re } of RULES) {
    const matches = [...html.matchAll(new RegExp(re.source, re.flags))];
    if (!matches.length) continue;
    const at = matches[0].index ?? 0;
    const example = html
      .slice(Math.max(0, at - 10), at + 70)
      .replace(/\s+/g, " ")
      .trim();
    findings.push({ label, count: matches.length, example });
  }
  return findings;
}

// An edit may keep what a snippet already had, but must not ADD more.
export function introducesActiveContent(find: string, replace: string): boolean {
  const count = (text: string, re: RegExp) => (text.match(new RegExp(re.source, re.flags)) || []).length;
  return RULES.some(({ re }) => count(replace, re) > count(find, re));
}

// ---------------------------------------------------------------- external hosts
// Comments come from anyone, so a result that suddenly talks to new domains is
// flagged for the human reviewing the preview.
export function externalHosts(html: string): Set<string> {
  const hosts = new Set<string>();
  const re = /(?:src|href|action|poster|data-src)\s*=\s*["']?(?:https?:)?\/\/([^/"'\s?#>]+)|url\(\s*["']?(?:https?:)?\/\/([^/"'\s)?#]+)|@import\s+["'](?:https?:)?\/\/([^/"'\s?#]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) hosts.add((m[1] || m[2] || m[3]).toLowerCase());
  return hosts;
}
