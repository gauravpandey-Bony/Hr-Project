import "server-only";

import { db } from "@/lib/db";
import { COMPANY as COMPANY_DEFAULTS } from "@/lib/company";

export type CompanyContext = typeof COMPANY_DEFAULTS;

export async function getCompanyContext(
  organizationId?: string | null
): Promise<CompanyContext> {
  if (!organizationId) return COMPANY_DEFAULTS;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) return COMPANY_DEFAULTS;

  return {
    name: org.name,
    shortName: org.brandName ?? org.name.split(" ")[0] ?? COMPANY_DEFAULTS.shortName,
    slug: org.slug,
    tagline: org.tagline ?? COMPANY_DEFAULTS.tagline,
    emailDomain: org.emailDomain ?? COMPANY_DEFAULTS.emailDomain,
    productName: org.productName ?? COMPANY_DEFAULTS.productName,
    brandName: org.brandName ?? COMPANY_DEFAULTS.brandName,
    logoPath: COMPANY_DEFAULTS.logoPath,
    logoMarkPath: COMPANY_DEFAULTS.logoMarkPath,
    logoFullPath: COMPANY_DEFAULTS.logoFullPath,
    aiAssistantName: org.aiAssistantName ?? COMPANY_DEFAULTS.aiAssistantName,
    kraMasterSheetLabel:
      org.kraMasterSheetLabel ?? COMPANY_DEFAULTS.kraMasterSheetLabel,
    plantHeadLabel: COMPANY_DEFAULTS.plantHeadLabel,
    orgChartDoc: COMPANY_DEFAULTS.orgChartDoc,
  };
}

/** First organization in DB — for login/marketing pages before auth. */
export async function getDefaultCompanyContext(): Promise<CompanyContext> {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  return getCompanyContext(org?.id);
}
