import { supabase } from '@/utils/supabase/client';

export const DIRECT_PHOTO_BUCKET = 'direct-message-photos';
export type DirectPhotoDraft = { file: File; preview: string; uploadId: string; mime: string; extension: string; storagePath?: string };

export async function prepareDirectPhoto(file: File): Promise<DirectPhotoDraft> {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Fotoğraf en fazla 10 MB olabilir.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  let mime: string, extension: string;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { mime = 'image/jpeg'; extension = 'jpg'; }
  else if ([137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) { mime = 'image/png'; extension = 'png'; }
  else if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') { mime = 'image/webp'; extension = 'webp'; }
  else throw new Error('JPEG, PNG veya WebP biçiminde bir fotoğraf seç.');
  return { file, preview: URL.createObjectURL(file), uploadId: crypto.randomUUID(), mime, extension };
}

export async function sendDirectPhoto(conversationId: string, body: string, photo: DirectPhotoDraft) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Giriş yapmalısın.');
  const path = `${conversationId}/${auth.user.id}/${photo.uploadId}.${photo.extension}`;
  if (photo.storagePath !== path) {
    const { error } = await supabase.storage.from(DIRECT_PHOTO_BUCKET).upload(path, photo.file, { contentType: photo.mime, upsert: false });
    const errorCode = error && 'code' in error ? error.code : undefined;
    if (error && ![error.statusCode, errorCode].some(value => ['409', 'Duplicate', 'ResourceAlreadyExists'].includes(String(value)))) throw new Error('Fotoğraf yüklenemedi. Seçimin korunuyor; yeniden deneyebilirsin.');
    photo.storagePath = path;
  }
  const { data, error } = await supabase.rpc('send_direct_message_with_photo', { p_conversation_id: conversationId, p_body: body, p_storage_path: path });
  if (error) throw new Error(error.message || 'Fotoğraf gönderilemedi.');
  return data as string;
}

export async function removePendingDirectPhoto(photo: DirectPhotoDraft) {
  if (photo.storagePath) await supabase.storage.from(DIRECT_PHOTO_BUCKET).remove([photo.storagePath]).catch(() => undefined);
}
