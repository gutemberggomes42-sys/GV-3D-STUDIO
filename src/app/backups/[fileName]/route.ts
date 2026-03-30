import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRoles } from "@/lib/auth";
import { getBackupFilePath } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const { fileName } = await params;
  const safeFileName = basename(fileName);

  try {
    const filePath = getBackupFilePath(safeFileName);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
  }
}
