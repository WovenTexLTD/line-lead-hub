import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  KeyRound,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  TrendingUp,
  Truck,
  Sparkles,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getRememberMe } from "@/lib/auth-storage";
import { getPasswordResetRedirectUrl } from "@/lib/capacitor";
import logoSvg from "@/assets/logo.svg";
import i18n from "@/i18n/config";

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number");

const passwordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const {
    signIn,
    signUp,
    signOut,
    user,
    profile,
    hasRole,
    isAdminOrHigher,
    loading: authLoading,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Force English on Auth (translations live behind auth)
  useEffect(() => {
    if (i18n.language !== "en") i18n.changeLanguage("en");
    document.documentElement.lang = "en";
    return () => {
      const saved = localStorage.getItem("app-language");
      if (saved && saved !== "en") i18n.changeLanguage(saved);
    };
  }, []);

  const isForcedPasswordReset =
    typeof window !== "undefined" &&
    sessionStorage.getItem("pp_force_password_reset") === "1";

  // Password-reset mode — detect from URL on mount
  const getIsRecoveryMode = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");
    return !!(accessToken && type === "recovery");
  };
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(getIsRecoveryMode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordErrors, setResetPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsPasswordResetMode(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect if already logged in (but not if in password reset mode)
  useEffect(() => {
    if (authLoading) return;
    if (isForcedPasswordReset) return;
    if (!user || isPasswordResetMode) return;

    if (profile?.factory_id) {
      if (hasRole("cutting")) {
        navigate("/cutting/submissions", { replace: true });
        return;
      }
      if (hasRole("storage")) {
        navigate("/storage", { replace: true });
        return;
      }
      if (isAdminOrHigher()) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (hasRole("sewing")) {
        navigate("/sewing/morning-targets", { replace: true });
        return;
      }
      if (hasRole("finishing")) {
        navigate("/finishing/daily-target", { replace: true });
        return;
      }
      if (profile.department === "finishing") {
        navigate("/finishing/daily-target", { replace: true });
        return;
      }
      if (hasRole("worker")) {
        navigate("/sewing/morning-targets", { replace: true });
        return;
      }
      navigate("/", { replace: true });
    } else if (profile && !profile.is_active) {
      toast.error("Account Deactivated", {
        description: "Your account has been deactivated. Please contact your administrator.",
      });
      signOut().catch(console.error);
    } else if (!profile || profile.factory_id === null) {
      navigate("/subscription", { replace: true });
    }
  }, [
    authLoading,
    user,
    profile,
    navigate,
    isPasswordResetMode,
    hasRole,
    isAdminOrHigher,
    isForcedPasswordReset,
    signOut,
  ]);

  // ── Login / signup state ─────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(getRememberMe);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // Deep-link handling
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "success") {
      toast.success("Password updated", {
        description: "Please sign in with your new password.",
      });
    }
    if (params.get("forgot") === "1") {
      setActiveTab("login");
      setForgotPasswordOpen(true);
    }
    if (params.get("reset") === "success" || params.get("forgot") === "1") {
      navigate("/auth", { replace: true });
    }
  }, [location.search, navigate]);

  // Live password-strength checks for signup + reset
  const passwordChecks = useMemo(() => {
    const v = activeTab === "signup" ? signupPassword : newPassword;
    return {
      length: v.length >= 8,
      lower: /[a-z]/.test(v),
      upper: /[A-Z]/.test(v),
      digit: /[0-9]/.test(v),
    };
  }, [activeTab, signupPassword, newPassword]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !forgotPasswordEmail ||
      !z.string().email().safeParse(forgotPasswordEmail).success
    ) {
      toast.error("Invalid email", {
        description: "Please enter a valid email address.",
      });
      return;
    }
    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    setForgotPasswordLoading(false);
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      toast.success("Check your email", {
        description: "We've sent you a password reset link.",
      });
      setForgotPasswordOpen(false);
      setForgotPasswordEmail("");
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordErrors({});
    try {
      passwordSchema.parse({
        password: newPassword,
        confirmPassword: confirmNewPassword,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setResetPasswordErrors(errors);
        return;
      }
    }
    setResetPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setResetPasswordLoading(false);
    if (error) {
      toast.error("Error updating password", { description: error.message });
    } else {
      toast.success("Password updated!", {
        description: "Your password has been successfully updated.",
      });
      setIsPasswordResetMode(false);
      setNewPassword("");
      setConfirmNewPassword("");
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/", { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setLoginErrors(errors);
        return;
      }
    }
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword, rememberMe);
    setIsLoading(false);
    if (error) {
      toast.error("Login failed", {
        description:
          error.message === "Invalid login credentials"
            ? "Invalid email or password. Please try again."
            : error.message,
      });
    } else {
      toast.success("Welcome back!", {
        description: "You have successfully logged in.",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});
    try {
      signupSchema.parse({
        fullName: signupName,
        email: signupEmail,
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setSignupErrors(errors);
        return;
      }
    }
    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Account exists", {
          description:
            "An account with this email already exists. Please log in instead.",
        });
        setActiveTab("login");
        setLoginEmail(signupEmail);
      } else {
        toast.error("Signup failed", { description: error.message });
      }
    } else {
      toast.success("Account created!", {
        description: "Welcome to ProductionPortal.",
      });
      navigate("/subscription");
    }
  };

  return (
    <div
      className="min-h-dvh flex bg-background"
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      }}
    >
      {/* ── Left brand panel — hidden below lg ───────────────────────── */}
      <BrandPanel />

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12 bg-background relative overflow-hidden">
        {/* Subtle mobile-only ambient gradient */}
        <div
          aria-hidden
          className="lg:hidden absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-50/60 via-violet-50/30 to-transparent dark:from-indigo-950/40 dark:via-violet-950/20 pointer-events-none"
        />

        <div className="relative w-full max-w-md space-y-6">
          {/* Mobile logo (hidden on lg, the brand panel handles it there) */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <img src={logoSvg} alt="" className="h-7 w-7 brightness-0 invert" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">ProductionPortal</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                by WovenTex
              </p>
            </div>
          </div>

          {isPasswordResetMode ? (
            // ── Reset mode ──────────────────────────────────────────
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                  <KeyRound className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Set a new password
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose something secure you'll remember.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <FieldWithIcon
                  id="new-password"
                  label="New Password"
                  icon={Lock}
                  type={showResetPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={setNewPassword}
                  disabled={resetPasswordLoading}
                  error={resetPasswordErrors.password}
                  trailing={
                    <PasswordToggle
                      show={showResetPassword}
                      onToggle={() => setShowResetPassword((s) => !s)}
                    />
                  }
                />
                <PasswordChecklist checks={passwordChecks} value={newPassword} />
                <FieldWithIcon
                  id="confirm-new-password"
                  label="Confirm New Password"
                  icon={Lock}
                  type={showResetPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  disabled={resetPasswordLoading}
                  error={resetPasswordErrors.confirmPassword}
                />
                <Button
                  type="submit"
                  className="w-full h-11 gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25 text-white"
                  disabled={resetPasswordLoading}
                >
                  {resetPasswordLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Update Password
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsPasswordResetMode(false);
                    window.history.replaceState(null, "", window.location.pathname);
                  }}
                >
                  Back to login
                </Button>
              </form>
            </div>
          ) : (
            // ── Login + Signup ───────────────────────────────────────
            <div className="space-y-6 animate-fade-in">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {activeTab === "login" ? "Welcome back." : "Create your account."}
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {activeTab === "login"
                    ? "Sign in to continue managing your production floor."
                    : "Start tracking output, QC, and dispatches in minutes."}
                </p>
              </div>

              {/* Segmented control */}
              <div className="grid grid-cols-2 p-1 rounded-lg bg-muted/60 border border-border/50 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className={cn(
                    "py-2 text-sm font-semibold rounded-md transition-all",
                    activeTab === "login"
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className={cn(
                    "py-2 text-sm font-semibold rounded-md transition-all",
                    activeTab === "signup"
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sign Up
                </button>
              </div>

              {activeTab === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <FieldWithIcon
                    id="login-email"
                    label="Email"
                    icon={Mail}
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={setLoginEmail}
                    disabled={isLoading}
                    error={loginErrors.email}
                  />
                  <FieldWithIcon
                    id="login-password"
                    label="Password"
                    icon={Lock}
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    disabled={isLoading}
                    error={loginErrors.password}
                    trailing={
                      <PasswordToggle
                        show={showLoginPassword}
                        onToggle={() => setShowLoginPassword((s) => !s)}
                      />
                    }
                  />

                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="remember-me"
                      className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(c) => setRememberMe(c === true)}
                        disabled={isLoading}
                      />
                      Remember me
                    </label>

                    <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="link"
                          type="button"
                          className="px-0 h-auto text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                        >
                          Forgot password?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <div className="flex items-start gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                              <KeyRound className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <DialogTitle>Reset password</DialogTitle>
                              <DialogDescription className="mt-1">
                                Enter your email and we'll send you a reset link.
                              </DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                          <FieldWithIcon
                            id="forgot-email"
                            label="Email"
                            icon={Mail}
                            type="email"
                            autoComplete="username"
                            placeholder="you@example.com"
                            value={forgotPasswordEmail}
                            onChange={setForgotPasswordEmail}
                            disabled={forgotPasswordLoading}
                          />
                          <Button
                            type="submit"
                            className="w-full h-11 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-md shadow-indigo-500/25 text-white"
                            disabled={forgotPasswordLoading}
                          >
                            {forgotPasswordLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                Send reset link
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-lg shadow-indigo-500/30 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <FieldWithIcon
                    id="signup-name"
                    label="Full Name"
                    icon={UserIcon}
                    type="text"
                    autoComplete="name"
                    placeholder="John Doe"
                    value={signupName}
                    onChange={setSignupName}
                    disabled={isLoading}
                    error={signupErrors.fullName}
                  />
                  <FieldWithIcon
                    id="signup-email"
                    label="Email"
                    icon={Mail}
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={setSignupEmail}
                    disabled={isLoading}
                    error={signupErrors.email}
                  />
                  <FieldWithIcon
                    id="signup-password"
                    label="Password"
                    icon={Lock}
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Choose a password"
                    value={signupPassword}
                    onChange={setSignupPassword}
                    disabled={isLoading}
                    error={signupErrors.password}
                    trailing={
                      <PasswordToggle
                        show={showSignupPassword}
                        onToggle={() => setShowSignupPassword((s) => !s)}
                      />
                    }
                  />
                  <PasswordChecklist checks={passwordChecks} value={signupPassword} />
                  <FieldWithIcon
                    id="signup-confirm"
                    label="Confirm Password"
                    icon={Lock}
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={signupConfirmPassword}
                    onChange={setSignupConfirmPassword}
                    disabled={isLoading}
                    error={signupErrors.confirmPassword}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-lg shadow-indigo-500/30 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              <p className="text-center text-[11px] text-muted-foreground pt-2">
                By continuing, you agree to our{" "}
                <span className="underline-offset-2 hover:underline cursor-pointer">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="underline-offset-2 hover:underline cursor-pointer">
                  Privacy Policy
                </span>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Brand panel (desktop only) ───────────────────────────────────────

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-900 text-white">
      {/* Decorative blurs */}
      <div
        aria-hidden
        className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-amber-400/20 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none"
      />
      {/* Dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 flex items-center justify-center">
            <img src={logoSvg} alt="" className="h-7 w-7 brightness-0 invert" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight leading-tight">
              ProductionPortal
            </p>
            <p className="text-[11px] text-white/60 leading-tight uppercase tracking-[0.14em]">
              by WovenTex
            </p>
          </div>
        </div>

        {/* Headline + floating stat cards */}
        <div className="space-y-10">
          <div>
            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight leading-[1.1] text-balance">
              Run your factory floor in real time.
            </h2>
            <p className="text-base text-white/70 mt-4 max-w-md leading-relaxed">
              Daily output, QC sign-offs, dispatches and team workflows — one
              source of truth from the first stitch to the loading bay.
            </p>
          </div>

          <div className="space-y-3 max-w-sm">
            <FloatingStat
              icon={TrendingUp}
              label="Today's sewing output"
              value="12,450 pcs"
              sub="+8.2% vs yesterday"
              tone="emerald"
            />
            <FloatingStat
              icon={ShieldCheck}
              label="QC pass rate"
              value="97.2%"
              sub="3-day clean streak"
              tone="blue"
              offset="2.5rem"
            />
            <FloatingStat
              icon={Truck}
              label="Ready to ship"
              value="3,800 pcs"
              sub="Across 4 active POs"
              tone="amber"
              offset="1.25rem"
            />
          </div>
        </div>

        {/* Bottom value props */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/70">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Mobile-first
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Real-time updates
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Audit-ready PDFs
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Multi-line
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  offset,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "blue" | "amber";
  offset?: string;
}) {
  const palette = {
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/40",
    blue: "from-blue-500 to-indigo-600 shadow-blue-500/40",
    amber: "from-amber-500 to-orange-500 shadow-amber-500/40",
  }[tone];

  return (
    <div
      style={offset ? { marginLeft: offset } : undefined}
      className="rounded-xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 p-3.5 flex items-center gap-3 hover:bg-white/15 transition-colors"
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shadow-lg shrink-0 bg-gradient-to-br",
          palette
        )}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-white/60">
          {label}
        </p>
        <p className="font-mono text-lg font-bold tabular-nums leading-none mt-0.5">
          {value}
        </p>
        <p className="text-[11px] text-white/70 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ── Form helpers ─────────────────────────────────────────────────────

function FieldWithIcon({
  id,
  label,
  icon: Icon,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  trailing,
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  type: string;
  autoComplete?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 pl-10 pr-3 transition-shadow",
            trailing && "pr-11",
            error && "border-destructive focus-visible:ring-destructive/30"
          )}
          disabled={disabled}
        />
        {trailing && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <X className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      className="h-9 w-9 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      tabIndex={-1}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function PasswordChecklist({
  checks,
  value,
}: {
  checks: { length: boolean; lower: boolean; upper: boolean; digit: boolean };
  value: string;
}) {
  // Only render once the user has started typing — keeps the form clean.
  if (!value) return null;
  const items: Array<[boolean, string]> = [
    [checks.length, "8+ characters"],
    [checks.upper, "Uppercase letter"],
    [checks.lower, "Lowercase letter"],
    [checks.digit, "Number"],
  ];
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {items.map(([ok, label]) => (
        <div
          key={label}
          className={cn(
            "flex items-center gap-1.5 text-[11px] transition-colors",
            ok ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
          )}
        >
          {ok ? (
            <Check className="h-3 w-3 shrink-0" />
          ) : (
            <X className="h-3 w-3 shrink-0 opacity-50" />
          )}
          {label}
        </div>
      ))}
    </div>
  );
}
