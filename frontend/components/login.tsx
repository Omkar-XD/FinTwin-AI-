'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { AuthRaysGlow, AuthEmitterGlow } from '@/components/auth/AuthGlow';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginProps {
  onSuccess: () => void;
  /** Called when the back button is pressed. Falls back to router.push('/') if not provided. */
  onBack?: () => void;
}

export function Login({ onSuccess, onBack }: LoginProps) {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: setFormError,
    formState: { errors },
  } = useForm<LoginFormData>();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    router.push('/');
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      const parsed = loginSchema.safeParse(data);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (field === 'email' || field === 'password') {
            setFormError(field, { message: issue.message });
          }
        }
        return;
      }

      await login(parsed.data.email, parsed.data.password);
      onSuccess();
      // After a successful login, always take the user to the upload page.
      router.push('/upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log in.');
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-end overflow-hidden bg-black">
      <button
        onClick={handleBack}
        aria-label="Back to home"
        className="fixed left-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/70 bg-black/40 text-white backdrop-blur-md transition-all hover:bg-white/10"
        style={{ boxShadow: '0 0 16px rgba(0, 224, 255, 0.35)' }}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="auth-card relative top-[5em] z-[3] flex w-[26rem] max-w-[90vw] flex-col gap-4 rounded-lg p-8"
      >
        <div className="auth-label text-center text-3xl font-semibold">Login</div>

        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="Email"
            disabled={isLoading}
            className="auth-input h-14 w-full rounded-md px-3 font-bold outline-none"
          />
          {errors.email && (
            <p className="mt-1 text-xs font-medium text-white">{errors.email.message}</p>
          )}
        </div>

        <div>
          <input
            {...register('password')}
            type="password"
            placeholder="Password"
            disabled={isLoading}
            className="auth-input h-14 w-full rounded-md px-3 font-bold outline-none"
          />
          {errors.password && (
            <p className="mt-1 text-xs font-medium text-white">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md border-2 border-white/70 bg-black/40 p-2.5 text-center text-sm text-white"
          >
            {error}
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="auth-button flex h-16 items-center justify-center gap-2 rounded-md text-xl tracking-[0.3rem]"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-white/80">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-[#65EDFF] hover:underline">
            Sign up
          </Link>
        </p>
      </form>

      <div id="rays" className="auth-rays relative z-[2] bottom-[-1.5em]">
        <AuthRaysGlow />
      </div>

      <div id="emiter">
        <AuthEmitterGlow />
      </div>
    </div>
  );
}