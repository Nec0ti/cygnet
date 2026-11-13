import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';

export function existingMedia(filename, mediaDir) {
  if(typeof filename!=='string' || basename(filename)!==filename || !/^[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp|gif)$/i.test(filename) || !existsSync(join(mediaDir,filename))) {
    const error=new Error('Generated media file not found');
    error.status=400;
    throw error;
  }
  return filename;
}
