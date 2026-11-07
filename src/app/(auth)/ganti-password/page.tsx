'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { StarLogo } from '@/components/ui/StarLogo';

export default function GantiPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 8) {
      setErrorMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage(error.message || 'Gagal memperbarui kata sandi.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.refresh();
        router.push('/');
      }, 2000);
    } catch (err) {
      console.error('Update password error:', err);
      setErrorMessage('Terjadi kesalahan saat memperbarui kata sandi.');
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
          <h2 className="text-xl font-bold text-gray-900 mb-1">Kata Sandi Diperbarui!</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            Kata sandi Anda berhasil diubah. Anda sedang dialihkan ke dashboard...
          </p>
        </div>
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
          Atur Kata Sandi Baru
        </h1>
        <p className="text-sm text-gray-500">
          Masukkan kata sandi baru untuk akun KosPiket Anda
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Kata Sandi Baru</label>
          <div className="relative border-b border-gray-300 focus-within:border-gray-900 transition-colors">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 karakter"
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

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Ulangi Kata Sandi Baru</label>
          <div className="relative border-b border-gray-300 focus-within:border-gray-900 transition-colors">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi"
              className="w-full pb-2 bg-transparent text-sm text-gray-900 focus:outline-none pr-8"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-0 bottom-2 text-gray-400 hover:text-gray-700 transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>
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
              'Simpan Kata Sandi'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
