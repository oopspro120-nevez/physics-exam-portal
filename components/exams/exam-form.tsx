'use client';
import { useEffect, useState } from 'react';
import { ManagedForm } from '@/components/mutations';
import type { Class, Exam } from '@/types/domain';
// datetime-local được hiểu theo múi giờ trình duyệt; API chuyển ISO UTC. Thông báo này giúp giáo viên chọn đúng lịch.
function DateField({ name, iso }: { name: string; iso?: string }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (iso) {
      const d = new Date(iso);
      setValue(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [iso]);
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
  return (
    <ManagedForm
      action="exam_save"
      payload={exam ? { id: exam.id } : {}}
      label={exam ? 'Lưu cấu hình' : 'Tạo kỳ thi và tiếp tục'}
      navigatePrefix={exam ? undefined : '/teacher/exams/'}
    >
      <div className="form-grid">
        <label className="span2">
          Tên kỳ thi
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={exam?.title}
            placeholder="Ví dụ: Đề bồi dưỡng HSG số 01"
          />
        </label>
        <label className="span2">
          Mô tả / hướng dẫn
          <textarea
            name="description"
            defaultValue={exam?.description}
            placeholder="Hướng dẫn làm bài, quy ước đơn vị..."
          />
        </label>
        <label>
          Lớp
          <select name="class_id" required defaultValue={exam?.class_id || classId || ''}>
            <option value="">Chọn lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Thời lượng (phút)
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
          Mở đề
          <DateField name="start_time" iso={exam?.start_time} />
        </label>
        <label>
          Hạn cuối
          <DateField name="end_time" iso={exam?.end_time} />
        </label>
        <label>
          Chế độ chấm
          <select name="scoring_mode" defaultValue={exam?.scoring_mode || 'PRACTICE'}>
            <option value="PRACTICE">PRACTICE · Luyện tập</option>
            <option value="CHALLENGE">CHALLENGE · Thử thách</option>
            <option value="EXAM">EXAM · Một lần nộp/bài</option>
          </select>
        </label>
        <label>
          Hệ số CHALLENGE
          <input
            name="attempt_weights"
            required
            defaultValue={exam?.attempt_weights.join(',') || '1,0.8,0.6'}
          />
          <span className="muted small">Các lượt tiếp theo dùng hệ số cuối. 1 = 100%.</span>
        </label>
        <label className="check span2">
          <input
            name="allow_late_submission"
            type="checkbox"
            defaultChecked={exam?.allow_late_submission}
          />
          Cho phép nộp muộn (đánh dấu riêng bài nộp muộn)
        </label>
        <p className="small muted span2" style={{ margin: 0 }}>
          Thời gian nhập theo múi giờ trình duyệt. Danh sách kỳ thi hiển thị giờ Việt Nam (UTC+7).
          Điểm chỉ hiển thị khi giáo viên công bố.
        </p>
      </div>
    </ManagedForm>
  );
}
