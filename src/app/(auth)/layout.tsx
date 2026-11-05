import React from 'react';

/* Ilustrasi karakter kiri — persis seperti referensi */
function Illustration() {
  return (
    <svg
      viewBox="0 0 420 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-sm"
      aria-hidden="true"
    >
      {/* Lingkaran orange — setengah lingkaran di bawah */}
      <ellipse cx="175" cy="390" rx="130" ry="130" fill="#F97316" />
      {/* Mata kiri orange */}
      <circle cx="140" cy="318" r="6" fill="#1A1A1A" />
      {/* Hidung / bibir orange */}
      <path
        d="M148 338 Q168 356 188 338"
        stroke="#1A1A1A"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Kotak ungu — paling tinggi */}
      <rect x="110" y="140" width="130" height="250" rx="22" fill="#7C3AED" />
      {/* Mata kiri ungu */}
      <circle cx="148" cy="200" r="7" fill="#1A1A1A" />
      {/* Hidung ungu (garis vertikal) */}
      <rect x="169" y="188" width="6" height="28" rx="3" fill="#1A1A1A" />
      {/* Mata kanan ungu */}
      <circle cx="188" cy="200" r="7" fill="#1A1A1A" />

      {/* Kotak hitam — tinggi sedang */}
      <rect x="225" y="210" width="110" height="180" rx="16" fill="#1A1A1A" />
      {/* Mata kiri hitam */}
      <circle cx="253" cy="258" r="7" fill="#FFFFFF" />
      {/* Mata kanan hitam */}
      <circle cx="278" cy="258" r="7" fill="#FFFFFF" />

      {/* Burung kuning — pendek, rounded top */}
      <rect x="295" y="280" width="85" height="110" rx="42" fill="#EAB308" />
      {/* Mata burung */}
      <circle cx="324" cy="308" r="5.5" fill="#1A1A1A" />
      {/* Paruh burung */}
      <rect x="338" y="314" width="32" height="8" rx="4" fill="#1A1A1A" />
    </svg>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#E8E8E8] flex items-center justify-center p-4 lg:p-0">
      {/* Container utama */}
      <div className="w-full max-w-5xl flex items-center justify-center min-h-screen lg:min-h-0 lg:h-auto">

        {/* Kiri — Ilustrasi (hanya tampil di lg+) */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-12 py-20">
          <Illustration />
        </div>

        {/* Kanan — Kartu form floating */}
        <div className="w-full lg:w-auto lg:min-w-[420px] lg:max-w-[460px]">
          <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 w-full min-h-[520px] flex flex-col justify-between">
            {children}
          </div>
        </div>

      </div>
    </div>
  );
}
