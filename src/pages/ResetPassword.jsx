import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

/**
 * ResetPassword.jsx
 * -------------------------------------------------------------------------
 * The page a user lands on after clicking the reset link from their email.
 * Route suggestion:  /reset-password/:token
 *
 * Backend contract expected (adjust to match your actual routes):
 *   POST /api/auth/reset-password/:token   body: { password }
 *     -> 200 { message }               on success
 *     -> 400/410 { message }           expired or invalid token
 *     -> 429 { message }               rate limited
 *
 * Uses argon2-hashed passwords server-side (per VitaCore's auth stack),
 * so the only client-side job is collecting a strong password and
 * confirming it before sending it over HTTPS.
 * -------------------------------------------------------------------------
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ---- password strength -----------------------------------------------

function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4); // 0..4
}

const STRENGTH_META = [
  { label: "Too weak", color: "#C1443C" },
  { label: "Weak", color: "#C1443C" },
  { label: "Okay", color: "#D9A441" },
  { label: "Strong", color: "#4A7C59" },
  { label: "Very strong", color: "#2F5D3A" },
];

// ---- component ----------------------------------------------------------

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("form"); // form | success | invalid-token | error
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const meta = STRENGTH_META[strength];

  const rules = useMemo(
    () => ({
      length: password.length >= 8,
      case: /[a-z]/.test(password) && /[A-Z]/.test(password),
      number: /\d/.test(password),
    }),
    [password]
  );

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSubmit =
    rules.length && rules.case && rules.number && passwordsMatch && !submitting;

  // Optional: verify the token is still valid as soon as the page loads,
  // so a dead link fails fast instead of after the user types a password.
  useEffect(() => {
    if (!token) {
      setStatus("invalid-token");
      setErrorMsg("This reset link is missing its token.");
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/auth/reset-password/${token}/verify`)
      .then((res) => {
        if (!cancelled && !res.ok) {
          setStatus("invalid-token");
          setErrorMsg(
            res.status === 410
              ? "This reset link has expired. Request a new one to continue."
              : "This reset link is invalid. Request a new one to continue."
          );
        }
      })
      .catch(() => {
        // If the verify endpoint isn't available, fail open — the real
        // POST below still enforces token validity server-side.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus("success");
        setTimeout(() => navigate("/login"), 2200);
      } else if (res.status === 400 || res.status === 410) {
        setStatus("invalid-token");
        setErrorMsg(data.message || "This reset link is invalid or has expired.");
      } else if (res.status === 429) {
        setErrorMsg(data.message || "Too many attempts. Try again in a few minutes.");
      } else {
        setErrorMsg(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] flex flex-col md:flex-row">
      {/* Brand panel — hidden on mobile, present on md+ */}
      <div className="hidden md:flex md:w-2/5 lg:w-1/3 relative overflow-hidden bg-[#2F5D3A]">
        <div className="absolute inset-0 opacity-[0.14]">
          <LeafPattern />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-10 lg:p-12 text-[#FAF7F2] w-full">
          <Link to="/" className="font-serif text-2xl tracking-tight">
            VitaCore
          </Link>
          <div className="space-y-4 max-w-xs">
            <h2 className="font-serif text-3xl lg:text-[2.25rem] leading-[1.15]">
              A fresh dose of access.
            </h2>
            <p className="text-[#E7E2D6]/85 text-[0.95rem] leading-relaxed">
              Set a new password to get back into your account and pick up your
              wellness routine where you left off.
            </p>
          </div>
          <p className="text-xs text-[#E7E2D6]/60">
            Having trouble?{" "}
            <a href="mailto:support@vitacore.ng" className="underline underline-offset-2">
              support@vitacore.ng
            </a>
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-5 pt-6 pb-2">
          <Link to="/" className="font-serif text-xl text-[#2F5D3A] tracking-tight">
            VitaCore
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-sm">
            {status === "form" && (
              <FormView
                password={password}
                setPassword={setPassword}
                confirm={confirm}
                setConfirm={setConfirm}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                showConfirm={showConfirm}
                setShowConfirm={setShowConfirm}
                rules={rules}
                passwordsMatch={passwordsMatch}
                touched={touched}
                strength={strength}
                meta={meta}
                submitting={submitting}
                canSubmit={canSubmit}
                errorMsg={errorMsg}
                onSubmit={handleSubmit}
              />
            )}

            {status === "success" && <SuccessView />}

            {status === "invalid-token" && <InvalidTokenView message={errorMsg} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- sub-views ------------------------------------------------------------

function FormView({
  password,
  setPassword,
  confirm,
  setConfirm,
  showPassword,
  setShowPassword,
  showConfirm,
  setShowConfirm,
  rules,
  passwordsMatch,
  touched,
  strength,
  meta,
  submitting,
  canSubmit,
  errorMsg,
  onSubmit,
}) {
  return (
    <>
      <header className="mb-7">
        <h1 className="font-serif text-[1.65rem] sm:text-3xl text-[#2B2B28] leading-tight">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-[#6B6A63] leading-relaxed">
          Choose something strong and memorable. You'll use it the next time
          you sign in.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {/* New password */}
        <div>
          <label
            htmlFor="password"
            className="block text-[0.8rem] font-medium text-[#2B2B28] mb-1.5"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full rounded-xl border border-[#DED8C8] bg-white px-4 py-3 pr-11 text-[0.95rem] text-[#2B2B28] placeholder-[#A8A498] outline-none transition focus:border-[#4A7C59] focus:ring-2 focus:ring-[#4A7C59]/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8779] hover:text-[#2B2B28] transition"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>

          {/* Strength meter — styled like a dosage bar */}
          {password.length > 0 && (
            <div className="mt-2.5">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                    style={{
                      backgroundColor: i < strength ? meta.color : "#E7E2D6",
                    }}
                  />
                ))}
              </div>
              <p
                className="mt-1.5 text-xs font-medium"
                style={{ color: meta.color }}
              >
                {meta.label}
              </p>
            </div>
          )}

          {/* Rule checklist */}
          <ul className="mt-3 space-y-1">
            <RuleItem ok={rules.length} label="At least 8 characters" />
            <RuleItem ok={rules.case} label="Upper and lowercase letters" />
            <RuleItem ok={rules.number} label="At least one number" />
          </ul>
        </div>

        {/* Confirm password */}
        <div>
          <label
            htmlFor="confirm"
            className="block text-[0.8rem] font-medium text-[#2B2B28] mb-1.5"
          >
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirm"
              name="confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              className={`w-full rounded-xl border bg-white px-4 py-3 pr-11 text-[0.95rem] text-[#2B2B28] placeholder-[#A8A498] outline-none transition focus:ring-2 ${
                touched && confirm.length > 0 && !passwordsMatch
                  ? "border-[#C1443C] focus:border-[#C1443C] focus:ring-[#C1443C]/15"
                  : "border-[#DED8C8] focus:border-[#4A7C59] focus:ring-[#4A7C59]/20"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8779] hover:text-[#2B2B28] transition"
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {touched && confirm.length > 0 && !passwordsMatch && (
            <p className="mt-1.5 text-xs text-[#C1443C]">Passwords don't match</p>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-[#C1443C]/8 border border-[#C1443C]/20 px-4 py-3 text-sm text-[#8A2F28]">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-[#2F5D3A] py-3.5 text-[0.95rem] font-medium text-[#FAF7F2] transition hover:bg-[#264C30] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Updating password…
            </span>
          ) : (
            "Update password"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B6A63]">
        Remembered it?{" "}
        <Link to="/login" className="font-medium text-[#2F5D3A] hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

function SuccessView() {
  return (
    <div className="text-center py-4">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#4A7C59]/12">
        <CheckIcon />
      </div>
      <h1 className="font-serif text-2xl text-[#2B2B28] mb-2">
        Password updated
      </h1>
      <p className="text-sm text-[#6B6A63] leading-relaxed mb-6">
        Your password has been changed. Taking you to sign in…
      </p>
      <Link
        to="/login"
        className="inline-block w-full rounded-xl bg-[#2F5D3A] py-3.5 text-[0.95rem] font-medium text-[#FAF7F2] transition hover:bg-[#264C30]"
      >
        Go to sign in now
      </Link>
    </div>
  );
}

function InvalidTokenView({ message }) {
  return (
    <div className="text-center py-4">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#C1443C]/10">
        <AlertIcon />
      </div>
      <h1 className="font-serif text-2xl text-[#2B2B28] mb-2">
        Link expired
      </h1>
      <p className="text-sm text-[#6B6A63] leading-relaxed mb-6">
        {message || "This password reset link is no longer valid."}
      </p>
      <Link
        to="/forgot-password"
        className="inline-block w-full rounded-xl bg-[#2F5D3A] py-3.5 text-[0.95rem] font-medium text-[#FAF7F2] transition hover:bg-[#264C30]"
      >
        Request a new link
      </Link>
      <Link
        to="/login"
        className="mt-3 inline-block text-sm text-[#6B6A63] hover:text-[#2B2B28] hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}

// ---- small pieces ---------------------------------------------------------

function RuleItem({ ok, label }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors ${
          ok ? "bg-[#4A7C59]" : "bg-[#E7E2D6]"
        }`}
      >
        {ok && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1 4L3 6L7 2"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className={ok ? "text-[#4A7C59]" : "text-[#8B8779]"}>{label}</span>
    </li>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.36 5.11A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.3 13.3 0 0 1-3.17 4.06M6.6 6.6C4.14 8.14 2 12 2 12a13.3 13.3 0 0 0 5.06 5.94"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 13l4 4L19 7"
        stroke="#2F5D3A"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        stroke="#C1443C"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LeafPattern() {
  // Subtle repeating leaf motif for the brand panel background.
  return (
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern
          id="leaf"
          x="0"
          y="0"
          width="120"
          height="120"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M60 20c15 5 25 20 20 40-15-2-30-15-32-32 4-4 8-6 12-8Z"
            fill="#FAF7F2"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaf)" />
    </svg>
  );
}