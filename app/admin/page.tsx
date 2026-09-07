import Link from 'next/link';
import { Users, GraduationCap, BookOpen, FileText, ArrowUpRight } from 'lucide-react';
import { overview } from '@/services/data';
import { PageHead, Stat, Empty, Badge } from '@/components/ui';
export default async function Page() {
  const d = await overview();
  return (
    <>
      <PageHead
        title="Tổng quan hệ thống"
        description="Quản lý đội ngũ, lớp học và hoạt động thi."
        action={
          <Link className="button primary" href="/admin/classes">
            Quản lý lớp học <ArrowUpRight size={16} />
          </Link>
        }
      />
      <div className="stats">
        <Stat
          label="Giáo viên"
          value={d.profiles.filter((p) => p.role === 'teacher').length}
          icon={<GraduationCap size={19} />}
        />
        <Stat label="Lớp học" value={d.classes.length} icon={<BookOpen size={19} />} />
        <Stat
          label="Học sinh"
          value={d.profiles.filter((p) => p.role === 'student').length}
          icon={<Users size={19} />}
        />
        <Stat label="Kỳ thi" value={d.exams.length} icon={<FileText size={19} />} />
      </div>
      <section className="card">
        <div className="card-header">
          <h2>Lớp học</h2>
          <Link href="/admin/classes" className="text-link small">
            Xem tất cả
          </Link>
        </div>
        {d.classes.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lớp</th>
                  <th>Giáo viên phụ trách</th>
                  <th>Học sinh</th>
                  <th>Kỳ thi</th>
                </tr>
              </thead>
              <tbody>
                {d.classes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>
                      {d.profiles.find((p) => p.id === c.teacher_id)?.full_name || (
                        <Badge color="amber">Chưa phân công</Badge>
                      )}
                    </td>
                    <td>{d.members.filter((m) => m.class_id === c.id).length}</td>
                    <td>{d.exams.filter((e) => e.class_id === c.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Bắt đầu với lớp học đầu tiên"
            description="Tạo giáo viên, sau đó tạo lớp và phân công người phụ trách."
          />
        )}
      </section>
    </>
  );
}
