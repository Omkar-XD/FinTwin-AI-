'use client';

import { useRouter } from 'next/navigation';
import { Landing } from '@/components/landing';

export default function Home() {
  const router = useRouter();

  return <Landing onNavigate={() => router.push('/login')} />;
}
