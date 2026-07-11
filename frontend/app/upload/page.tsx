'use client';

import { useRouter } from 'next/navigation';
import { Upload } from '@/components/upload';

export default function UploadPage() {
  const router = useRouter();

  return <Upload onComplete={() => router.push('/workspace')} />;
}
