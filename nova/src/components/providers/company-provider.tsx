"use client";

import { createContext, useContext } from "react";
import type { CompanyContext } from "@/lib/company.server";
import { COMPANY } from "@/lib/company";

const CompanyCtx = createContext<CompanyContext>(COMPANY);

export function CompanyProvider({
  company,
  children,
}: {
  company: CompanyContext;
  children: React.ReactNode;
}) {
  return <CompanyCtx.Provider value={company}>{children}</CompanyCtx.Provider>;
}

export function useCompany(): CompanyContext {
  return useContext(CompanyCtx);
}
