import { supabase } from './supabaseClient';

const PRIVATE_BUCKETS = ['prescriptions'];

/**
 * Uploads a file to a Supabase Storage bucket and returns a usable URL.
 * Public buckets (medicine-images, avatars) return a permanent public URL.
 * Private buckets (prescriptions) return a long-lived signed URL.
 */
export async function uploadFile(bucket, file, folder = '') {
  const ext = file.name.split('.').pop();
  const safeName = `${crypto.randomUUID()}.${ext}`;
  const path = folder ? `${folder}/${safeName}` : safeName;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;

  if (PRIVATE_BUCKETS.includes(bucket)) {
    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    if (signError) throw signError;
    return { path, url: data.signedUrl };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function removeFile(bucket, path) {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}
