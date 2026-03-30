import type { PrintFlowDb } from "@/lib/db-types";

export function createInitialData(): PrintFlowDb {
  return {
    users: [],
    sessions: [],
    materials: [],
    machines: [],
    expenses: [],
    payables: [],
    orders: [],
    showcaseItems: [],
    showcaseInquiries: [],
    auditLogs: [],
  };
}
