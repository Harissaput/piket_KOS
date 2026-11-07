'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { StarLogo } from '@/components/ui/StarLogo';

export default function LupaPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', '/ganti-password');

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callbackUrl.toString(),
      });

      if (error) {
        setErrorMessage(error.message || 'Gagal mengirim email reset kata sandi.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      console.error('Reset password error:', err);
      setErrorMessage('Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-5 py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 stroke-[2]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Tautan Terkirim!</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            Kami telah mengirimkan tautan pemulihan ke <span className="font-semibold text-gray-900">{email}</span>. Silakan periksa kotak masuk atau spam Anda.
          </p>
        </div>
        <Link
          href="/login"
          className="w-full py-3.5 bg-[#1A1A1A] hover:bg-black text-white rounded-full font-semibold text-sm text-center transition-all"
        >
          Kembali ke Masuk
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <StarLogo className="w-8 h-8 text-black" />
      </div>

      {/* Heading */}
      <div className="text-center mb-7">
        <h1 className="text-[1.75rem] font-bold text-gray-900 leading-tight mb-1">
          Lupa Kata Sandi
        </h1>
        <p className="text-sm text-gray-500">
          Masukkan email terdaftar untuk menerima tautan pemulihan
        </p>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleReset} className="flex flex-col gap-6 flex-1">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="w-full border-0 border-b border-gray-300 pb-2 bg-transparent text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-[#1A1A1A] hover:bg-black text-white rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Kirim Tautan Pemulihan'
            )}
          </button>
        </div>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-6">
        Ingat kata sandi Anda?{' '}
        <Link href="/login" className="font-semibold text-gray-900 hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
