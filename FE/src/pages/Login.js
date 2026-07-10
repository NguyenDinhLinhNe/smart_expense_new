import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaEnvelope, FaLock, FaSignInAlt, FaWallet, FaEye, FaEyeSlash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { resetPassword } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password flow states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResetLoading(true);
    try {
      const response = await resetPassword(resetEmail, newPassword);
      toast.success(response.data.message || 'Password reset successfully!');
      setIsForgotPassword(false);
      setEmail(resetEmail); // auto-populate email in login form
      setResetEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e1a2f] to-[#090d16] flex items-center justify-center p-4 relative overflow-hidden font-body perspective-3d">
      {/* Sleek login background glow */}
      <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(6,182,212,0.15)_0%,rgba(139,92,246,0.05)_50%,transparent_100%)] blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"></div>

      {/* Vật thể trang trí 3D số 1: Khối lập phương Neon Cyan xoay */}
      <div className="absolute left-[10%] top-[20%] hidden md:block animate-float-3d pointer-events-none z-0">
        <div className="cube-container">
          <div className="cube-3d">
            <div className="cube-face cube-face-front"></div>
            <div className="cube-face cube-face-back"></div>
            <div className="cube-face cube-face-right"></div>
            <div className="cube-face cube-face-left"></div>
            <div className="cube-face cube-face-top"></div>
            <div className="cube-face cube-face-bottom"></div>
          </div>
        </div>
      </div>

      {/* Vật thể trang trí 3D số 2: Khối lập phương Tím lơ lửng ở góc dưới phải */}
      <div className="absolute right-[12%] bottom-[20%] hidden md:block animate-float-3d-delayed pointer-events-none z-0">
        <div className="cube-container" style={{ filter: 'hue-rotate(60deg)' }}>
          <div className="cube-3d" style={{ animationDuration: '15s' }}>
            <div className="cube-face cube-face-front"></div>
            <div className="cube-face cube-face-back"></div>
            <div className="cube-face cube-face-right"></div>
            <div className="cube-face cube-face-left"></div>
            <div className="cube-face cube-face-top"></div>
            <div className="cube-face cube-face-bottom"></div>
          </div>
        </div>
      </div>

      {/* Login Card sử dụng hiệu ứng 3D Tilt */}
      <div className="relative z-10 w-full max-w-[440px] p-10 rounded-3xl bg-dark-glass border border-dark-border backdrop-blur-2xl shadow-2xl tilt-card-3d animate-fade-in">
        <div className="text-center mb-8 preserve-3d-child">
          <div className="w-[70px] h-[70px] rounded-full bg-gradient-to-br from-cyan-premium to-purple-premium flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-premium/30 text-white text-3xl animate-float-3d">
            <FaWallet className="text-2xl drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-wider text-center uppercase bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent font-heading">
            QUẢN LÝ CHI TIÊU
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {isForgotPassword ? 'Đặt lại chìa khóa bảo mật tài khoản' : 'Quản lý tài chính cá nhân một cách thông minh'}
          </p>
        </div>

        {!isForgotPassword ? (
          <form onSubmit={handleSubmit} className="space-y-6 preserve-3d-child">
            <div className="group">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Địa chỉ Email
              </label>
              <div className="relative flex items-center">
                <FaEnvelope className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setResetEmail(email);
                  }}
                  className="text-cyan-premium hover:text-cyan-300 text-[10px] font-bold tracking-wide uppercase transition-colors"
                >
                  Quên Mật Khẩu?
                </button>
              </div>
              <div className="relative flex items-center">
                <FaLock className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-sm tracking-wide disabled:opacity-50 transition-all flex items-center justify-center gap-2 neo-button-3d cursor-pointer"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <span>ĐĂNG NHẬP</span>
                  <FaSignInAlt className="text-sm animate-float-3d" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6 preserve-3d-child">
            <div className="group">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Email đã đăng ký
              </label>
              <div className="relative flex items-center">
                <FaEnvelope className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Mật khẩu mới
              </label>
              <div className="relative flex items-center">
                <FaLock className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  placeholder="•••••••• (tối thiểu 6 ký tự)"
                  required
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative flex items-center">
                <FaLock className="absolute left-4 text-gray-500 text-base transition-colors group-focus-within:text-cyan-premium" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-sm tracking-wide disabled:opacity-50 transition-all flex items-center justify-center gap-2 neo-button-3d cursor-pointer"
              >
                {resetLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <span>ĐẶT LẠI MẬT KHẨU</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="w-full py-2.5 px-4 bg-white/[0.02] hover:bg-white/[0.05] border border-dark-border rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:border-gray-500 transition-all active:scale-98 cursor-pointer"
              >
                HỦY & QUAY LẠI
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center border-t border-dark-border pt-6 preserve-3d-child">
          <p className="text-gray-500 text-xs tracking-wide">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-cyan-premium hover:text-cyan-300 font-bold transition-colors">
              ĐĂNG KÝ NGAY
            </Link>
          </p>
        </div>
      </div>
      
      {/* Optional bottom branding */}
      <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-widest uppercase">© 2026 Nền tảng Quản lý chi tiêu thông minh</p>
      </div>
    </div>
  );
};

export default Login;