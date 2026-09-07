// Supabase REST trả tối đa 1.000 hàng mỗi trang; không được cắt mất lịch sử của lớp đông.
export async function readAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const r = await query(from, from + pageSize - 1);
    if (r.error) throw new Error(r.error.message);
    rows.push(...(r.data || []));
    if (!r.data || r.data.length < pageSize) return rows;
  }
}
