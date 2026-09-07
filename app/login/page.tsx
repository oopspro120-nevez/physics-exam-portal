import { Atom, BookOpen, FileCheck2, ShieldCheck } from 'lucide-react';
import { LoginForm } from '@/components/login-form';
import { isConfigured } from '@/lib/env';
export const dynamic = 'force-dynamic';
export default function Login() {
  return (
    <main className="login-page">
      <section className="login-brand">
        <a className="brand" href="/login">
          <span className="brand-icon">
            <Atom size={25} />
          </span>
          <span>
            PHYSICS<span className="brand-sub">EXAM PORTAL</span>
          </span>
        </a>
        <div className="login-copy">
          <p className="eyebrow">PHYSICS & OLYMPIAD</p>
          <h1>
            Tập trung tư duy.
            <br />
            <span>Chinh phục Vật lý.</span>
          </h1>
          <p className="lead">
            Không gian làm bài dành cho những lời giải sâu sắc và ý tưởng khác biệt.
          </p>
          <div className="login-features">
            <span>
              <BookOpen size={19} /> Đề thi PDF
            </span>
            <span>
              <FileCheck2 size={19} /> Nộp lời giải
            </span>
            <span>
              <ShieldCheck size={19} /> Kết quả riêng tư
            </span>
          </div>
        </div>
        <div className="login-footer">
          KHÔNG GIAN HỌC THUẬT <span>01 / PHYSICS</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập cổng thi</h2>
          <p className="muted">Sẵn sàng cho bài toán tiếp theo.</p>
          <LoginForm configured={isConfigured()} />
          <div className="device-note">
            <ShieldCheck size={20} />
            <p>
              <strong>Một tài khoản · Một thiết bị</strong>
              <br />
              Hãy dùng trình duyệt thường sử dụng để truy cập kỳ thi.
            </p>
          </div>
        </div>
        <span className="panel-footer">Physics Exam Portal · Hệ thống giao và nhận bài</span>
      </section>
    </main>
  );
}
