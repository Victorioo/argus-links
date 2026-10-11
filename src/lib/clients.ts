import { prisma } from "@/lib/prisma";

// Distinct client names already in use, so the forms can suggest them instead
// of people inventing "Acme", "acme" and "ACME S.A." for the same account.
export async function listKnownClients(): Promise<string[]> {
  const rows = await prisma.report.findMany({
    where: { client: { not: null } },
    select: { client: true },
    distinct: ["client"],
    orderBy: { client: "asc" },
  });
  return rows.map((r) => r.client).filter((c): c is string => !!c);
}

// Clients are free text. If the name already exists with other capitalization
// ("argus" vs "Argus"), reuse the stored form so the list doesn't split it.
export async function canonicalClient(input: string | undefined | null): Promise<string | null> {
  const name = input?.trim();
  if (!name) return null;
  const existing = await prisma.report.findFirst({
    where: { client: { equals: name, mode: "insensitive" } },
    select: { client: true },
    orderBy: { createdAt: "asc" },
  });
  return existing?.client?.trim() || name;
}
