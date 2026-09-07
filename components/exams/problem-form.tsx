'use client';
import { useState } from 'react';
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
  const [kind, setKind] = useState<Problem['answer_type']>(problem?.answer_type || 'essay');
  const [autoPoints, setAutoPoints] = useState(String(problem?.auto_points ?? 0));
  const [requireSolution, setRequireSolution] = useState(
    problem?.require_solution || kind === 'file_only',
  );
  const automatic = kind === 'numeric' || kind === 'text';
  return (
    <ManagedForm
      action="problem_save"
      payload={{ exam_id: examId, ...(problem ? { id: problem.id } : {}) }}
      label={problem ? 'Lưu câu hỏi' : 'Thêm câu hỏi'}
    >
      <div className="form-grid">
        <label>
          Câu số
          <input
            name="problem_number"
            type="number"
            min={1}
            required
            defaultValue={problem?.problem_number || number}
          />
        </label>
        <label>
          Điểm tối đa
          <input
            name="points"
            type="number"
            step="0.001"
            min={0.001}
            max={10000}
            required
            defaultValue={problem?.points ?? 10}
          />
        </label>
        <label className="span2">
          Tên ngắn (không bắt buộc)
          <input
            name="title"
            maxLength={200}
            defaultValue={problem?.title}
            placeholder="Ví dụ: Chuyển động của vật trên mặt phẳng nghiêng"
          />
        </label>
        <label className="span2">
          Học sinh trả lời bằng
          <select
            name="answer_type"
            value={kind}
            onChange={(e) => {
              const value = e.target.value as Problem['answer_type'];
              setKind(value);
              if (value === 'essay' || value === 'file_only') setAutoPoints('0');
              if (value === 'file_only') setRequireSolution(true);
            }}
          >
            <option value="essay">Tự luận · nhập lời giải, có thể đính kèm tệp</option>
            <option value="file_only">Tệp lời giải · PDF hoặc ảnh bài làm</option>
            <option value="numeric">Đáp số · chấm tự động theo dung sai</option>
            <option value="text">Văn bản ngắn · chấm theo đáp án chuẩn</option>
          </select>
        </label>
        {automatic ? (
          <>
            <label>
              Đáp án chuẩn
              <input
                name="correct_answer"
                required
                maxLength={1000}
                defaultValue={answerKey?.correct_answer || ''}
                placeholder={kind === 'numeric' ? 'Ví dụ: 9.81 hoặc 3,5e-4' : 'Đáp án ngắn'}
              />
            </label>
            <label>
              Phần điểm tự động
              <input
                name="auto_points"
                type="number"
                step="0.001"
                min={0}
                max={10000}
                required
                value={autoPoints}
                onChange={(e) => setAutoPoints(e.target.value)}
              />
              <span className="small muted">Phần còn lại do giáo viên chấm.</span>
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="correct_answer" value="" />
            <input type="hidden" name="auto_points" value="0" />
            <p className="notice span2">Giáo viên chấm toàn bộ điểm của câu này.</p>
          </>
        )}
        {automatic && (
          <label className="span2">
            Đơn vị (nếu có)
            <input
              name="unit"
              maxLength={80}
              defaultValue={problem?.unit}
              placeholder="Ví dụ: m/s²"
            />
          </label>
        )}
        {kind === 'numeric' ? (
          <>
            <label>
              Cách tính dung sai
              <select name="tolerance_type" defaultValue={answerKey?.tolerance_type || 'absolute'}>
                <option value="absolute">Sai số tuyệt đối</option>
                <option value="relative">Sai số tương đối</option>
              </select>
            </label>
            <label className="span2">
              Dung sai cho phép
              <input
                name="tolerance_value"
                type="number"
                step="any"
                min={0}
                required
                defaultValue={answerKey?.tolerance_value ?? 0}
              />
              <span className="small muted">
                Tương đối: 0.01 tương ứng 1%. Dung sai 0 yêu cầu đáp số chính xác.
              </span>
            </label>
          </>
        ) : (
          <>
            {!automatic && <input type="hidden" name="unit" value="" />}
            <input type="hidden" name="tolerance_type" value="absolute" />
            <input type="hidden" name="tolerance_value" value="0" />
          </>
        )}
        <label>
          Số lượt nộp tối đa
          <input
            name="max_attempts"
            type="number"
            min={1}
            max={100}
            defaultValue={problem ? (problem.max_attempts ?? '') : 3}
            placeholder="Để trống: không giới hạn"
          />
          <span className="small muted">Hình thức Kiểm tra luôn chỉ cho nộp một lần.</span>
        </label>
        <label className="check">
          <input
            name="require_solution"
            type="checkbox"
            checked={requireSolution}
            onChange={(e) => setRequireSolution(e.target.checked)}
          />
          Bắt buộc đính kèm tệp lời giải
        </label>
      </div>
    </ManagedForm>
  );
}
