import type { Submission } from '@/types/domain';
export function bestSubmission(attempts: Submission[]) {
  return [...attempts].sort(
    (a, b) =>
      Number(b.final_score ?? 0) - Number(a.final_score ?? 0) ||
      a.attempt_number - b.attempt_number,
  )[0];
}
export function totalScore(attempts: Submission[]) {
  const ids = [...new Set(attempts.map((a) => a.problem_id))];
  return ids.reduce(
    (sum, id) =>
      sum + Number(bestSubmission(attempts.filter((a) => a.problem_id === id))?.final_score ?? 0),
    0,
  );
}
export function formatScore(value: number | string | null | undefined) {
  return value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}
