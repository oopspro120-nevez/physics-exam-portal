'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, UserPlus } from 'lucide-react';
type UserRow = { full_name: string; username: string; password: string };
type Result = Partial<UserRow> & { username: string; ok: boolean; error?: string };
function password() {
  return 'P!' + crypto.randomUUID().replaceAll('-', '').slice(0, 14);
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const csvCell = (s: string) =>
  '"' + (/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
export function UserManager({ role, classId }: { role: 'teacher' | 'student'; classId?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]),
    [results, setResults] = useState<Result[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function send(users: UserRow[]) {
    setBusy(true);
    setError('');
    setResults([]);
    const output: Result[] = [];
    try {
      for (let i = 0; i < users.length; i += 20) {
        const r = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, class_id: classId, users: users.slice(i, i + 20) }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        output.push(...d.results);
        setResults([...output]);
      }
      setRows([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo tài khoản.');
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    setError('');
    setRows([]);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Danh sách tối đa 2 MB.');
      let raw: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse<Record<string, string>>(await file.text(), {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''),
        });
        if (parsed.errors.length) throw new Error('CSV sai cấu trúc. Hãy dùng file mẫu.');
        raw = parsed.data;
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error('Không có sheet dữ liệu.');
        if (sheet.rowCount > 101) throw new Error('Mỗi lần nhập tối đa 100 học sinh.');
        const headers = ['full_name', 'username', 'password'];
        const actual = sheet.getRow(1).values as unknown[];
        if (actual[1] !== 'full_name' || actual[2] !== 'username')
          throw new Error('Dòng đầu cần full_name, username, password.');
        sheet.eachRow((row, n) => {
          if (n > 1) {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              const cell = row.getCell(i + 1).value;
              obj[h] = typeof cell === 'string' || typeof cell === 'number' ? String(cell) : '';
            });
            raw.push(obj);
          }
        });
      } else throw new Error('Chỉ nhận CSV hoặc XLSX.');
      if (raw.length < 1 || raw.length > 100)
        throw new Error('Mỗi lần nhập từ 1 đến 100 học sinh.');
      const mapped = raw.map((r) => ({
        full_name: String(r.full_name || '').trim(),
        username: String(r.username || '')
          .trim()
          .toLowerCase(),
        password: String(r.password || '').trim() || password(),
      }));
      if (
        mapped.some(
          (r) => !r.full_name || !/^[a-z0-9._-]{3,40}$/.test(r.username) || r.password.length < 10,
        )
      )
        throw new Error('Kiểm tra họ tên, username và mật khẩu (tối thiểu 10 ký tự).');
      if (new Set(mapped.map((r) => r.username)).size !== mapped.length)
        throw new Error('Danh sách chứa tên đăng nhập trùng nhau.');
      setRows(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được file.');
    } finally {
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          await send([
            {
              full_name: String(f.get('full_name')),
              username: String(f.get('username')).toLowerCase(),
              password: String(f.get('password')) || password(),
            },
          ]);
          form.reset();
        }}
      >
        <div className="form-grid">
          <label>
            Họ và tên
            <input required name="full_name" maxLength={150} />
          </label>
          <label>
            Tên đăng nhập
            <input
              required
              name="username"
              minLength={3}
              pattern="[a-z0-9._\-]{3,40}"
              autoComplete="off"
            />
          </label>
          <label className="span2">
            Mật khẩu ban đầu
            <input
              name="password"
              minLength={10}
              autoComplete="new-password"
              placeholder="Để trống để tạo mật khẩu ngẫu nhiên"
            />
          </label>
        </div>
        <div>
          <button className="button primary" disabled={busy}>
            <UserPlus size={16} />
            {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
      {role === 'student' && (
        <>
          <div className="divider" />
          <div className="row between">
            <h3 style={{ margin: 0 }}>Nhập danh sách học sinh</h3>
            <button
              className="button compact"
              onClick={() => download('full_name,username,password\r\n', 'mau-danh-sach.csv')}
            >
              <Download size={15} />
              File CSV mẫu
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Cột: full_name, username, password. Mật khẩu để trống sẽ được tạo tự động. Tối đa 100
            học sinh/lần.
          </p>
          <label className="file-drop">
            <Upload size={24} style={{ margin: 'auto' }} />
            Chọn CSV hoặc XLSX
            <input
              ref={input}
              type="file"
              accept=".csv,.xlsx"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.[0]) importFile(e.target.files[0]);
              }}
            />
          </label>
          {rows.length > 0 && (
            <>
              <p>Đã kiểm tra {rows.length} học sinh. Xem lại trước khi tạo:</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Tên đăng nhập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.username}>
                        <td>{r.full_name}</td>
                        <td>{r.username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="button primary" disabled={busy} onClick={() => send(rows)}>
                Tạo {rows.length} tài khoản
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <div className="stack">
          <p className="notice success">
            Đã tạo {results.filter((r) => r.ok).length}/{results.length} tài khoản. Hãy tải thông
            tin đăng nhập trước khi rời trang.
          </p>
          <button
            className="button"
            onClick={() =>
              download(
                'full_name,username,password\r\n' +
                  results
                    .filter((r) => r.ok)
                    .map((r) =>
                      [r.full_name || '', r.username, r.password || ''].map(csvCell).join(','),
                    )
                    .join('\r\n'),
                'tai-khoan-vua-tao.csv',
              )
            }
          >
            <Download size={16} />
            Tải thông tin đăng nhập
          </button>
          {results
            .filter((r) => !r.ok)
            .map((r) => (
              <p className="notice danger" key={r.username}>
                {r.username}: {r.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
