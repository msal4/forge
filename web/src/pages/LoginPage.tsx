import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';

// ============================================
// Login Page - Smart Login with @sarray.de
// ============================================

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Redirect to home on success
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-parchment-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-inscription text-4xl text-lapis-600 flex items-center justify-center gap-3">
            <span className="text-5xl">𒀭</span>
            Sarray Forge
          </h1>
          <p className="text-lapis-500 mt-2">Enter the ancient workshop</p>
        </div>
        
        {/* Login Card */}
        <div className="tablet-card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-lapis-600 mb-2">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="zahra"
                  className="forge-input pr-24"
                  autoComplete="username"
                  autoFocus
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lapis-400 text-sm">
                  @sarray.de
                </span>
              </div>
              <p className="mt-1 text-xs text-lapis-500">
                Just enter your username - we'll add @sarray.de automatically
              </p>
            </div>
            
            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-lapis-600 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="forge-input"
                autoComplete="current-password"
                required
              />
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-clay-100 border border-clay-300 rounded-tablet text-clay-700 text-sm">
                {error}
              </div>
            )}
            
            {/* Submit Button */}
            <ButtonWithHotkey
              type="submit"
              variant="primary"
              size="lg"
              hotkey="Enter"
              disabled={loading}
              className="w-full justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Entering...
                </>
              ) : (
                'Enter the Forge'
              )}
            </ButtonWithHotkey>
          </form>
          
          {/* Demo hint */}
          <div className="mt-6 pt-6 border-t border-parchment-300 text-center">
            <p className="text-xs text-lapis-500">
              Demo: Use username <code className="px-1 bg-parchment-200 rounded">zahra</code> with password <code className="px-1 bg-parchment-200 rounded">forge</code>
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-lapis-400 mt-6">
          Sarray Forge v0.1.0 - Internal ALM Tool
        </p>
      </div>
    </div>
  );
}
