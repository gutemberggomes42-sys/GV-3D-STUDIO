import { UserRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import type { DbUser, PrintFlowDb } from "@/lib/db-types";
import { createId } from "@/lib/store";

const generatedCustomerEmailDomain = "@gv3dstudio.local";

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhoneDigits(value?: string) {
  return value?.replace(/\D+/g, "") ?? "";
}

function buildGeneratedCustomerEmailBase(phoneDigits: string) {
  const suffix = phoneDigits || createId("cli").replace(/^cli_/, "");
  return `cliente-${suffix}${generatedCustomerEmailDomain}`;
}

function buildUniqueCustomerEmail(db: PrintFlowDb, preferredEmail: string, phoneDigits: string) {
  const existingEmails = new Set(db.users.map((user) => user.email.toLowerCase()));
  const baseEmail = preferredEmail || buildGeneratedCustomerEmailBase(phoneDigits);

  if (!existingEmails.has(baseEmail.toLowerCase())) {
    return baseEmail.toLowerCase();
  }

  const [localPart, domainPart = generatedCustomerEmailDomain.replace(/^@/, "")] = baseEmail.split("@");
  let attempt = 2;

  while (existingEmails.has(`${localPart}-${attempt}@${domainPart}`.toLowerCase())) {
    attempt += 1;
  }

  return `${localPart}-${attempt}@${domainPart}`.toLowerCase();
}

export function isGeneratedCustomerEmail(email?: string) {
  return Boolean(email?.toLowerCase().endsWith(generatedCustomerEmailDomain));
}

export async function ensureCustomerRecord(
  db: PrintFlowDb,
  {
    name,
    phone,
    email,
    projectType = "Pedido via vitrine",
  }: {
    name: string;
    phone: string;
    email?: string;
    projectType?: string;
  },
): Promise<DbUser> {
  const normalizedName = name.trim();
  const normalizedPhone = phone.trim();
  const normalizedPhoneDigits = normalizePhoneDigits(phone);
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();

  const existing = db.users.find((user) => {
    if (user.role !== UserRole.CLIENT) {
      return false;
    }

    const sameEmail =
      normalizedEmail && user.email.toLowerCase() === normalizedEmail;
    const samePhone =
      normalizedPhoneDigits &&
      normalizePhoneDigits(user.phone) === normalizedPhoneDigits;

    return Boolean(sameEmail || samePhone);
  });

  if (existing) {
    existing.name = normalizedName;
    existing.phone = normalizedPhone;
    existing.company = existing.company?.trim() || normalizedName;
    existing.projectType = projectType;

    if (
      normalizedEmail &&
      (isGeneratedCustomerEmail(existing.email) ||
        existing.email.toLowerCase() === normalizedEmail)
    ) {
      existing.email = normalizedEmail;
    }

    existing.updatedAt = now;
    return existing;
  }

  const emailToSave = buildUniqueCustomerEmail(
    db,
    normalizedEmail,
    normalizedPhoneDigits,
  );
  const passwordHash = await hashPassword(createId("pwd"));

  const customer: DbUser = {
    id: createId("usr"),
    name: normalizedName,
    email: emailToSave,
    passwordHash,
    role: UserRole.CLIENT,
    phone: normalizedPhone,
    company: normalizedName,
    address: "",
    projectType,
    avatarColor: "#59b9ff",
    createdAt: now,
    updatedAt: now,
  };

  db.users.push(customer);
  return customer;
}
