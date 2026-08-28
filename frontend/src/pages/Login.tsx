import { useState } from 'react';
import { api, API_BASE } from '../services/api';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = () => {
    // Redirect to backend Google OAuth start endpoint
    window.location.href = `${API_BASE}/auth/google`;
  };

  const handleMockLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email ID is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.mockLogin(email);
      // Success: redirect to scheduled page
      window.location.href = '/scheduled';
    } catch (err: any) {
      setError(err.message || 'Mock login failed');
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest h-screen w-screen flex items-center justify-center m-0 p-0 overflow-hidden font-body-md">
      {/* Login Card */}
      <main 
        className="w-full max-w-[420px] bg-surface-container-lowest border border-[#E5E7EB] rounded-xl p-8 flex flex-col items-center mx-4 relative z-10" 
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}
      >
        <h1 className="font-headline-lg text-[28px] leading-[36px] font-semibold text-on-surface mb-8">Login</h1>
        
        {/* Google Login Button */}
        <button 
          onClick={handleGoogleLogin}
          className="w-full h-10 bg-[#E8F7EF] hover:bg-[#D4EED8] transition-colors duration-200 rounded-lg flex items-center justify-center gap-2 mb-6 border border-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          <span className="font-label-md text-on-surface">Login with Google</span>
        </button>
        
        {/* Divider */}
        <div className="w-full flex items-center gap-4 mb-6">
          <div className="flex-1 h-[1px] bg-surface-variant"></div>
          <span className="font-meta-data text-on-surface-variant text-[10px] uppercase tracking-wider">or sign up through email</span>
          <div className="flex-1 h-[1px] bg-surface-variant"></div>
        </div>

        {/* Display Error Message */}
        {error && (
          <div className="w-full text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="w-full flex flex-col gap-4" onSubmit={handleMockLogin}>
          <div className="flex flex-col gap-1">
            <input 
              className="w-full h-10 px-3 bg-[#F4F7F5] border border-transparent focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 rounded-lg font-body-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all outline-none" 
              placeholder="Email ID" 
              required 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 mb-2">
            <input 
              className="w-full h-10 px-3 bg-[#F4F7F5] border border-transparent focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 rounded-lg font-body-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all outline-none" 
              placeholder="Password" 
              required 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            className="w-full h-10 bg-primary-container hover:bg-[#009650] active:scale-[0.98] transition-all duration-200 rounded-lg font-label-md text-white flex items-center justify-center disabled:opacity-50" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </main>
    </div>
  );
};
