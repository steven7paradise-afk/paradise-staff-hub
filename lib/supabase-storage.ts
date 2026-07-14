import { createClient } from "@supabase/supabase-js";

function storageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Storage non configurato. Inserisci SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Netlify.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export async function uploadProfileImage(userId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";
  const extension = safeName(file.name).split(".").pop() ?? "jpg";
  const path = `${userId}/profile-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadCoverImage(userId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";
  const extension = safeName(file.name).split(".").pop() ?? "jpg";
  const path = `${userId}/cover-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadSocialCover(userId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";
  const extension = safeName(file.name).split(".").pop() ?? "jpg";
  const path = `${userId}/social-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadOrderImage(userId: string, orderId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";
  const extension = safeName(file.name).split(".").pop() ?? "jpg";
  const path = `${userId}/orders/${safeName(orderId)}-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadCashReceipt(userId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const path = `${userId}/cash-receipts/${Date.now()}-${safeName(file.name)}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}



export async function uploadPrivateDocument(userId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const path = `${userId}/${Date.now()}-${safeName(file.name)}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadPrivateDocumentBytes(userId: string, bytes: ArrayBuffer | Buffer, filename: string, contentType: string) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const path = `${userId}/${Date.now()}-${safeName(filename)}`;
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedDocumentUrl(path: string) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function uploadInvoicePdf(userId: string, filename: string, buffer: ArrayBuffer) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const path = `invoices/${userId}-${Date.now()}-${safeName(filename)}`;
  const { error } = await client.storage.from(bucket).upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
  
  // Generate a signed URL valid for 5 years (157680000 seconds)
  const { data, error: signError } = await client.storage.from(bucket).createSignedUrl(path, 157680000);
  if (signError) throw new Error(signError.message);
  return data.signedUrl;
}

export async function deletePrivateDocument(path: string) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
  return true;
}
