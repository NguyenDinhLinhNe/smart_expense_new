import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUser, FaEnvelope, FaLock, FaUserPlus, FaWallet, FaEye, FaEyeSlash } from 'react-icons/fa';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const result = await register({ name, email, password });
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e1a2f] to-[#090d16] flex items-center justify-center p-4 relative overflow-hidden font-body">
      {/* Sleek login background glow */}
      <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(6,182,212,0.15)_0%,rgba(139,92,246,0.05)_50%,transparent_100%)] blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[440px] p-10 rounded-3xl bg-dark-glass border border-dark-border backdrop-blur-2xl shadow-2xl shadow-black/50 animate-fade-in my-8">
        <div className="text-center mb-8">
          <div className="w-[70px] h-[70px] rounded-full bg-gradient-to-br from-cyan-premium to-purple-premium flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-premium/30 text-white text-3xl animate-pulse">
            <FaWallet className="text-2xl drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-wider text-center uppercase bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent font-heading">
            CREATE ACCOUNT
          </h2>
          <p className="text-gray-400 text-sm mt-1">Start tracking your expenses today</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-premium/10 border border-rose-premium/20 rounded-xl text-rose-premium text-xs text-center flex items-center justify-center gap-2">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="group">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Full Name
            </label>
            <div className="relative flex items-center">
              <FaUser className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative flex items-center">
              <FaEnvelope className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative flex items-center">
              <FaLock className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-gray-500 hover:text-cyan-premium transition-colors"
              >
                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>
          </div>

          <div className="group">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <FaLock className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 text-gray-500 hover:text-cyan-premium transition-colors"
              >
                {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 border-none rounded-xl bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-sm tracking-wide shadow-md shadow-cyan-premium/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-premium/44 active:translate-y-0 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <span>CREATE ACCOUNT</span>
                <FaUserPlus className="text-sm" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-dark-border pt-6">
          <p className="text-gray-500 text-xs tracking-wide">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-premium hover:text-cyan-300 font-bold transition-colors">
              SIGN IN
            </Link>
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-widest uppercase">© 2026 Smart Expense Tracker Platform</p>
      </div>
    </div>
  );
};

export default Register;