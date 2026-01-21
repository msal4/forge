import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

// ============================================
// Login Page - Clay Tablet Design
// Modern Mesopotamian aesthetic with lapis & sand
// ============================================

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  
  const usernameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Auto-focus username input on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Clear error when user types
  useEffect(() => {
    if (error) setError('');
  }, [username, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Success - redirect to home
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-parchment-200 via-parchment-100 to-parchment-200 flex items-center justify-center p-4">
      {/* Background pattern - subtle cuneiform-inspired texture */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a365d' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Cuneiform symbol header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-lapis-500 shadow-lg mb-4">
            <span className="text-4xl text-parchment-100 font-inscription">𒀭</span>
          </div>
          <h1 className="font-inscription text-4xl text-lapis-600 tracking-tight">
            Sarray Forge
          </h1>
          <p className="text-lapis-500 mt-2 font-body">
            Enter the ancient workshop
          </p>
        </div>

        {/* Clay Tablet Login Card */}
        <div 
          className="
            relative overflow-hidden
            bg-gradient-to-b from-parchment-50 to-parchment-100
            border-2 border-parchment-300
            rounded-2xl
            shadow-[0_8px_32px_-8px_rgba(26,54,93,0.2),0_0_0_1px_rgba(26,54,93,0.05)]
            animate-slide-up
          "
        >
          {/* Decorative top edge - like clay tablet carving */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-clay-400 to-transparent opacity-60" />
          
          {/* Inner shadow for depth */}
          <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] pointer-events-none rounded-2xl" />

          <div className="relative p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username Field */}
              <div>
                <label 
                  htmlFor="username" 
                  className={`
                    block text-sm font-medium mb-2 transition-colors duration-200
                    ${focusedField === 'username' ? 'text-lapis-600' : 'text-lapis-500'}
                  `}
                >
                  Username
                </label>
                <div className="relative">
                  <input
                    ref={usernameRef}
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={handleKeyDown}
                    placeholder="zahra"
                    autoComplete="username"
                    disabled={loading}
                    className={`
                      w-full px-4 py-3 pr-28
                      bg-parchment-50 
                      border-2 rounded-xl
                      text-lapis-700 placeholder-lapis-400
                      font-body text-base
                      transition-all duration-200
                      focus:outline-none
                      disabled:opacity-60 disabled:cursor-not-allowed
                      ${focusedField === 'username' 
                        ? 'border-lapis-400 shadow-[0_0_0_3px_rgba(26,54,93,0.1)]' 
                        : 'border-parchment-300 hover:border-parchment-400'
                      }
                      ${error ? 'border-clay-400' : ''}
                    `}
                  />
                  {/* Domain suffix */}
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lapis-400 text-sm font-medium pointer-events-none">
                    @sarray.de
                  </span>
                </div>
                <p className="mt-2 text-xs text-lapis-400">
                  Just enter your username — we'll add the domain
                </p>
              </div>

              {/* Password Field */}
              <div>
                <label 
                  htmlFor="password" 
                  className={`
                    block text-sm font-medium mb-2 transition-colors duration-200
                    ${focusedField === 'password' ? 'text-lapis-600' : 'text-lapis-500'}
                  `}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={handleKeyDown}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    className={`
                      w-full px-4 py-3 pr-12
                      bg-parchment-50 
                      border-2 rounded-xl
                      text-lapis-700 placeholder-lapis-400
                      font-body text-base
                      transition-all duration-200
                      focus:outline-none
                      disabled:opacity-60 disabled:cursor-not-allowed
                      ${focusedField === 'password' 
                        ? 'border-lapis-400 shadow-[0_0_0_3px_rgba(26,54,93,0.1)]' 
                        : 'border-parchment-300 hover:border-parchment-400'
                      }
                      ${error ? 'border-clay-400' : ''}
                    `}
                  />
                  {/* Toggle password visibility */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="
                      absolute right-3 top-1/2 -translate-y-1/2
                      p-1 rounded-lg
                      text-lapis-400 hover:text-lapis-600
                      hover:bg-parchment-200
                      transition-colors duration-150
                      focus:outline-none focus:ring-2 focus:ring-lapis-400
                      disabled:opacity-50
                    "
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-clay-50 border border-clay-200 rounded-xl animate-scale-in">
                  <AlertCircle className="w-5 h-5 text-clay-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-clay-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className={`
                  w-full py-3.5 px-6
                  flex items-center justify-center gap-2
                  bg-gradient-to-b from-lapis-500 to-lapis-600
                  hover:from-lapis-600 hover:to-lapis-700
                  active:from-lapis-700 active:to-lapis-800
                  text-parchment-100 font-medium text-base
                  rounded-xl
                  shadow-[0_2px_8px_-2px_rgba(26,54,93,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
                  hover:shadow-[0_4px_12px_-2px_rgba(26,54,93,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-lapis-400 focus:ring-offset-2 focus:ring-offset-parchment-100
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-lapis-500 disabled:hover:to-lapis-600
                `}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Entering the Forge...</span>
                  </>
                ) : (
                  <>
                    <span>Enter the Forge</span>
                    <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-lapis-400/30 rounded border border-lapis-400/50">
                      ↵
                    </kbd>
                  </>
                )}
              </button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-8 pt-6 border-t border-parchment-300">
              <div className="text-center">
                <p className="text-xs text-lapis-500 mb-3">Demo Credentials</p>
                <div className="inline-flex items-center gap-4 px-4 py-2 bg-parchment-200/50 rounded-lg">
                  <div className="text-left">
                    <span className="text-xs text-lapis-400 block">Username</span>
                    <code className="text-sm text-lapis-600 font-code">zahra</code>
                  </div>
                  <div className="w-px h-8 bg-parchment-300" />
                  <div className="text-left">
                    <span className="text-xs text-lapis-400 block">Password</span>
                    <code className="text-sm text-lapis-600 font-code">admin</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative bottom edge */}
          <div className="h-1 bg-gradient-to-r from-transparent via-lapis-400 to-transparent opacity-30" />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-lapis-400 mt-6">
          Sarray Forge v0.1.0 — Internal ALM Tool
        </p>
      </div>
    </div>
  );
}
