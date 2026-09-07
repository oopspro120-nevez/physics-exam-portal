import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
export const metadata: Metadata = {
  title: { default: 'Physics Exam Portal', template: '%s · Physics Exam Portal' },
  description: 'Không gian thi Vật lý và Olympiad dành cho giáo viên, học sinh.',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
