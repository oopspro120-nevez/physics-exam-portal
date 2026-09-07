'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import { mutate } from '@/components/mutations';
import { uploadFile, type UploadProgress } from '@/lib/upload';
import { UploadStatus } from '@/components/file-upload';
import { validateFile } from '@/utils/files';
import type { Class, Exam } from '@/types/domain';
function vietnamInput(iso: string) {
  return new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
}
function DateField({ name, iso, offset = 0 }: { name: string; iso?: string; offset?: number }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(vietnamInput(iso || new Date(Date.now() + offset).toISOString()));
  }, [iso, offset]);
  return (
    <input
      name={name}
      type="datetime-local"
      required
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
export function ExamForm({
  classes,
  exam,
  classId,
}: {
  classes: Class[];
  exam?: Exam;
  classId?: string;
}) {
  const router = useRouter();
  const requestId = useRef('');
  const savedId = useRef(exam?.id || '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [mode, setMode] = useState(exam?.scoring_mode || 'PRACTICE');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const draftOnly =
          (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'draft';
        setBusy(true);
        setError('');
        setMessage('');
        try {
          for (const key of ['start_time', 'end_time'])
            values[key] = new Date(String(values[key]) + '+07:00').toISOString();
          if (Date.parse(String(values.end_time)) <= Date.parse(String(values.start_time)))
            throw new Error('Hạn cuối phải sau giờ mở đề.');
          if (file && !draftOnly) validateFile(file, 'exams');
          requestId.current ||= crypto.randomUUID();
          const d = await mutate('exam_save', {
            ...values,
            request_id: requestId.current,
            ...(savedId.current ? { id: savedId.current } : {}),
          });
          savedId.current = d.id;
          if (file && !draftOnly) await uploadFile(file, 'exams', d.id, undefined, setProgress);
          form.dispatchEvent(new Event('portal-form-saved', { bubbles: true }));
          if (!exam) router.push('/teacher/exams/' + d.id);
          else {
            setMessage('Đã lưu thông tin kỳ thi.');
            router.refresh();
          }
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'Chưa thể lưu. Nội dung đang nhập vẫn được giữ.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="form-fieldset">
        <div className="form-grid">
          <label className="span2">
            Tên kỳ thi
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={exam?.title}
              placeholder="Ví dụ: Bồi dưỡng HSG Vật lý · Đề số 01"
            />
          </label>
          <label>
            Lớp nhận đề
            <select
              name="class_id"
              required
              defaultValue={
                exam?.class_id || classId || (classes.length === 1 ? classes[0].id : '')
              }
            >
              <option value="">Chọn lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thời lượng làm bài (phút)
            <input
              name="duration"
              type="number"
              required
              min={1}
              max={1440}
              defaultValue={exam?.duration || 90}
            />
          </label>
          <label>
            Mở đề · giờ Việt Nam
            <DateField name="start_time" iso={exam?.start_time} />
          </label>
          <label>
            Hạn cuối · giờ Việt Nam
            <DateField name="end_time" iso={exam?.end_time} offset={24 * 3600000} />
          </label>
          <label className="span2">
            Hình thức làm bài
            <select
              name="scoring_mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Exam['scoring_mode'])}
            >
              <option value="PRACTICE">Luyện tập · Có thể nộp lại theo số lượt được đặt</option>
              <option value="CHALLENGE">Thử thách · Điểm giảm theo lượt nộp</option>
              <option value="EXAM">Kiểm tra · Mỗi câu chỉ nộp một lần</option>
            </select>
          </label>
          {mode === 'CHALLENGE' ? (
            <label className="span2">
              Hệ số điểm các lượt nộp
              <input
                name="attempt_weights"
                required
                defaultValue={exam?.attempt_weights.join(',') || '1,0.8,0.6'}
              />
              <span className="small muted">
                1 = 100%, 0.8 = 80%. Các lượt sau dùng hệ số cuối.
              </span>
            </label>
          ) : (
            <input
              type="hidden"
              name="attempt_weights"
              value={exam?.attempt_weights.join(',') || '1,0.8,0.6'}
            />
          )}
          <label className="span2">
            Hướng dẫn cho học sinh
            <textarea
              name="description"
              maxLength={8000}
              defaultValue={exam?.description}
              placeholder="Quy ước đơn vị, cách trình bày và yêu cầu nộp lời giải…"
            />
          </label>
          <label className="check span2">
            <input
              name="allow_late_submission"
              type="checkbox"
              defaultChecked={exam?.allow_late_submission}
            />
            Cho phép nộp muộn và đánh dấu bài nộp muộn
          </label>
        </div>
        {!exam && (
          <div className="section-gap">
            <label
              className="file-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (busy) return;
                const selected = e.dataTransfer.files[0];
                if (selected) {
                  try {
                    validateFile(selected, 'exams');
                    setFile(selected);
                    setError('');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              }}
            >
              <FileText size={28} style={{ margin: 'auto' }} />
              {file ? file.name : 'Chọn hoặc kéo PDF đề thi vào đây'}
              <span className="small muted">
                Một tệp cho toàn bộ đề · tối đa 25 MB · có thể bổ sung sau
              </span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  e.target.value = '';
                  if (selected) {
                    try {
                      validateFile(selected, 'exams');
                      setFile(selected);
                      setError('');
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }
                }}
              />
            </label>
            {file && (
              <button className="text-link compact" type="button" onClick={() => setFile(null)}>
                Bỏ tệp đã chọn
              </button>
            )}
          </div>
        )}
      </fieldset>
      {busy && progress && <UploadStatus progress={progress} />}
      {error && (
        <div className="notice danger" role="alert">
          {error}
          {!exam && savedId.current && (
            <p>
              Thông tin kỳ thi đã được lưu. Bấm tiếp tục để thử lại, hoặc{' '}
              <Link className="text-link" href={'/teacher/exams/' + savedId.current}>
                mở bản nháp
              </Link>
              .
            </p>
          )}
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={busy}>
          {busy && <Loader2 size={16} className="spin" />}
          {exam ? 'Lưu thông tin' : 'Lưu và tiếp tục đến câu hỏi'}
        </button>
        {!exam && (
          <button type="submit" value="draft" className="button" disabled={busy}>
            Lưu nháp
          </button>
        )}
      </div>
      {!exam && (
        <p className="small muted">
          Kỳ thi được lưu ở trạng thái nháp. Học sinh chỉ thấy đề sau khi cô/thầy chọn Giao đề ở
          bước cuối.
        </p>
      )}
    </form>
  );
}
