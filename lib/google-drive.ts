import { google } from "googleapis";
import { Readable } from "stream";

function getPrivateKey() {
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

async function getOrCreateDateFolder(drive: any, parentFolderId: string, dateStr: string): Promise<string> {
  // Search for folder with name = dateStr under parentFolderId
  const response = await drive.files.list({
    q: `name = '${dateStr}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
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
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
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
