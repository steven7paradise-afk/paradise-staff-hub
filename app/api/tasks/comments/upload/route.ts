import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadTaskImageToGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function safeFilePart(value: string) {
  return String(value || "file")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+|-+$/g, "") || "file";
}

function taskFileName(name: string, taskId: string) {
  const cleanName = safeFilePart(name).slice(-100);
  return `${new Date().toISOString().slice(0, 10)}-${safeFilePart(taskId).slice(0, 36)}-${cleanName}`;
}

type MultipartUpload = {
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

async function readMultipartUpload(request: NextRequest): Promise<MultipartUpload> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    throw new Error("OLD_PAGE");
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_FILE_BYTES + 2 * 1024 * 1024) throw new Error("TOO_LARGE");

  try {
    const nativeFormData = await request.formData();
    if (nativeFormData) {
      const taskId = String(nativeFormData.get("taskId") ?? "").trim();
      const preferredFile = nativeFormData.get("file");
      const candidate =
        preferredFile && typeof preferredFile !== "string"
          ? preferredFile
          : Array.from(nativeFormData.values()).find((value) => typeof value !== "string" && typeof (value as any).arrayBuffer === "function");
      if (taskId && candidate && typeof candidate !== "string") {
        const buffer = Buffer.from(await (candidate as unknown as File).arrayBuffer());
        if (buffer.length <= 0) throw new Error("EMPTY_FILE");
        if (buffer.length > MAX_FILE_BYTES) throw new Error("TOO_LARGE");
        return {
          taskId,
          fileName: (candidate as unknown as File).name || "file",
          mimeType: (candidate as unknown as File).type || "application/octet-stream",
          buffer,
        };
      }
    }
  } catch (err: any) {
    if (err.message === "TOO_LARGE" || err.message === "EMPTY_FILE" || err.message === "OLD_PAGE") {
      throw err;
    }
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]?.trim();
  if (!boundary) throw new Error("NO_BOUNDARY");

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_FILE_BYTES + 2 * 1024 * 1024) throw new Error("TOO_LARGE");

  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;
  let taskId = "";
  let fileName = "";
  let mimeType = "application/octet-stream";
  let fileBuffer: Buffer | null = null;

  while (cursor < body.length) {
    const boundaryIndex = body.indexOf(delimiter, cursor);
    if (boundaryIndex < 0) break;
    let partStart = boundaryIndex + delimiter.length;
    if (body.subarray(partStart, partStart + 2).toString() === "--") break;
    if (body.subarray(partStart, partStart + 2).toString() === "\r\n") partStart += 2;

    const headersEnd = body.indexOf(Buffer.from("\r\n\r\n"), partStart);
    if (headersEnd < 0) break;
    const nextBoundary = body.indexOf(delimiter, headersEnd + 4);
    if (nextBoundary < 0) break;
    let payloadEnd = nextBoundary;
    if (body.subarray(payloadEnd - 2, payloadEnd).toString() === "\r\n") payloadEnd -= 2;

    const headers = body.subarray(partStart, headersEnd).toString("utf8");
    const fieldName = headers.match(/name="([^"]+)"/i)?.[1] || "";
    const regularFileName = headers.match(/filename="([^"]*)"/i)?.[1] || "";
    const encodedFileName = headers.match(/filename\*=UTF-8''([^;\r\n]+)/i)?.[1] || "";
    const payload = body.subarray(headersEnd + 4, payloadEnd);

    if (fieldName === "taskId") taskId = payload.toString("utf8").trim();
    if (fieldName === "file" || regularFileName || encodedFileName) {
      fileName = encodedFileName ? decodeURIComponent(encodedFileName) : regularFileName;
      mimeType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || mimeType;
      fileBuffer = Buffer.from(payload);
    }
    cursor = nextBoundary;
  }

  if (!taskId) throw new Error("NO_TASK");
  if (!fileName || !fileBuffer) throw new Error("NO_FILE");
  if (fileBuffer.length <= 0) throw new Error("EMPTY_FILE");
  if (fileBuffer.length > MAX_FILE_BYTES) throw new Error("TOO_LARGE");
  return { taskId, fileName, mimeType, buffer: fileBuffer };
}

function driveErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error || "");
  if (/credentials|private key|service account/i.test(detail)) {
    return "Google Drive non configurato sul server. Controlla le credenziali Drive in Coolify.";
  }
  if (/permission|forbidden|insufficient|not found|404|403/i.test(detail)) {
    return "Google Drive non permette di usare la cartella Task. Condividila con la service account configurata.";
  }
  return detail ? `Google Drive ha rifiutato il file: ${detail}` : "Caricamento su Google Drive non riuscito.";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const upload = await readMultipartUpload(request).catch((error) => {
    const code = error instanceof Error ? error.message : "";
    if (code === "OLD_PAGE") return { error: "La pagina aperta usa ancora la versione precedente. Premi Cmd+Maiusc+R e riprova.", status: 409 } as const;
    if (code === "TOO_LARGE") return { error: "Il file supera il limite di 50 MB.", status: 413 } as const;
    if (code === "NO_TASK") return { error: "Task non riconosciuta. Chiudi e riapri la task, poi riprova.", status: 400 } as const;
    if (code === "NO_FILE") return { error: "Il file non è arrivato al server. Selezionalo nuovamente e riprova.", status: 400 } as const;
    if (code === "EMPTY_FILE") return { error: "Il file selezionato è vuoto.", status: 400 } as const;
    return { error: "Formato del caricamento non riconosciuto. Aggiorna la pagina e riprova.", status: 400 } as const;
  });
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: upload.status });
  const { taskId, fileName, mimeType, buffer } = upload;

  const task = await prisma.staffTask.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const isAssignee = task.assignees.some((assignee) => assignee.id === session.user.id);
  const canUpload = managerRoles.has(session.user.role) || isAssignee || task.created_by_id === session.user.id;
  if (!canUpload || (session.user.role === "RESPONSABILE" && session.user.sedeId !== task.location_id)) {
    return NextResponse.json({ error: "Non puoi allegare file a questa task." }, { status: 403 });
  }

  try {
    const driveFile = await uploadTaskImageToGoogleDrive(
      buffer,
      taskFileName(fileName, taskId),
      mimeType
    );
    const isImage = mimeType.startsWith("image/");
    const driveFileUrl = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;
    return NextResponse.json({
      name: driveFile.name || fileName,
      url: isImage ? driveFile.previewUrl : driveFileUrl,
      previewUrl: isImage ? driveFile.previewUrl : null,
      driveFileId: driveFile.id,
      driveFileUrl,
      webContentLink: driveFile.webContentLink,
      type: mimeType,
    });
  } catch (error) {
    console.error("Task attachment Google Drive upload failed:", error);
    return NextResponse.json({ error: driveErrorMessage(error) }, { status: 503 });
  }
}
