'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { StarLogo } from '../layout';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'rejected') {
      setErrorMessage('Akun Anda ditolak oleh admin. Hubungi admin kost untuk informasi lebih lanjut.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setErrorMessage('Email atau kata sandi yang Anda masukkan salah.');
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile || profile.status === 'pending') {
        router.push('/menunggu-persetujuan');
        return;
      }

      if (profile.status === 'rejected') {
        await supabase.auth.signOut();
        setErrorMessage('Akun Anda ditolak oleh admin kost.');
        setIsLoading(false);
        return;
      }

      const nextUrl = searchParams.get('next');
      if (nextUrl && !nextUrl.startsWith('/login') && !nextUrl.startsWith('/daftar')) {
        router.push(nextUrl);
      } else if (profile.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('Terjadi kesalahan saat masuk. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <StarLogo className="w-8 h-8 text-black" />
      </div>

      {/* Heading */}
      <div className="text-center mb-7">
        <h1 className="text-[1.75rem] font-bold text-gray-900 leading-tight mb-1">
          Welcome back!
        </h1>
        <p className="text-sm text-gray-500">Please enter your details</p>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="flex flex-col gap-6 flex-1">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            className="w-full border-0 border-b border-gray-300 pb-2 bg-transparent text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Password</label>
          <div className="relative border-b border-gray-300 focus-within:border-gray-900 transition-colors">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="w-full pb-2 bg-transparent text-sm text-gray-900 focus:outline-none pr-8"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 bottom-2 text-gray-400 hover:text-gray-700 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>

        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 mt-auto">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-[#1A1A1A] hover:bg-black text-white rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Log In'
            )}
          </button>

          {/* Google button */}
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
            }}
            className="w-full py-3.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2.5"
          >
            {/* Google G icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Log in with Google
          </button>
        </div>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/daftar" className="font-semibold text-gray-900 hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-40">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
