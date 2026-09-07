import { overview } from '@/services/data';
import { PageHead, Empty } from '@/components/ui';
import { ManagedForm } from '@/components/mutations';
export default async function Page() {
  const d = await overview();
  const teachers = d.profiles.filter((p) => p.role === 'teacher' && p.active);
  const options = (
    <>
      <option value="">Chưa phân công</option>
      {teachers.map((p) => (
        <option value={p.id} key={p.id}>
          {p.full_name}
        </option>
      ))}
    </>
  );
  return (
    <>
      <PageHead title="Quản lý lớp học" description="Tạo lớp, đổi tên và phân công giáo viên." />
      <div className="grid2">
        <section className="card">
          <h2>Tạo lớp mới</h2>
          <ManagedForm action="class_save" label="Tạo lớp" reset>
            <label>
              Tên lớp
              <input
                name="name"
                required
                maxLength={150}
                placeholder="Ví dụ: Đội tuyển Vật lý 12"
              />
            </label>
            <label>
              Giáo viên phụ trách<select name="teacher_id">{options}</select>
            </label>
          </ManagedForm>
        </section>
        <section className="card">
          <h2>Phân công giảng dạy</h2>
          <p className="muted">
            Mỗi lớp có một giáo viên phụ trách. Khi đổi giáo viên, quyền truy cập lớp và các kỳ thi
            chuyển sang người được phân công mới.
          </p>
          <p className="small muted">Chỉ quản trị viên được tạo lớp và thay đổi phân công.</p>
        </section>
      </div>
      <div className="grid2 section-gap">
        {d.classes.map((c) => (
          <section className="card" key={c.id}>
            <ManagedForm action="class_save" payload={{ id: c.id }}>
              <label>
                Tên lớp
                <input name="name" required defaultValue={c.name} />
              </label>
              <label>
                Giáo viên phụ trách
                <select name="teacher_id" defaultValue={c.teacher_id || ''}>
                  {options}
                </select>
              </label>
              <span className="small muted">
                {d.members.filter((m) => m.class_id === c.id).length} học sinh ·{' '}
                {d.exams.filter((e) => e.class_id === c.id).length} kỳ thi
              </span>
            </ManagedForm>
          </section>
        ))}
      </div>
      {!d.classes.length && (
        <div className="section-gap">
          <Empty title="Chưa có lớp học" />
        </div>
      )}
    </>
  );
}
