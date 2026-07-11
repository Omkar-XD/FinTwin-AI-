'use client';

import { useRouter } from 'next/navigation';
import { Processing } from '@/components/processing';

export default function ProcessingPage() {
  const router = useRouter();

  return <Processing onComplete={() => router.push('/workspace')} />;
}
