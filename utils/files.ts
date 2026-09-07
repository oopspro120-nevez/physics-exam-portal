export const MAX_SOLUTION_FILES = 6;
export function validateFile(file: Pick<File, 'name' | 'size' | 'type'>, bucket: string) {
  const max = bucket === 'exams' ? 25 : 15;
  if (file.size <= 0 || file.size > max * 1024 * 1024)
    throw new Error(`Tệp phải nhỏ hơn hoặc bằng ${max} MB.`);
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mime: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  if (!ext || !mime[ext] || mime[ext] !== file.type || (bucket === 'exams' && ext !== 'pdf'))
    throw new Error('Chỉ nhận PDF, JPG, JPEG hoặc PNG hợp lệ.');
  return ext;
}
export function sniffMime(bytes: Uint8Array) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-')
    return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  return null;
}
