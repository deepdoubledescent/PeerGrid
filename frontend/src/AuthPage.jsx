// AuthPage.jsx - Sign In / Sign Up Page with Google OAuth and Email/Password
// MODIFIED: Redirects to /setup/openalex after successful authentication for new users

import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getGoogleLoginUrl,
  exchangeCodeForTokens,
  storeTokens,
  getUserFromIdToken,
  signUpWithEmail,
  signInWithEmail,
  confirmSignUp,
  resendConfirmationCode,
  forgotPassword,
  confirmForgotPassword,
} from "./auth";

export default function AuthPage({ user, setUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const hasExchangedCode = useRef(false);

  // Form states
  const [authMode, setAuthMode] = useState("signin"); // signin, signup, confirm, forgot, reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  
  // NEW: Track if this is a new signup (to redirect to OpenAlex setup)
  const [isNewSignup, setIsNewSignup] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setError(errorDescription || errorParam);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 1. Check the lock before executing
    if (code && !user && !hasExchangedCode.current) {
      hasExchangedCode.current = true; // Set lock immediately
      handleOAuthCallback(code);
    }
  }, [searchParams, user]);

  // NEW: Helper function to determine redirect path based on user state
  const getRedirectPath = (userData) => {
    // If user already has OpenAlex profile or has skipped before, go to projects
    if (!userData?.firstSignOn) {
      return "/projects";
    }
    // Otherwise, go to OpenAlex setup
    return "/setup/openalex";
  };

  const handleOAuthCallback = async (code) => {
    setIsLoading(true);
    setError("");

    try {
      const tokens = await exchangeCodeForTokens(code);
      storeTokens(tokens);
      const userData = await getUserFromIdToken(tokens.id_token, false);
      console.log(userData);

      if (userData) {
        setUser(userData);
        // Clean URL and redirect
        window.history.replaceState({}, document.title, "/");
        // MODIFIED: Redirect based on whether user has OpenAlex profile
        navigate(getRedirectPath(userData));
      } else {
        throw new Error("Failed to get user information");
      }
    } catch (err) {
      console.error("OAuth callback error:", err);
      // 2. Reset the lock ONLY if you want to allow a retry without a page refresh
      // Usually, for OAuth, a failure means the code is dead anyway, so keeping it locked is safer.
      setError(err.message || "Authentication failed. Please try again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError("");
    //console.log(getGoogleLoginUrl());
    window.location.href = getGoogleLoginUrl();
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const result = await signInWithEmail(email, password);
      if (result.user) {
        setUser(result.user);
        // MODIFIED: Redirect based on whether user has OpenAlex profile
        navigate(getRedirectPath(result.user));
      }
    } catch (err) {
      console.error("Sign in error:", err);
      if (err.message.includes("UserNotConfirmedException")) {
        setPendingEmail(email);
        setAuthMode("confirm");
        setError("Please verify your email first.");
      } else {
        setError(err.message || "Sign in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }

    setIsLoading(true);

    try {
      await signUpWithEmail(email, password, firstName.trim(), lastName.trim());
      setPendingEmail(email);
      setIsNewSignup(true); // NEW: Mark as new signup
      setAuthMode("confirm");
      setSuccess("Account created! Please check your email for a verification code.");
    } catch (err) {
      console.error("Sign up error:", err);
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await confirmSignUp(pendingEmail, verificationCode);
      setSuccess("Email verified! You can now sign in.");
      setAuthMode("signin");
      setEmail(pendingEmail);
      setVerificationCode("");
      // Keep isNewSignup flag so that when they sign in, they go to OpenAlex setup
    } catch (err) {
      console.error("Confirmation error:", err);
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await resendConfirmationCode(pendingEmail);
      setSuccess("A new verification code has been sent to your email.");
    } catch (err) {
      console.error("Resend error:", err);
      setError(err.message || "Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setPendingEmail(email);
      setAuthMode("reset");
      setSuccess("Password reset code sent to your email.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.message || "Failed to initiate password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      await confirmForgotPassword(pendingEmail, verificationCode, password);
      setSuccess("Password reset successful! You can now sign in.");
      setAuthMode("signin");
      setEmail(pendingEmail);
      setPassword("");
      setConfirmPassword("");
      setVerificationCode("");
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.message || "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state for OAuth callback
  if (isLoading && searchParams.get("code")) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-loading">
            <div className="auth-spinner"></div>
            <p>Signing you in...</p>
          </div>
        </div>
        <style>{authStyles}</style>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Logo/Brand */}
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img src="/logo.png" alt="Logo" className="auth-logo" />
          </div>
          <h1 className="auth-title">
            {authMode === "signin" && "Welcome back"}
            {authMode === "signup" && "Create account"}
            {authMode === "confirm" && "Verify email"}
            {authMode === "forgot" && "Reset password"}
            {authMode === "reset" && "New password"}
          </h1>
          <p className="auth-subtitle">
            {authMode === "signin" && "Sign in to discover research projects and connect with collaborators"}
            {authMode === "signup" && "Join our community of researchers and innovators"}
            {authMode === "confirm" && `Enter the verification code sent to ${pendingEmail}`}
            {authMode === "forgot" && "Enter your email to receive a password reset code"}
            {authMode === "reset" && "Enter the code from your email and set a new password"}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="auth-message auth-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-message auth-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Sign In Form */}
        {authMode === "signin" && (
          <>
            <form onSubmit={handleEmailSignIn} className="auth-form">
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => setAuthMode("forgot")}
              >
                Forgot password?
              </button>
              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? <span className="auth-btn-spinner"></span> : "Sign in"}
              </button>
            </form>

            <div className="auth-divider">
              <span>or continue with</span>
            </div>

            <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google</span>
            </button>

            <p className="auth-switch">
              Don't have an account?{" "}
              <button type="button" onClick={() => { setAuthMode("signup"); setError(""); setSuccess(""); }}>
                Sign up
              </button>
            </p>

          </>
        )}

        {/* Sign Up Form */}
        {authMode === "signup" && (
          <>
            <form onSubmit={handleEmailSignUp} className="auth-form">
              <div className="auth-name-row">
                <div className="auth-field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    type="text"
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <span className="auth-field-hint">At least 8 characters</span>
              </div>
              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? <span className="auth-btn-spinner"></span> : "Create account"}
              </button>
            </form>

            <div className="auth-divider">
              <span>or continue with</span>
            </div>

            <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google</span>
            </button>

            <p className="auth-switch">
              Already have an account?{" "}
              <button type="button" onClick={() => { setAuthMode("signin"); setError(""); setSuccess(""); }}>
                Sign in
              </button>
            </p>
          </>
        )}

        {/* Confirm Sign Up */}
        {authMode === "confirm" && (
          <>
            <form onSubmit={handleConfirmSignUp} className="auth-form">
              <div className="auth-field">
                <label htmlFor="verificationCode">Verification code</label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  className="auth-code-input"
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? <span className="auth-btn-spinner"></span> : "Verify email"}
              </button>
            </form>

            <button
              type="button"
              className="auth-resend-btn"
              onClick={handleResendCode}
              disabled={isLoading}
            >
              Didn't receive code? Resend
            </button>

            <p className="auth-switch">
              <button type="button" onClick={() => { setAuthMode("signin"); setError(""); setSuccess(""); }}>
                ← Back to sign in
              </button>
            </p>
          </>
        )}

        {/* Forgot Password */}
        {authMode === "forgot" && (
          <>
            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? <span className="auth-btn-spinner"></span> : "Send reset code"}
              </button>
            </form>

            <p className="auth-switch">
              <button type="button" onClick={() => { setAuthMode("signin"); setError(""); setSuccess(""); }}>
                ← Back to sign in
              </button>
            </p>
          </>
        )}

        {/* Reset Password */}
        {authMode === "reset" && (
          <>
            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="auth-field">
                <label htmlFor="verificationCode">Reset code</label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  className="auth-code-input"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="password">New password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <span className="auth-field-hint">At least 8 characters</span>
              </div>
              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? <span className="auth-btn-spinner"></span> : "Reset password"}
              </button>
            </form>

            <p className="auth-switch">
              <button type="button" onClick={() => { setAuthMode("signin"); setError(""); setSuccess(""); }}>
                ← Back to sign in
              </button>
            </p>
          </>
        )}

        {/* Terms */}
        <p className="auth-terms">
          By continuing, you agree to our{" "}
          <a href="/terms" className="auth-link">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" className="auth-link">Privacy Policy</a>
        </p>
      </div>

      <style>{authStyles}</style>
    </div>
  );
}

const authStyles = `
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .auth-container {
    width: 100%;
    max-width: 420px;
    background: #ffffff;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 8px;
    padding: 2.5rem;
    position: relative;
    z-index: 1;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .auth-logo-wrapper {
    width: 60px;
    height: 60px;
    margin: 0 auto 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .auth-logo {
    width: 60px;
    height: 60px;
  }

  .auth-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-secondary, #505e76);
    margin: 0 0 0.5rem 0;
    font-family: 'Playfair Display', serif;
  }

  .auth-subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary, #505e76);
    margin: 0;
    line-height: 1.6;
  }

  .auth-message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .auth-message svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .auth-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  .auth-success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .auth-name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 400px) {
    .auth-name-row {
      grid-template-columns: 1fr;
    }
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .auth-field label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary, #2c2c2c);
  }

  .auth-field input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #ffffff;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 4px;
    font-size: 0.95rem;
    color: var(--text-primary, #2c2c2c);
    transition: all 0.2s ease;
    font-family: inherit;
    box-sizing: border-box;
  }

  .auth-field input::placeholder {
    color: #9ca3af;
  }

  .auth-field input:focus {
    outline: none;
    border-color: var(--accent, #003d82);
    box-shadow: 0 0 0 2px rgba(0, 61, 130, 0.1);
  }

  .auth-field-hint {
    font-size: 0.75rem;
    color: var(--text-secondary, #505e76);
  }

  .auth-code-input {
    text-align: center;
    font-size: 1.5rem !important;
    letter-spacing: 0.5em;
    font-weight: 600;
  }

  .auth-forgot-link {
    align-self: flex-end;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.85rem;
    color: var(--accent, #003d82);
    cursor: pointer;
    transition: color 0.2s;
    font-family: inherit;
    margin-top: -0.5rem;
    text-decoration: underline;
  }

  .auth-forgot-link:hover {
    color: var(--text-primary, #2c2c2c);
  }

  .auth-submit-btn {
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: var(--text-primary, #2c2c2c);
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
  }

  .auth-submit-btn:hover:not(:disabled) {
    background: var(--accent, #003d82);
  }

  .auth-submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .auth-submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .auth-btn-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .auth-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .auth-divider::before,
  .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border, #e5e5e5);
  }

  .auth-divider span {
    font-size: 0.8rem;
    color: var(--text-secondary, #505e76);
    text-transform: lowercase;
  }

  .auth-google-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    background: #ffffff;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-primary, #2c2c2c);
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .auth-google-btn:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .auth-resend-btn {
    width: 100%;
    background: none;
    border: none;
    padding: 0.75rem;
    font-size: 0.9rem;
    color: var(--accent, #003d82);
    cursor: pointer;
    transition: color 0.2s;
    font-family: inherit;
    text-decoration: underline;
  }

  .auth-resend-btn:hover:not(:disabled) {
    color: var(--text-primary, #2c2c2c);
  }

  .auth-resend-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-switch {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-secondary, #505e76);
  }

  .auth-switch button {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    color: var(--accent, #003d82);
    cursor: pointer;
    transition: color 0.2s;
    font-family: inherit;
    font-weight: 500;
    text-decoration: underline;
  }

  .auth-switch button:hover {
    color: var(--text-primary, #2c2c2c);
  }

  .auth-terms {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-secondary, #505e76);
    line-height: 1.6;
  }

  .auth-link {
    color: var(--accent, #003d82);
    text-decoration: none;
    transition: color 0.2s;
  }

  .auth-link:hover {
    color: var(--text-primary, #2c2c2c);
    text-decoration: underline;
  }

  .auth-loading {
    text-align: center;
    padding: 3rem 2rem;
  }

  .auth-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border, #e5e5e5);
    border-top-color: var(--accent, #003d82);
    border-radius: 50%;
    margin: 0 auto 1.5rem;
    animation: spin 0.8s linear infinite;
  }

  .auth-loading p {
    color: var(--text-secondary, #505e76);
    font-size: 0.95rem;
  }

  /* Dev Mode Styles */
  .auth-dev-section {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px dashed var(--border, #e5e5e5);
  }

  .auth-dev-toggle {
    width: 100%;
    background: none;
    border: 1px dashed var(--border, #e5e5e5);
    padding: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #505e76);
    cursor: pointer;
    font-family: inherit;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .auth-dev-toggle:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .auth-dev-options {
    margin-top: 1rem;
  }

  .auth-dev-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #505e76);
    margin-bottom: 0.5rem;
  }

  .auth-dev-select {
    width: 100%;
    padding: 0.625rem 1rem;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    background: white;
  }

  .auth-dev-select:focus {
    outline: none;
    border-color: var(--accent, #003d82);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 480px) {
    .auth-container {
      padding: 2rem 1.5rem;
    }

    .auth-title {
      font-size: 1.5rem;
    }
  }
`;
