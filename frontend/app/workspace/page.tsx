'use client';

import { useRouter } from 'next/navigation';
import { AIWorkspace } from '@/components/ai-workspace';
import { useAuthStore } from '@/lib/store';

export default function WorkspacePage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return <AIWorkspace onLogout={() => void handleLogout()} />;
}
