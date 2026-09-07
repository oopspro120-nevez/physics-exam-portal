// Công cụ backup NGOÀI ứng dụng website. Không đưa thư mục backup lên hosting hoặc Git.
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Cần cấu hình .env.local.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const folder = resolve('backups', 'storage-' + new Date().toISOString().replaceAll(':', '-'));
let count = 0;
async function visit(bucket, prefix = '') {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data?.length) break;
    for (const file of data) {
      const path = prefix ? prefix + '/' + file.name : file.name;
      if (!file.id) {
        await visit(bucket, path);
        continue;
      }
      const target = resolve(folder, bucket, path);
      if (!target.startsWith(folder + sep)) throw new Error('Đường dẫn không an toàn.');
      const { data: blob, error: downloadError } = await db.storage.from(bucket).download(path);
      if (downloadError) throw downloadError;
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
      count++;
    }
    if (data.length < 100) break;
  }
}
await mkdir(folder, { recursive: true });
for (const bucket of ['exams', 'submissions', 'solutions']) await visit(bucket);
console.log(`Đã sao lưu ${count} tệp vào ${folder}. Cần sao lưu database riêng.`);
