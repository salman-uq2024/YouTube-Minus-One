import { Suspense } from 'react';
import { SearchPage } from '@/components/SearchPage';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
