import { basename } from "node:path";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRoles } from "@/lib/auth";
import { getBackupSnapshotContent } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const { fileName } = await params;
  const safeFileName = basename(fileName);

  try {
    const backupSnapshot = await getBackupSnapshotContent(safeFileName);

    if (!backupSnapshot) {
      return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
    }

    return new NextResponse(backupSnapshot.content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
  }
}
