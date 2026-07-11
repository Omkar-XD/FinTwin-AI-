'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { AuthRaysGlow, AuthEmitterGlow } from '@/components/auth/AuthGlow';

const signupSchema = z
  .object({
    fullName: z.string().trim().optional(),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

function getSignupErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('already') || normalized.includes('registered')) {
    return 'This email is already registered. Try signing in instead.';
  }

  if (normalized.includes('password')) {
    return message;
  }

  return message || 'Unable to create your account. Please try again.';
}

export default function SignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    setError: setFormError,
    formState: { errors },
  } = useForm<SignupFormData>();

  const onSubmit = async (data: SignupFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setConfirmationMessage(null);
      const parsed = signupSchema.safeParse(data);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (
            field === 'fullName'
            || field === 'email'
            || field === 'password'
            || field === 'confirmPassword'
          ) {
            setFormError(field, { message: issue.message });
          }
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            full_name: parsed.data.fullName?.trim() || parsed.data.email.split('@')[0],
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      // If Supabase auto-created a session (email confirmation disabled),
      // sign it out immediately so the user is NOT auto-logged into the app.
      // They must land on the Sign In page and enter credentials themselves.
      if (signupData.session) {
        await supabase.auth.signOut();
      }

      setConfirmationMessage(
        'Account created successfully. Redirecting you to sign in...',
      );

      // Always send the user back to the Sign In page after signup.
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(getSignupErrorMessage(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-end overflow-hidden bg-black">
      <button
        onClick={() => router.push('/login')}
        aria-label="Back to sign in"
        className="fixed left-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/70 bg-black/40 text-white backdrop-blur-md transition-all hover:bg-white/10"
        style={{ boxShadow: '0 0 16px rgba(0, 224, 255, 0.35)' }}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="auth-card relative top-[5em] z-[3] flex w-[26rem] max-w-[90vw] flex-col gap-4 rounded-lg p-8"
      >
        <div className="auth-label text-center text-3xl font-semibold">Sign Up</div>

        <div>
          <input
            {...register('fullName')}
            type="text"
            placeholder="Full Name"
            disabled={isSubmitting}
            className="auth-input h-14 w-full rounded-md px-3 font-bold outline-none"
          />
        </div>

        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="Email"
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            className="auth-input h-14 w-full rounded-md px-3 font-bold outline-none"
          />
          {errors.password && (
            <p className="mt-1 text-xs font-medium text-white">{errors.password.message}</p>
          )}
        </div>

        <div>
          <input
            {...register('confirmPassword')}
            type="password"
            placeholder="Confirm Password"
            disabled={isSubmitting}
            className="auth-input h-14 w-full rounded-md px-3 font-bold outline-none"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs font-medium text-white">
              {errors.confirmPassword.message}
            </p>
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

        {confirmationMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 rounded-md border-2 border-white/70 bg-black/40 p-2.5 text-sm text-white"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{confirmationMessage}</span>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="auth-button flex h-16 items-center justify-center gap-2 rounded-md text-xl tracking-[0.3rem]"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Create Account
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-white/80">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#65EDFF] hover:underline">
            Sign in
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
