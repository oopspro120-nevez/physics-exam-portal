'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
      )
        router.refresh();
    }, 30000);
    return () => clearInterval(id);
  }, [router]);
  return <span className="small muted">Tự cập nhật mỗi 30 giây khi đang xem</span>;
}
