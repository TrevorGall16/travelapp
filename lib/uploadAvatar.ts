// lib/uploadAvatar.ts — Supabase Storage avatar upload helpers.

import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from './supabase';

/**
 * Reads a local file URI as base64, decodes it, and uploads it to the
 * Supabase `avatars` storage bucket. Returns the public URL.
 *
 * React Native's fetch() cannot read file:// URIs on all platforms.
 * We use expo-file-system to read the file as base64, then decode it with
 * base64-arraybuffer before uploading the raw bytes to Supabase Storage.
 * The string literal 'base64' is used rather than FileSystem.EncodingType.Base64
 * because the enum is undefined if expo-file-system is not fully linked.
 */
export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64',
  });
  const arrayBuffer = decode(base64);
  const path = `${userId}.jpg`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Compress a local image URI and upload it to the `avatars` bucket
 * under `photos/{userId}/{slot}.jpg`. Returns the public URL.
 *
 * Compresses to max 1080px wide, 0.7 JPEG quality (~200-400 KB).
 */
export async function uploadProfilePhoto(
  localUri: string,
  userId: string,
  slot: number,
): Promise<string> {
  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );

  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: 'base64',
  });
  const arrayBuffer = decode(base64);
  const path = `photos/${userId}/${slot}.jpg`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Bust CDN cache with a timestamp query param
  return `${data.publicUrl}?t=${Date.now()}`;
}
