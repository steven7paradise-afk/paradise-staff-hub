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


export async function uploadPrivateDocument(userId: string, file: File) {
  const client = storageClient();
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "staff-documents";
  const path = `${userId}/${Date.now()}-${safeName(file.name)}`;
  const bytes = await file.arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
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
