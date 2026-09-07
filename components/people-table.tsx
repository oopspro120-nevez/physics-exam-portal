import type { Profile } from '@/types/domain';
import { Badge, Empty } from '@/components/ui';
import { ActionButton, PasswordReset } from '@/components/mutations';
export function PeopleTable({ people }: { people: Profile[] }) {
  if (!people.length)
    return (
      <Empty title="Chưa có tài khoản" description="Tạo tài khoản để bắt đầu quản lý lớp học." />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Họ và tên</th>
            <th>Tên đăng nhập</th>
            <th>Trạng thái</th>
            <th>Quản lý truy cập</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.full_name}</strong>
              </td>
              <td className="mono">{p.username}</td>
              <td>
                <Badge color={p.active ? 'green' : 'red'}>
                  {p.active ? 'Hoạt động' : 'Đã khóa'}
                </Badge>
              </td>
              <td>
                <div className="row">
                  <ActionButton action="lock_user" payload={{ id: p.id, active: !p.active }}>
                    {p.active ? 'Khóa' : 'Mở khóa'}
                  </ActionButton>
                  <ActionButton
                    action="reset_device"
                    payload={{ id: p.id }}
                    confirmation={
                      'Thu hồi thiết bị và các phiên đang đăng nhập của ' + p.full_name + '?'
                    }
                  >
                    Reset thiết bị
                  </ActionButton>
                  <PasswordReset id={p.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
