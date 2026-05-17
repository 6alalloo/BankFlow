import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui';

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

    const result = await login(email, password);

    setIsLoading(false);

    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#040506] relative overflow-hidden">
      {/* Background Atmosphere */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{
          background:
            'radial-gradient(84.6% 73.49% at 50% 26.51%, rgba(4, 63, 150, 0.25), rgba(6, 18, 37, 0))',
        }}
      />

      <div className="w-full max-w-sm p-8 rounded-2xl bg-[#07080a] border border-white/[0.08] shadow-xl relative z-10 m-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            BankFlow
          </h1>
          <p className="text-[#9c9c9d] text-sm">Case Orchestration Platform</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[#452324]/40 border border-[#ff6363]/20 text-[#ff6363] text-sm flex items-center justify-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[#9c9c9d] mb-1.5"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@bankflow.local"
              required
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#9c9c9d] mb-1.5"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
            />
          </div>

          <div className="flex items-center text-sm">
            <label className="flex items-center gap-2 text-[#9c9c9d] cursor-pointer hover:text-white transition-colors group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  className="peer appearance-none size-4 rounded bg-white/5 border border-white/10 checked:bg-white checked:border-white transition-all cursor-pointer"
                />
                <svg
                  className="absolute size-3 text-[#040506] opacity-0 peer-checked:opacity-100 pointer-events-none left-0.5 transition-opacity"
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
              <span className="group-hover:text-white transition-colors">
                Remember me
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full h-10 text-sm font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="size-4 border-2 border-[#2f3031]/30 border-t-[#2f3031] rounded-full animate-spin" />
                <span>Signing in</span>
              </div>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/[0.08] text-center">
          <p className="text-[#6a6b6c] text-xs">
            Default credentials:{" "}
            <span className="text-[#9c9c9d] font-mono">admin@bankflow.local</span>{" "}
            /{" "}
            <span className="text-[#9c9c9d] font-mono">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
