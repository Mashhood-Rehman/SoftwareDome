'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Mode = 'signin' | 'signup';
type Step = 'form' | 'otp';
type Role = 'USER' | 'VENDOR';

const INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-gray-300 transition-all focus:border-brand-green focus:ring-2 focus:ring-brand-green/20';

const LABEL = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400';

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const message = searchParams.get('message');

  const [mode, setMode] = useState<Mode>(
    (searchParams.get('mode') as Mode) === 'signup' ? 'signup' : 'signin'
  );
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign-in
  const [signInEmail, setSignInEmail] = useState('');

  // Sign-up
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
    role: (searchParams.get('role') === 'VENDOR' ? 'VENDOR' : 'USER') as Role,
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    companyPhone: '',
  });

  // OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpType, setOtpType] = useState<'login' | 'signup'>('login');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((prev) =>
      id === 'companyName'
        ? { ...prev, companyName: value, organizationName: value }
        : { ...prev, [id]: value }
    );
  };

  const switchMode = (m: Mode) => {
    setError(null);
    setStep('form');
    setOtp(['', '', '', '', '', '']);
    setMode(m);
  };

  /* ── OTP submit (called by button and auto-submit) ── */
  const submitOtp = useCallback(
    async (otpString: string) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const endpoint = otpType === 'login' ? '/api/auth/login' : '/api/auth/register';
        const body =
          otpType === 'login'
            ? { email: signInEmail, otp: otpString }
            : { ...form, otp: otpString };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed.');

        if (otpType === 'login') {
          sessionStorage.removeItem('pending_login_email');
          router.push('/');
        } else {
          sessionStorage.removeItem('pending_signup');
          setStep('form');
          setMode('signin');
          setOtp(['', '', '', '', '', '']);
          setSuccessMsg('Account created! Sign in to continue.');
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    },
    [loading, otpType, signInEmail, form, router]
  );

  /* ── OTP input handlers ── */
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when last box filled
    if (digit && index === 5 && newOtp.every((d) => d !== '')) {
      submitOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) newOtp[i] = text[i];
    setOtp(newOtp);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) submitOtp(text);
  };

  /* ── Send OTP helpers ── */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signInEmail, type: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP.');
      sessionStorage.setItem('pending_login_email', signInEmail);
      setOtpType('login');
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, type: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');
      sessionStorage.setItem('pending_signup', JSON.stringify(form));
      setOtpType('signup');
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const email = otpType === 'login' ? signInEmail : form.email;
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: otpType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend code.');
      setResendCooldown(30);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const otpEmail = otpType === 'login' ? signInEmail : form.email;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="flex w-full overflow-hidden rounded-2xl shadow-2xl" style={{ maxWidth: 900 }}>

        {/* ── Brand panel ── */}
        <div className="relative hidden w-[380px] shrink-0 flex-col overflow-hidden bg-navy-800 p-10 md:flex">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/[0.025]" />
            <div
              className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-brand-green/[0.08]"
              style={{ filter: 'blur(72px)', transform: 'translate(35%, 35%)' }}
            />
          </div>
          <div className="relative z-10 mb-14 flex items-center gap-3">
            <img src="/logomark.svg" alt="SoftwareDome" width={32} height={32} className="h-8 w-8" />
            <span className="text-[17px] font-bold tracking-tight text-white">SoftwareDome</span>
          </div>
          <div className="relative z-10 flex-1">
            <h2 className="text-[26px] font-bold leading-snug text-white">
              Discover the right software for your business.
            </h2>
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/45">
              Browse, compare, and connect with top software vendors — all in one place.
            </p>
            <ul className="mt-10 space-y-4">
              {[
                ['500+', 'Software products listed'],
                ['10K+', 'Businesses on the platform'],
                ['200+', 'Verified vendors onboarded'],
              ].map(([val, lbl]) => (
                <li key={lbl} className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand-green" />
                  <span className="text-[13px] text-white/55">
                    <strong className="font-bold text-white">{val}</strong> {lbl}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative z-10 mt-10 flex items-center gap-3 text-[11px] text-white/20">
            <div className="h-px flex-1 bg-white/10" />
            <span>Trusted by industry leaders</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-white">
          <div className="flex flex-1 flex-col justify-center px-8 py-10 md:px-12">

            {/* Mobile logo */}
            <div className="mb-8 flex items-center gap-2.5 md:hidden">
              <img src="/logomark.svg" alt="SoftwareDome" width={28} height={28} className="h-7 w-7" />
              <span className="text-[16px] font-bold tracking-tight text-navy-800">SoftwareDome</span>
            </div>

            {/* ── OTP STEP ── */}
            {step === 'otp' && (
              <div className="anim-fade-in flex flex-col items-center text-center">
                {/* Icon */}
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-green/10">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="3" y="8" width="26" height="18" rx="3" stroke="#48a637" strokeWidth="2" fill="none"/>
                    <path d="M3 12l13 8 13-8" stroke="#48a637" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>

                <h1 className="text-[22px] font-bold text-gray-900">Check your inbox</h1>
                <p className="mt-1.5 text-[13px] text-gray-400">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-navy-800">{otpEmail}</span>
                </p>

                {error && (
                  <div className="mt-4 w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                    {error}
                  </div>
                )}

                {/* OTP boxes */}
                <div className="mt-8 flex w-full items-center justify-center gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      autoFocus={idx === 0}
                      className={`h-14 w-11 rounded-xl border-2 text-center text-xl font-bold outline-none transition-all sm:h-14 sm:w-12 ${
                        digit
                          ? 'border-brand-green bg-brand-green/5 text-navy-800'
                          : 'border-gray-200 bg-white text-gray-900 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20'
                      }`}
                    />
                  ))}
                </div>

                <p className="mt-3 text-[11px] text-gray-400">
                  Type or paste your code — it auto-submits when complete
                </p>

                {/* Verify button */}
                <button
                  type="button"
                  onClick={() => submitOtp(otp.join(''))}
                  disabled={loading || otp.some((d) => !d)}
                  className="mt-6 w-full rounded-xl bg-navy-800 py-3 text-[13px] font-semibold text-white transition-all hover:bg-navy-700 disabled:opacity-40"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Verifying…
                    </span>
                  ) : (
                    otpType === 'login' ? 'Complete Sign In' : 'Verify & Create Account'
                  )}
                </button>

                {/* Resend + back */}
                <div className="mt-5 flex w-full items-center justify-between text-[12px]">
                  <button
                    type="button"
                    onClick={() => { setStep('form'); setOtp(['', '', '', '', '', '']); setError(null); }}
                    className="flex items-center gap-1 text-gray-400 transition-colors hover:text-gray-600"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    className="font-semibold text-brand-green-dark transition-colors hover:underline disabled:cursor-default disabled:text-gray-400"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}

            {/* ── FORM STEP ── */}
            {step === 'form' && (
              <>
                {/* Tab switcher */}
                <div className="mb-8 flex rounded-xl bg-gray-100 p-1">
                  {(['signin', 'signup'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-all ${
                        mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-500'
                      }`}
                    >
                      {m === 'signin' ? 'Sign In' : 'Sign Up'}
                    </button>
                  ))}
                </div>

                {/* Alerts */}
                {(message || successMsg) && mode === 'signin' && (
                  <div className="mb-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-center text-xs font-semibold text-green-700">
                    {successMsg || message}
                  </div>
                )}
                {error && (
                  <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-xs font-medium text-red-600">
                    {error}
                  </div>
                )}

                {/* ── SIGN IN ── */}
                {mode === 'signin' && (
                  <div className="anim-fade-in">
                    <h1 className="text-[22px] font-bold text-gray-900">Welcome back</h1>
                    <p className="mb-7 mt-1 text-[13px] text-gray-400">
                      Enter your business email to receive a sign-in code.
                    </p>
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div>
                        <label htmlFor="signin-email" className={LABEL}>Business Email</label>
                        <input
                          id="signin-email"
                          type="email"
                          value={signInEmail}
                          onChange={(e) => setSignInEmail(e.target.value)}
                          placeholder="name@company.com"
                          className={INPUT}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-navy-800 py-3 text-[13px] font-semibold text-white transition-all hover:bg-navy-700 disabled:opacity-50"
                      >
                        {loading ? 'Sending code…' : 'Send Sign-in Code'}
                      </button>
                    </form>
                    <p className="mt-8 text-center text-[13px] text-gray-400">
                      New to SoftwareDome?{' '}
                      <button onClick={() => switchMode('signup')} className="font-semibold text-brand-green hover:underline">
                        Create an account
                      </button>
                    </p>
                  </div>
                )}

                {/* ── SIGN UP ── */}
                {mode === 'signup' && (
                  <div className="anim-fade-in">
                    <h1 className="text-[22px] font-bold text-gray-900">Create account</h1>
                    <p className="mb-7 mt-1 text-[13px] text-gray-400">Get started with SoftwareDome today.</p>
                    <form onSubmit={handleSignUp} className="space-y-4">
                      {/* Account type */}
                      <div>
                        <label className={LABEL}>Account Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'USER', label: 'General User', sub: 'Browse & compare software' },
                            { value: 'VENDOR', label: 'Vendor', sub: 'List & promote your product' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm((p) => ({ ...p, role: opt.value }))}
                              className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                                form.role === opt.value ? 'border-brand-green bg-brand-green/5' : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className={`text-[13px] font-semibold ${form.role === opt.value ? 'text-navy-800' : 'text-gray-700'}`}>
                                {opt.label}
                              </div>
                              <div className="mt-0.5 text-[11px] text-gray-400">{opt.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Name + Company */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="name" className={LABEL}>Full Name</label>
                          <input id="name" type="text" placeholder="John Doe" value={form.name} onChange={handleChange} className={INPUT} required />
                        </div>
                        <div>
                          <label htmlFor={form.role === 'VENDOR' ? 'companyName' : 'organizationName'} className={LABEL}>Company Name</label>
                          <input
                            id={form.role === 'VENDOR' ? 'companyName' : 'organizationName'}
                            type="text"
                            placeholder="Acme Corp"
                            value={form.role === 'VENDOR' ? form.companyName : form.organizationName}
                            onChange={handleChange}
                            className={INPUT}
                            required
                          />
                        </div>
                      </div>

                      {/* Vendor extras */}
                      {form.role === 'VENDOR' && (
                        <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-muted p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-navy-700">Company Details</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="companyEmail" className={LABEL}>Company Email</label>
                              <input id="companyEmail" type="email" placeholder="contact@company.com" value={form.companyEmail} onChange={handleChange} className={INPUT} required />
                            </div>
                            <div>
                              <label htmlFor="companyPhone" className={LABEL}>Phone</label>
                              <input id="companyPhone" type="tel" placeholder="+1 (555) 000-0000" value={form.companyPhone} onChange={handleChange} className={INPUT} required />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="companyAddress" className={LABEL}>Address</label>
                            <input id="companyAddress" type="text" placeholder="123 Corporate Blvd, Suite 100" value={form.companyAddress} onChange={handleChange} className={INPUT} required />
                          </div>
                        </div>
                      )}

                      {/* Email */}
                      <div>
                        <label htmlFor="email" className={LABEL}>Business Email</label>
                        <input id="email" type="email" placeholder="name@company.com" value={form.email} onChange={handleChange} className={INPUT} required />
                      </div>

                      {/* Password */}
                      <div>
                        <label htmlFor="password" className={LABEL}>Password</label>
                        <input id="password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={handleChange} className={INPUT} required minLength={8} />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-brand-green py-3 text-[13px] font-semibold text-white transition-all hover:bg-brand-green-dark disabled:opacity-50"
                      >
                        {loading ? 'Sending verification code…' : 'Continue to Verification'}
                      </button>
                    </form>

                    <p className="mt-6 text-center text-[13px] text-gray-400">
                      Already have an account?{' '}
                      <button onClick={() => switchMode('signin')} className="font-semibold text-navy-800 hover:underline">
                        Sign in
                      </button>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface-muted">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
