'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle2, UserCheck, Eye, EyeOff } from 'lucide-react';
import { StarLogo } from '@/components/ui/StarLogo';

interface UnclaimedMember {
  id: string;
  name: string;
  avatar_url?: string;
  avatar_color: string;
  order_index: number;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [unclaimedMembers, setUnclaimedMembers] = useState<UnclaimedMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchUnclaimed() {
      setIsLoadingMembers(true);
      try {
        const { data, error } = await supabase.rpc('get_unclaimed_members');
        if (error) {
          console.warn('get_unclaimed_members rpc error:', error);
          setErrorMessage('Gagal memuat daftar slot anggota. Coba muat ulang halaman.');
        } else if (data) {
          setUnclaimedMembers(data as UnclaimedMember[]);
        }
      } catch (err) {
        console.warn('Error fetching unclaimed members:', err);
        setErrorMessage('Gagal memuat daftar slot anggota. Coba muat ulang halaman.');
      } finally {
        setIsLoadingMembers(false);
      }
    }
    fetchUnclaimed();
  }, [supabase]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 8) {
      setErrorMessage('Kata sandi harus minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!selectedMemberId) {
      setErrorMessage('Silakan pilih salah satu slot anggota kost yang ingin Anda klaim.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            member_id: selectedMemberId,
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered') || error.message.includes('already exists')) {
          setErrorMessage('Email ini sudah terdaftar. Silakan gunakan email lain atau masuk.');
        } else if (error.message.includes('Slot anggota ini sudah diklaim')) {
          setErrorMessage('Slot anggota ini baru saja diklaim oleh orang lain. Silakan pilih slot lain.');
        } else {
          setErrorMessage(error.message || 'Pendaftaran gagal. Silakan coba lagi.');
        }
        setIsSubmitting(false);
        return;
      }

      // Deteksi jika email sudah terdaftar saat Confirm email aktif (Supabase mengembalikan user tanpa identities)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorMessage('Email ini sudah terdaftar. Silakan gunakan email lain atau masuk.');
        setIsSubmitting(false);
        return;
      }

      if (data.user) setIsSuccess(true);
    } catch (err) {
      console.error('Registration exception:', err);
      setErrorMessage('Terjadi kesalahan saat memproses pendaftaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-5 py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 stroke-[2]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Pendaftaran Berhasil!</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            Akun <span className="font-semibold text-gray-900">{fullName}</span> menunggu persetujuan admin kost.
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-500 border border-gray-100 text-left w-full">
          Admin akan memverifikasi akun Anda sebelum bisa mengakses jadwal piket.
        </div>
        <Link
          href="/login"
          className="w-full py-3.5 bg-[#1A1A1A] hover:bg-black text-white rounded-full font-semibold text-sm text-center transition-all"
        >
          Menuju Halaman Masuk
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-center mb-5">
        <StarLogo className="w-8 h-8 text-black" />
      </div>

      {/* Heading */}
      <div className="text-center mb-6">
        <h1 className="text-[1.6rem] font-bold text-gray-900 leading-tight mb-1">Create an account</h1>
        <p className="text-sm text-gray-500">Please enter your details</p>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleRegister} className="flex flex-col gap-5 flex-1">
        {/* Nama */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Full Name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder=""
            className="w-full border-0 border-b border-gray-300 pb-2 bg-transparent text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>

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
              minLength={8}
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

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Confirm Password</label>
          <div className="relative border-b border-gray-300 focus-within:border-gray-900 transition-colors">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder=""
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

        {/* Slot Anggota */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-800">Pilih Slot Anggota</label>
            <span className="text-xs text-gray-400">1 slot = 1 akun</span>
          </div>

          {isLoadingMembers ? (
            <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
              Memuat slot anggota...
            </div>
          ) : unclaimedMembers.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs font-semibold text-amber-700">
              Semua slot sudah diklaim. Hubungi admin.
            </div>
          ) : (
            <div className="space-y-2">
              {unclaimedMembers.map((m) => {
                const isSelected = selectedMemberId === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="memberSlot"
                      value={m.id}
                      checked={isSelected}
                      onChange={() => setSelectedMemberId(m.id)}
                      className="w-4 h-4 accent-black"
                    />
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                      <img
                        src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`}
                        alt={m.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">Slot #{m.order_index + 1}</p>
                    </div>
                    {isSelected && <UserCheck className="w-4 h-4 text-gray-900 flex-shrink-0" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex flex-col gap-3 mt-auto">
          <button
            type="submit"
            disabled={isSubmitting || unclaimedMembers.length === 0}
            className="w-full py-3.5 bg-[#1A1A1A] hover:bg-black text-white rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign Up'
            )}
          </button>

          {/* Google Sign Up button */}
          <button
            type="button"
            onClick={async () => {
              try {
                setErrorMessage('');
                const supabase = createClient();
                const callbackUrl = new URL('/auth/callback', window.location.origin);
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: callbackUrl.toString(),
                  },
                });
                if (error) {
                  setErrorMessage(error.message || 'Gagal mendaftar dengan Google.');
                }
              } catch (err) {
                console.error('Google register error:', err);
                setErrorMessage('Terjadi kesalahan saat mendaftar dengan Google.');
              }
            }}
            className="w-full py-3.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>
        </div>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-5">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-gray-900 hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}
