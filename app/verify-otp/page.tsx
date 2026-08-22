'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VerifyOTPPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupData, setSignupData] = useState<any>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const type = searchParams.get('type');

    if (type === 'login') {
      const email = sessionStorage.getItem('pending_login_email');
      if (!email) {
        router.push('/login');
        return;
      }
      setSignupData({ email }); // Set a minimal signupData for display
    } else {
      const data = sessionStorage.getItem('pending_signup');
      if (!data) {
        router.push('/signup');
        return;
      }
      setSignupData(JSON.parse(data));
    }
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const type = searchParams.get('type');

      let endpoint = '/api/auth/register';
      let body: any = { ...signupData, otp: otpString };

      if (type === 'login') {
        endpoint = '/api/auth/login';
        const loginEmail = sessionStorage.getItem('pending_login_email');
        if (!loginEmail) throw new Error('Login session expired. Please try again.');
        body = { email: loginEmail, otp: otpString };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      // Cleanup and redirect
      if (type === 'login') {
        sessionStorage.removeItem('pending_login_email');
        router.push('/');
      } else {
        sessionStorage.removeItem('pending_signup');
        router.push('/login?message=Account created successfully! Please sign in.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!signupData?.email) return;
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const type = searchParams.get('type') || 'signup';

      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupData.email, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code.');
      }
      alert('Code resent successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  if (!signupData) return null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-primary-navy p-8 text-white text-center">
          <h1 className="text-2xl font-bold ">Verify Identity</h1>
          <p className="text-blue-100 text-sm mt-2">
            We've sent a 6-digit code to <span className="font-bold text-white">{signupData.email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="flex justify-between gap-2">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }} type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-lg focus:border-primary-navy focus:ring-4 focus:ring-primary-navy/10 outline-none transition-all"
                required
              />
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-navy text-white rounded-lg font-bold text-sm hover:bg-accent-blue transition-all disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
            >
              {loading ? 'Verifying...' : (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('type') === 'login' ? 'Complete Sign-in' : 'Complete Registration')}
            </button>

            <button
              type="button"
              onClick={resendCode}
              disabled={loading}
              className="w-full text-sm text-gray-500 font-semibold hover:text-primary-navy transition-colors"
            >
              Didn't receive a code? <span className="text-primary-navy underline">Resend Code</span>
            </button>
          </div>
        </form>

        <div className="px-8 pb-8 text-center pt-2">
          <Link href="/signup" className="text-xs text-gray-400 hover:text-primary-navy flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to signup
          </Link>
        </div>
      </div>
    </main>
  );
}
