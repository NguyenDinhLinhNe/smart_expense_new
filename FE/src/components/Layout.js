import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  FaTachometerAlt, 
  FaMoneyBillWave, 
  FaPiggyBank, 
  FaChartLine, 
  FaRobot, 
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaUserShield,
  FaWallet,
  FaUserTie,
  FaClock,
  FaSearch,
  FaHistory,
  FaSun,
  FaMoon,
  FaSync,
  FaMicrophone,
  FaMicrophoneSlash
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { askAIChat, createTransaction, getCategories, createBudget } from '../services/api';
import { formatVND } from '../services/utils';

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  const [isRecording, setIsRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const recognitionRef = useRef(null);

  const startVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Trình duyệt không hỗ trợ nhận diện giọng nói.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      setIsRecording(true);
      toast.success("Đang lắng nghe... Hãy nói chi tiêu của bạn!");
    };
    
    recognition.onerror = (event) => {
      setIsRecording(false);
      toast.error("Lỗi nhận diện: " + event.error);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognition.onresult = async (event) => {
      const speechToText = event.results[0][0].transcript;
      toast.success(`Nhận diện: "${speechToText}"`);
      
      setProcessingVoice(true);
      try {
        const response = await askAIChat(speechToText);
        const rawText = response.data.response;
        
        const rxTx = /\[TRANSACTION_ACTION\]([\s\S]*?)\[\/TRANSACTION_ACTION\]/;
        const rxBg = /\[BUDGET_ACTION\]([\s\S]*?)\[\/BUDGET_ACTION\]/;
        
        const matchTx = rawText.match(rxTx);
        const matchBg = rawText.match(rxBg);
        
        if (matchTx || matchBg) {
          const isTx = !!matchTx;
          const parsed = JSON.parse(isTx ? matchTx[1].trim() : matchBg[1].trim());
          
          const categoriesRes = await getCategories();
          const cats = categoriesRes.data.categories;
          const foundCat = cats.find(c => c.name.toLowerCase() === parsed.category_name.toLowerCase());
          const catId = foundCat ? foundCat.id : (cats.length > 0 ? cats[0].id : 1);
          
          if (!isTx) {
            const today = new Date();
            await createBudget({
              category_id: catId,
              amount: parsed.amount,
              month: today.getMonth() + 1,
              year: today.getFullYear(),
              week: 1
            });
            toast.success(`Đã tự động thiết lập ngân sách: ${formatVND(parsed.amount)}!`);
          } else {
            await createTransaction({
              amount: parsed.amount,
              type: parsed.type || 'expense',
              category_id: catId,
              note: parsed.note || '',
              date: new Date().toISOString().split('T')[0]
            });
            toast.success(`Đã tự động ghi nhận chi tiêu: ${formatVND(parsed.amount)}!`);
          }
          
          if (location.pathname === '/transactions' || location.pathname === '/dashboard' || location.pathname === '/budgets') {
            window.location.reload();
          }
        } else {
          toast.error("Không nhận dạng được giao dịch hay ngân sách cụ thể. Hãy thử nói rõ ràng hơn!");
        }
      } catch (err) {
        toast.error("Không thể xử lý giọng nói qua AI.");
      } finally {
        setProcessingVoice(false);
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };



  // Search and Suggestions State
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [desktopFocused, setDesktopFocused] = useState(false);
  const [mobileFocused, setMobileFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const searchSuggestions = [
    { text: 'Dashboard Control', type: 'page', path: '/dashboard', label: 'Page' },
    { text: 'Transactions Ledger', type: 'page', path: '/transactions', label: 'Page' },
    { text: 'Budgets Planning', type: 'page', path: '/budgets', label: 'Page' },
    { text: 'Reports & Statistics', type: 'page', path: '/reports', label: 'Page' },
    { text: 'AI Financial Insights', type: 'page', path: '/ai', label: 'Page' },
    { text: 'System Administration', type: 'page', path: '/admin', label: 'Page' },
    { text: 'Food Budget', type: 'budget', highlight: 'Food', path: '/budgets?highlight=Food', label: 'Budget' },
    { text: 'Shopping Budget', type: 'budget', highlight: 'Shopping', path: '/budgets?highlight=Shopping', label: 'Budget' },
    { text: 'Transportation Budget', type: 'budget', highlight: 'Transportation', path: '/budgets?highlight=Transportation', label: 'Budget' },
    { text: 'Entertainment Budget', type: 'budget', highlight: 'Entertainment', path: '/budgets?highlight=Entertainment', label: 'Budget' },
    { text: 'Utilities Budget', type: 'budget', highlight: 'Utilities', path: '/budgets?highlight=Utilities', label: 'Budget' },
    { text: 'Salary Income', type: 'transaction', query: 'Salary', path: '/transactions?search=Salary', label: 'Transaction' },
    { text: 'Groceries Expense', type: 'transaction', query: 'Groceries', path: '/transactions?search=Groceries', label: 'Transaction' },
  ];

  // Load history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('smart_search_history');
    if (history) {
      try {
        setRecentSearches(JSON.parse(history));
      } catch (e) {
        setRecentSearches([]);
      }
    }
  }, []);

  // Click outside to close suggestion dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.search-container')) {
        setDesktopFocused(false);
        setMobileFocused(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const saveSearchQuery = (query) => {
    if (!query || !query.trim()) return;
    const trimmed = query.trim();
    const updated = [trimmed, ...recentSearches.filter(item => item !== trimmed)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('smart_search_history', JSON.stringify(updated));
  };

  const deleteHistoryItem = (e, itemToDelete) => {
    e.stopPropagation(); // Avoid triggering selection
    const updated = recentSearches.filter(item => item !== itemToDelete);
    setRecentSearches(updated);
    localStorage.setItem('smart_search_history', JSON.stringify(updated));
  };

  const getFilteredSuggestions = () => {
    if (!searchQuery.trim()) {
      return [];
    }
    const q = searchQuery.toLowerCase();
    const matches = searchSuggestions.filter(item => 
      item.text.toLowerCase().includes(q) || 
      (item.label && item.label.toLowerCase().includes(q))
    );
    
    const customOption = {
      text: `Search transactions for "${searchQuery}"`,
      type: 'custom',
      path: `/transactions?search=${encodeURIComponent(searchQuery.trim())}`,
      query: searchQuery.trim(),
      label: 'Search'
    };
    
    return [customOption, ...matches].slice(0, 8);
  };

  const filteredSuggestions = getFilteredSuggestions();

  const handleSelectSearch = (item) => {
    if (typeof item === 'string') {
      saveSearchQuery(item);
      navigate(`/transactions?search=${encodeURIComponent(item)}`);
    } else {
      if (item.type === 'custom') {
        saveSearchQuery(item.query);
      } else {
        saveSearchQuery(item.text);
      }
      navigate(item.path);
    }
    setSearchQuery('');
    setDesktopFocused(false);
    setMobileFocused(false);
    setSidebarOpen(false); // Close mobile menu if open
    setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (e) => {
    const list = searchQuery.trim() ? filteredSuggestions : recentSearches;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1 < list.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 >= 0 ? prev - 1 : list.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < list.length) {
        handleSelectSearch(list[activeSuggestionIndex]);
      } else if (searchQuery.trim()) {
        handleSelectSearch({
          text: searchQuery.trim(),
          type: 'custom',
          query: searchQuery.trim(),
          path: `/transactions?search=${encodeURIComponent(searchQuery.trim())}`
        });
      }
    } else if (e.key === 'Escape') {
      setDesktopFocused(false);
      setMobileFocused(false);
      setActiveSuggestionIndex(-1);
    }
  };

  // Live ticking clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', icon: FaTachometerAlt, label: 'Dashboard', desc: 'Main control center' },
    { path: '/transactions', icon: FaMoneyBillWave, label: 'Transactions', desc: 'Income & expenses' },
    { path: '/recurring', icon: FaSync, label: 'Recurring', desc: 'Auto-recurring rules' },
    { path: '/budgets', icon: FaPiggyBank, label: 'Budgets', desc: 'Category allowances' },
    { path: '/reports', icon: FaChartLine, label: 'Reports', desc: 'Financial analysis' },
    { path: '/ai', icon: FaRobot, label: 'AI Insights', desc: 'Smart advisor' },
  ];

  if (user?.role === 'admin') {
    menuItems.unshift({ path: '/admin', icon: FaUserShield, label: 'Admin Panel', desc: 'System management' });
  }

  // Determine page title based on route
  const getPageDetails = () => {
    switch (location.pathname) {
      case '/dashboard':
        return { title: 'Dashboard Control', desc: 'Welcome back to your Smart Expense Tracker control panel' };
      case '/transactions':
        return { title: 'Transactions Ledger', desc: 'Manage and monitor all your income and expenses' };
      case '/recurring':
        return { title: 'Recurring Rules', desc: 'Automate periodic billing and income items' };
      case '/budgets':
        return { title: 'Budgets Planning', desc: 'Set monthly limits to build healthier financial habits' };
      case '/reports':
        return { title: 'Reports & Statistics', desc: 'Interactive analysis of your cashflows and breakdowns' };
      case '/ai':
        return { title: 'AI Financial Insights', desc: 'Get professional financial advice powered by Machine Learning' };
      case '/admin':
        return { title: 'System Administration', desc: 'Manage categories, check users, and monitor resources' };
      default:
        return { title: 'Expense Tracker', desc: 'Manage your finances intelligently' };
    }
  };

  const pageDetails = getPageDetails();

  const formatClock = (date) => {
    const pad = (n) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${hh}:${mm}:${ss} - ${day}/${month}/${year}`;
  };

  return (
    <div className="flex flex-col h-screen bg-dark-main text-white font-body overflow-hidden">
      {/* Horizontal Header (Top Navigation) */}
      <header className="h-20 bg-dark-card border-b border-dark-border px-6 flex items-center justify-between z-50 sticky top-0 flex-shrink-0 w-full">
        {/* Brand Section */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-premium to-teal-premium flex items-center justify-center text-white text-lg shadow-lg shadow-cyan-premium/25 transition-transform hover:scale-105">
            <FaWallet className="text-lg" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-extrabold tracking-wide text-white uppercase font-heading leading-tight">
              SMART EXPENSE
            </h3>
            <span className="text-[9px] text-cyan-premium font-bold tracking-widest uppercase leading-none mt-0.5">
              PLATFORM
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Horizontal for large screens) */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group ${
                  isActive 
                    ? 'bg-cyan-premium/10 text-cyan-premium shadow-cyan-glow/5 border border-cyan-premium/25' 
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`text-[13px] transition-colors ${
                    isActive ? 'text-cyan-premium' : 'text-gray-500 group-hover:text-white'
                  }`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right Section (Search, Clock, Profile, Actions) */}
        <div className="flex items-center gap-4">
          {/* Global Search Bar */}
          <div className="relative hidden md:block search-container">
            <div className="relative">
              <input
                type="text"
                placeholder="Search everything..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveSuggestionIndex(-1);
                }}
                onFocus={() => setDesktopFocused(true)}
                onKeyDown={handleKeyDown}
                className="w-48 xl:w-60 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-dark-border focus:border-cyan-premium/50 rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
              />
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
            </div>

            {/* Suggestions & History Dropdown */}
            {desktopFocused && (
              <div className="absolute top-[38px] left-0 w-64 xl:w-72 bg-dark-glass border border-dark-border backdrop-blur-md shadow-2xl rounded-2xl py-3 z-50 animate-fade-in flex flex-col gap-1">
                {/* 1. When query is empty -> show History or Try Searching */}
                {!searchQuery.trim() ? (
                  <>
                    {recentSearches.length > 0 ? (
                      <>
                        <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Recent Searches
                        </div>
                        <div className="flex flex-col max-h-60 overflow-y-auto">
                          {recentSearches.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectSearch(item)}
                              className={`flex items-center justify-between px-4 py-2 text-xs cursor-pointer transition-colors group ${
                                activeSuggestionIndex === idx 
                                  ? 'bg-white/[0.06] text-cyan-premium' 
                                  : 'text-gray-300 hover:bg-white/[0.03] hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <FaHistory className="text-gray-500 group-hover:text-cyan-premium transition-colors flex-shrink-0 text-[10px]" />
                                <span className="truncate">{item}</span>
                              </div>
                              <button
                                onClick={(e) => deleteHistoryItem(e, item)}
                                className="text-gray-500 hover:text-rose-premium p-1 transition-colors"
                                title="Remove search item"
                              >
                                <FaTimes size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Recommended Shortcuts
                        </div>
                        <div className="flex flex-col">
                          {searchSuggestions.slice(0, 5).map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectSearch(item)}
                              className="flex items-center justify-between px-4 py-2 text-xs text-gray-300 hover:bg-white/[0.03] hover:text-cyan-premium cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-2.5">
                                <FaSearch className="text-gray-500 group-hover:text-cyan-premium transition-colors flex-shrink-0 text-[10px]" />
                                <span>{item.text}</span>
                              </div>
                              <span className="text-[9px] bg-cyan-premium/15 text-cyan-premium border border-cyan-premium/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider font-mono scale-90">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // 2. When query has characters -> show Filtered Suggestions
                  <>
                    <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Search Suggestions
                    </div>
                    <div className="flex flex-col max-h-60 overflow-y-auto">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectSearch(item)}
                            className={`flex items-center justify-between px-4 py-2.5 text-xs cursor-pointer transition-colors group ${
                              activeSuggestionIndex === idx 
                                ? 'bg-white/[0.06] text-cyan-premium' 
                                : 'text-gray-300 hover:bg-white/[0.03] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <FaSearch className="text-gray-500 group-hover:text-cyan-premium transition-colors flex-shrink-0 text-[10px]" />
                              <span className="truncate">{item.text}</span>
                            </div>
                            <span className="text-[9px] bg-cyan-premium/15 text-cyan-premium border border-cyan-premium/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider font-mono scale-90 flex-shrink-0">
                              {item.label}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-xs text-gray-500 text-center font-medium italic">
                          No suggestions found. Press Enter to search.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Live Ticking Clock (hidden on medium screens) */}
          <div className="hidden xl:flex items-center gap-2 bg-white/[0.02] border border-dark-border px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-cyan-premium">
            <FaClock size={11} className="animate-spin-slow text-cyan-premium" style={{ animationDuration: '10s' }} />
            <span className="font-mono tracking-wide">{formatClock(time)}</span>
          </div>

          {/* Compact User Tag */}
          <div className="flex items-center gap-2 bg-white/[0.02] border border-dark-border px-3 py-1.5 rounded-full hidden sm:flex">
            <div className="w-5.5 h-5.5 rounded-full bg-slate-900 border border-dark-border flex items-center justify-center text-cyan-premium text-[10px]">
              <FaUserTie size={10} />
            </div>
            <span className="text-xs font-semibold text-gray-300 truncate max-w-[85px]">{user?.name || 'User'}</span>
          </div>

          {/* Global Voice Assistant Button */}
          <button
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            className={`p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer relative ${
              isRecording 
                ? 'bg-rose-500 text-white animate-pulse' 
                : 'bg-cyan-premium/5 border border-cyan-premium/10 hover:border-cyan-premium/80 hover:bg-cyan-premium/15 text-cyan-premium'
            }`}
            title="Global Voice Command (vi-VN)"
            disabled={processingVoice}
          >
            {isRecording ? <FaMicrophoneSlash size={13} /> : <FaMicrophone size={13} />}
            {processingVoice && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-cyan-premium/5 border border-cyan-premium/10 hover:border-cyan-premium/80 hover:bg-cyan-premium/15 rounded-xl text-cyan-premium transition-all active:scale-95 cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <FaSun size={13} /> : <FaMoon size={13} />}
          </button>

          {/* System Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2.5 bg-rose-premium/5 border border-rose-premium/10 hover:border-rose-premium/80 hover:bg-rose-premium/15 rounded-xl text-rose-premium transition-all active:scale-95 cursor-pointer"
            title="Logout System"
          >
            <FaSignOutAlt size={13} />
          </button>

          {/* Mobile Navigation Toggle (Hamburger) */}
          <button
            className="lg:hidden p-2.5 bg-dark-card border border-dark-border rounded-xl text-white shadow-lg cursor-pointer"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <FaTimes size={13} /> : <FaBars size={13} />}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Dropdown Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-dark-card border-b border-dark-border z-40 py-5 px-6 flex flex-col gap-3 shadow-2xl transition-all duration-300 ease-in-out">
          {/* Mobile Search Bar */}
          <div className="relative w-full search-container z-50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search everything..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveSuggestionIndex(-1);
                }}
                onFocus={() => setMobileFocused(true)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white/[0.03] border border-dark-border focus:border-cyan-premium/50 rounded-full pl-9.5 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none"
              />
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
            </div>

            {/* Mobile Dropdown Panel */}
            {mobileFocused && (
              <div className="absolute top-[42px] left-0 w-full bg-dark-glass border border-dark-border backdrop-blur-md shadow-2xl rounded-2xl py-3 z-50 animate-fade-in flex flex-col gap-1">
                {!searchQuery.trim() ? (
                  <>
                    {recentSearches.length > 0 ? (
                      <>
                        <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Recent Searches
                        </div>
                        <div className="flex flex-col max-h-48 overflow-y-auto">
                          {recentSearches.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectSearch(item)}
                              className={`flex items-center justify-between px-4 py-2 text-xs cursor-pointer transition-colors group ${
                                activeSuggestionIndex === idx 
                                  ? 'bg-white/[0.06] text-cyan-premium' 
                                  : 'text-gray-300 hover:bg-white/[0.03] hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <FaHistory className="text-gray-500 group-hover:text-cyan-premium transition-colors flex-shrink-0 text-[10px]" />
                                <span className="truncate">{item}</span>
                              </div>
                              <button
                                onClick={(e) => deleteHistoryItem(e, item)}
                                className="text-gray-500 hover:text-rose-premium p-1 transition-colors"
                              >
                                <FaTimes size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Recommended Shortcuts
                        </div>
                        <div className="flex flex-col">
                          {searchSuggestions.slice(0, 4).map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectSearch(item)}
                              className="flex items-center justify-between px-4 py-2 text-xs text-gray-300 hover:bg-white/[0.03] hover:text-cyan-premium cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-2.5">
                                <FaSearch className="text-gray-500 group-hover:text-cyan-premium transition-colors flex-shrink-0 text-[10px]" />
                                <span>{item.text}</span>
                              </div>
                              <span className="text-[9px] bg-cyan-premium/15 text-cyan-premium border border-cyan-premium/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider font-mono scale-90">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Search Suggestions
                    </div>
                    <div className="flex flex-col max-h-48 overflow-y-auto">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectSearch(item)}
                            className={`flex items-center justify-between px-4 py-2 text-xs cursor-pointer transition-colors group ${
                              activeSuggestionIndex === idx 
                                ? 'bg-white/[0.06] text-cyan-premium' 
                                : 'text-gray-300 hover:bg-white/[0.03] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <FaSearch className="text-gray-500 group-hover:text-cyan-premium transition-colors flex-shrink-0 text-[10px]" />
                              <span className="truncate">{item.text}</span>
                            </div>
                            <span className="text-[9px] bg-cyan-premium/15 text-cyan-premium border border-cyan-premium/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider font-mono scale-90 flex-shrink-0">
                              {item.label}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-xs text-gray-500 text-center font-medium italic">
                          No suggestions found. Press Enter to search.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile Navigation Links */}
          <div className="flex flex-col gap-1.5 mt-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-cyan-premium/10 text-cyan-premium border border-cyan-premium/25' 
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="text-[13px]" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace (View Container) */}
      <div className="flex-1 overflow-y-auto bg-dark-main flex flex-col">
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {/* Contextual Header inside content area */}
            <div className="flex flex-col border-b border-white/[0.04] pb-4">
              <h2 className="text-lg font-extrabold tracking-wider text-white uppercase font-heading">
                {pageDetails.title}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {pageDetails.desc}
              </p>
            </div>

            {/* Page View Outlet */}
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

    </div>
  );
};

export default Layout;