import { google } from "googleapis";
import { Readable } from "stream";

export function getPrivateKey() {
  let key: string | undefined;
  let source = "";

  if (process.env.DRIVE_PRIVATE_KEY_BASE64) {
    key = Buffer.from(process.env.DRIVE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
    source = "DRIVE_PRIVATE_KEY_BASE64";
  } else if (process.env.DRIVE_PRIVATE_KEY) {
    key = process.env.DRIVE_PRIVATE_KEY;
    source = "DRIVE_PRIVATE_KEY";
  } else if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    key = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
    source = "GOOGLE_PRIVATE_KEY_BASE64";
  } else {
    key = process.env.GOOGLE_PRIVATE_KEY;
    source = "GOOGLE_PRIVATE_KEY";
  }

  if (key) {
    // Standardize newlines: strip all carriage returns, then replace literal \n if any exist
    key = key.replace(/\r/g, "").replace(/\\n/g, "\n");
  }

  console.log(`[Google Drive Auth] Loaded private key from source: ${source}. Key exists: ${!!key}. Length: ${key?.length || 0}. Prefix: ${key ? key.substring(0, 28) : "none"}`);
  return key;
}

async function getOrCreateDateFolder(drive: any, parentFolderId: string, dateStr: string): Promise<string> {
  // Search for folder with name = dateStr under parentFolderId
  const response = await drive.files.list({
    q: `name = '${dateStr}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files;
  if (files && files.length > 0) {
    return files[0].id!;
  }

  // If not found, create it
  const folderMetadata = {
    name: dateStr,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });

  const folderId = folder.data.id!;

  // Make the date folder readable by anyone with the link
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("Failed to set read permissions on date folder:", err);
  }

  return folderId;
}

export async function uploadFileToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "1LbwCUQSwbaWZ3BH9gnn8dm1dmhQbluvC";
  const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });

  // 1. Get current date string (DD-MM-YYYY)
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  // 2. Get or create daily subfolder
  const dateFolderId = await getOrCreateDateFolder(drive, rootFolderId, dateStr);

  // 3. Convert buffer to readable stream for uploading
  const bufferStream = new Readable();
  bufferStream.push(buffer);
  bufferStream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [dateFolderId],
  };

  const media = {
    mimeType: mimeType,
    body: bufferStream,
  };

  // 4. Create file on Google Drive
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: "id, name, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  // 5. Make the file readable by anyone with the link (so we can display it on the admin dashboard)
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("Failed to set public read permissions on Google Drive file:", err);
  }

  return {
    id: fileId,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
  };
}

async function getOrCreateSubfolder(drive: any, parentFolderId: string, folderName: string): Promise<string> {
  // Search for folder with name under parentFolderId
  const response = await drive.files.list({
    q: `name = '${folderName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files;
  if (files && files.length > 0) {
    return files[0].id!;
  }

  // If not found, create it
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });

  const folderId = folder.data.id!;

  // Make the folder readable by anyone with the link
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error(`Failed to set read permissions on folder ${folderName}:`, err);
  }

  return folderId;
}

async function findSubfolder(drive: any, parentFolderId: string, folderName: string): Promise<string | null> {
  const response = await drive.files.list({
    q: `name = '${folderName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0]?.id ?? null;
}

function getDriveClient() {
  const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

function cleanDriveName(value: string) {
  return (value || "Collaboratore")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ");
}

function directDriveImageUrl(fileId: string) {
  return `/api/drive-image?id=${encodeURIComponent(fileId)}`;
}

export async function uploadOrderPhotoToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  clientName: string,
  orderNumber: string
) {
  const rootFolderId =
    process.env.GOOGLE_DRIVE_ORDER_PHOTOS_FOLDER_ID ||
    "0ABwI50LPNFjKUk9PVA";
  const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });

  // 1. Get current date string (DD-MM-YYYY)
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  // 2. Get or create daily subfolder
  const dateFolderId = await getOrCreateSubfolder(drive, rootFolderId, dateStr);

  // 3. Get or create order/client subfolder
  const cleanClientName = (clientName || "CLIENTE").trim().replace(/[\s\t\n\/\\]+/g, " ");
  const cleanOrderNumber = (orderNumber || "SENZA-ORDINE").trim().replace(/#/g, "").trim();
  const folderName = `${cleanClientName} - #${cleanOrderNumber}`;
  const orderFolderId = await getOrCreateSubfolder(drive, dateFolderId, folderName);

  // 4. Convert buffer to readable stream
  const bufferStream = new Readable();
  bufferStream.push(buffer);
  bufferStream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [orderFolderId],
  };

  const media = {
    mimeType: mimeType,
    body: bufferStream,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: "id, name, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  // 5. Make the file readable by anyone with the link
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("Failed to set public read permissions on Google Drive file:", err);
  }

  return {
    id: fileId,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
  };
}

export async function uploadFotoOrdineToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  orderNumber: string
) {
  const rootFolderId =
    process.env.GOOGLE_DRIVE_ORDER_PHOTOS_FOLDER_ID ||
    "0ABwI50LPNFjKUk9PVA";
  const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const dateFolderId = await getOrCreateSubfolder(drive, rootFolderId, `${day}-${month}-${year}`);
  const cleanOrderNumber = (orderNumber || "SENZA-ORDINE").replace(/^#/, "").trim();
  const orderFolderId = await getOrCreateSubfolder(drive, dateFolderId, cleanOrderNumber);

  const bufferStream = new Readable();
  bufferStream.push(buffer);
  bufferStream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [orderFolderId],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: "id, name, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("Failed to set public read permissions on Google Drive file:", err);
  }

  return {
    id: fileId,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
  };
}

export async function uploadEmployeeDocumentToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  employeeName: string
) {
  const rootFolderId = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID || "0ABkOsn4uZjSQUk9PVA";
  const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });
  const cleanEmployeeName = (employeeName || "Collaboratore")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ");
  const employeeFolderId = await getOrCreateSubfolder(drive, rootFolderId, cleanEmployeeName);

  const bufferStream = new Readable();
  bufferStream.push(buffer);
  bufferStream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [employeeFolderId],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: "id, name, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("Failed to set public read permissions on Google Drive employee document:", err);
  }

  return {
    id: fileId,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
    folderId: employeeFolderId,
  };
}

export async function uploadStaffPhotoToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  employeeName: string
) {
  const rootFolderId =
    process.env.GOOGLE_DRIVE_STAFF_PHOTOS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID ||
    "0ABkOsn4uZjSQUk9PVA";
  const drive = getDriveClient();
  const employeeFolderId = await getOrCreateSubfolder(drive, rootFolderId, cleanDriveName(employeeName));

  const bufferStream = new Readable();
  bufferStream.push(buffer);
  bufferStream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [employeeFolderId],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: "id, name, webViewLink, webContentLink, mimeType",
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error("Failed to set public read permissions on Google Drive staff photo:", err);
  }

  return {
    id: fileId,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
    photoUrl: directDriveImageUrl(fileId),
    folderId: employeeFolderId,
  };
}

export async function findStaffPhotoInGoogleDrive(employeeName: string) {
  const rootFolderId =
    process.env.GOOGLE_DRIVE_STAFF_PHOTOS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID ||
    "0ABkOsn4uZjSQUk9PVA";
  const drive = getDriveClient();
  const cleanEmployeeName = cleanDriveName(employeeName);
  const employeeFolderId = await findSubfolder(drive, rootFolderId, cleanEmployeeName);

  const queries = employeeFolderId
    ? [`'${employeeFolderId}' in parents and mimeType contains 'image/' and trashed = false`]
    : [`'${rootFolderId}' in parents and name contains '${cleanEmployeeName.replace(/'/g, "\\'")}' and mimeType contains 'image/' and trashed = false`];

  for (const q of queries) {
    const response = await drive.files.list({
      q,
      fields: "files(id, name, webViewLink, webContentLink, mimeType, modifiedTime)",
      spaces: "drive",
      orderBy: "modifiedTime desc",
      pageSize: 10,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = response.data.files ?? [];
    const file =
      files.find((item) => !String(item.mimeType || "").toLowerCase().includes("heic") && !String(item.name || "").toLowerCase().endsWith(".heic")) ??
      files[0];
    if (file?.id) {
      try {
        await drive.permissions.create({
          fileId: file.id,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
          supportsAllDrives: true,
        });
      } catch {
        // The file may already be public or the shared drive may prevent permission changes.
      }

      return {
        id: file.id,
        name: file.name,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        photoUrl: directDriveImageUrl(file.id),
      };
    }
  }

  return null;
}

export function getGoogleDriveFileId(url: string | null | undefined) {
  if (!url) return "";
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) return idMatch[1];
  return "";
}

export async function downloadGoogleDriveFile(fileId: string) {
  const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Google credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });
  const [meta, file] = await Promise.all([
    drive.files.get({
      fileId,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    }),
    drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" }
    ),
  ]);

  return {
    buffer: Buffer.from(file.data as ArrayBuffer),
    name: meta.data.name || "documento.pdf",
    mimeType: meta.data.mimeType || "application/octet-stream",
  };
}
