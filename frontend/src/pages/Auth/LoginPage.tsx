import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../contexts/useAuth";
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/common/Logo';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const submittedEmail = email || String(formData.get("email") ?? "");
    const submittedPassword = password || String(formData.get("password") ?? "");
    const result = await login(submittedEmail, submittedPassword);

    setIsLoading(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex bg-[#f2f2f4] relative overflow-hidden">
      {/* Left Side - Brand Atmosphere */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12">
        <div className="absolute inset-0 bg-[#fdfdfd]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Logo style={{ width: '36px', height: 'auto' }} />
            <span className="text-xl font-medium tracking-tight text-[#0f1012]">BankFlow</span>
          </div>
          <h1 className="text-5xl font-medium text-[#0f1012] tracking-tighter leading-[1.1] mb-6">
            Case<br />Orchestration<br />Platform
          </h1>
          <p className="text-base text-[#8f8f8f] max-w-sm leading-relaxed">
            Streamline operational workflows, manage escalations, and maintain full audit compliance from a single command center.
          </p>
        </div>


      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <Logo style={{ width: '32px', height: 'auto' }} />
            <span className="text-lg font-medium tracking-tight text-[#0f1012]">BankFlow</span>
          </div>

          <div className="rounded-[10px] p-8 relative bg-[#fdfdfd] border border-[#0f1012]/[0.08] shadow-card">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-medium tracking-tight text-[#0f1012] mb-1">
                Welcome back
              </h2>
              <p className="text-[#8f8f8f] text-sm">Sign in to your workspace</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-[10px] bg-[#ffebee] border border-[#b71c1c]/[0.12] text-[#b71c1c] text-sm flex items-center justify-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-normal text-[#8f8f8f] mb-1.5 tracking-wide"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bankflow.local"
                  required
                  className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-4 py-3 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-normal text-[#8f8f8f] mb-1.5 tracking-wide"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-4 py-3 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                />
              </div>

              <div className="flex items-center text-sm">
                <label className="flex items-center gap-2.5 text-[#8f8f8f] cursor-pointer hover:text-[#0f1012] transition-colors group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer appearance-none size-4 rounded bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.12] checked:bg-[#0071e3] checked:border-[#0071e3] transition-all cursor-pointer"
                    />
                    <svg
                      className="absolute size-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none left-0.5 transition-opacity"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className="group-hover:text-[#0f1012] transition-colors text-xs">
                    Remember me
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full h-10 text-sm font-medium rounded-[10px]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#0f1012]/[0.08] text-center">
              <p className="text-[#868788] text-[11px]">
                Default credentials:{" "}
                <span className="text-[#8f8f8f] font-mono">admin@bankflow.local</span>
                {" / "}
                <span className="text-[#8f8f8f] font-mono">admin123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
