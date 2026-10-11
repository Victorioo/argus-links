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
