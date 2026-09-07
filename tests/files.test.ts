import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffMime, validateFile, fileMime } from '../utils/files';
test('File signatures and file limits', () => {
  assert.equal(sniffMime(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(sniffMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(sniffMime(new TextEncoder().encode('<script>')), null);
  assert.throws(() =>
    validateFile({ name: 'x.pdf', size: 26 * 1024 * 1024, type: 'application/pdf' }, 'exams'),
  );
  assert.throws(() => validateFile({ name: 'x.html', size: 10, type: 'application/pdf' }, 'exams'));
  assert.throws(() => validateFile({ name: 'x.pdf', size: 10, type: 'text/html' }, 'exams'));
  assert.equal(
    validateFile({ name: 'x.JPEG', size: 10, type: 'image/jpeg' }, 'submissions'),
    'jpeg',
  );
});

test('Valid PDF with missing browser MIME is accepted, incompatible declared MIME is rejected', () => {
  assert.equal(fileMime({ name: 'Đề thi.PDF', type: '' }), 'application/pdf');
  assert.equal(validateFile({ name: 'Đề thi.PDF', type: '', size: 100 }, 'exams'), 'pdf');
  assert.equal(
    validateFile({ name: 'Đề.pdf', type: 'application/octet-stream', size: 100 }, 'exams'),
    'pdf',
  );
  assert.throws(() => validateFile({ name: 'Đề.pdf', type: 'image/png', size: 100 }, 'exams'));
});
