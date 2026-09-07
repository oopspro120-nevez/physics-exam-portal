import { ManagedForm } from '@/components/mutations';
import type { Problem, AnswerKey } from '@/types/domain';
export function ProblemForm({
  examId,
  number,
  problem,
  answerKey,
}: {
  examId: string;
  number: number;
  problem?: Problem;
  answerKey?: AnswerKey;
}) {
  return (
    <ManagedForm
      action="problem_save"
      payload={{ exam_id: examId, ...(problem ? { id: problem.id } : {}) }}
      label={problem ? 'Lưu Problem' : 'Thêm Problem'}
    >
      <div className="form-grid">
        <label>
          Số thứ tự
          <input
            name="problem_number"
            type="number"
            min={1}
            required
            defaultValue={problem?.problem_number || number}
          />
        </label>
        <label>
          Tiêu đề (không bắt buộc)
          <input name="title" maxLength={200} defaultValue={problem?.title} />
        </label>
        <label>
          Loại đáp án
          <select name="answer_type" defaultValue={problem?.answer_type || 'numeric'}>
            <option value="numeric">Số (numeric)</option>
            <option value="text">Văn bản ngắn (text)</option>
            <option value="essay">Tự luận (essay)</option>
            <option value="file_only">Chỉ lời giải (file_only)</option>
          </select>
        </label>
        <label>
          Đơn vị
          <input name="unit" defaultValue={problem?.unit} placeholder="m/s²" />
        </label>
        <label>
          Đáp án chuẩn
          <input
            name="correct_answer"
            defaultValue={answerKey?.correct_answer || ''}
            placeholder="Ví dụ: 9.81"
          />
        </label>
        <label>
          Loại dung sai
          <select name="tolerance_type" defaultValue={answerKey?.tolerance_type || 'absolute'}>
            <option value="absolute">Tuyệt đối</option>
            <option value="relative">Tương đối</option>
          </select>
        </label>
        <label>
          Giá trị dung sai
          <input
            name="tolerance_value"
            type="number"
            step="any"
            min={0}
            required
            defaultValue={answerKey?.tolerance_value ?? 0}
          />
          <span className="small muted">Tương đối: nhập 0.01 cho 1%.</span>
        </label>
        <label>
          Số lượt nộp tối đa
          <input
            name="max_attempts"
            type="number"
            min={1}
            max={100}
            defaultValue={problem ? (problem.max_attempts ?? '') : 3}
            placeholder="Để trống = không giới hạn"
          />
        </label>
        <label>
          Tổng điểm
          <input
            name="points"
            type="number"
            step="0.001"
            min={0.001}
            required
            defaultValue={problem?.points ?? 10}
          />
        </label>
        <label>
          Phần điểm tự động
          <input
            name="auto_points"
            type="number"
            step="0.001"
            min={0}
            required
            defaultValue={problem?.auto_points ?? 10}
          />
          <span className="small muted">
            Phần tự luận = tổng − tự động. Essay/file_only: nhập 0.
          </span>
        </label>
        <label className="check span2">
          <input
            name="require_solution"
            type="checkbox"
            defaultChecked={problem?.require_solution}
          />
          Bắt buộc nộp lời giải cùng đáp án
        </label>
      </div>
    </ManagedForm>
  );
}
