import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardData } from '../services/api';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { FaWallet, FaArrowUp, FaArrowDown, FaCalendarAlt, FaPlus, FaPiggyBank, FaTrash, FaCoins, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatVND } from '../services/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_income: 0,
    total_expense: 0,
    balance: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState({});

  // Savings Goals States
  const [goals, setGoals] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  
  // Deposit/Withdraw states
  const [activeGoal, setActiveGoal] = useState(null);
  const [transactionType, setTransactionType] = useState('deposit'); // 'deposit' or 'withdraw'
  const [transactionAmount, setTransactionAmount] = useState('');
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const defaultGoals = [];

  useEffect(() => {
    fetchDashboardData();
    
    const savedGoals = localStorage.getItem('smart_savings_goals');
    if (savedGoals) {
      try {
        setGoals(JSON.parse(savedGoals));
      } catch (e) {
        setGoals(defaultGoals);
      }
    } else {
      setGoals(defaultGoals);
      localStorage.setItem('smart_savings_goals', JSON.stringify(defaultGoals));
    }
  }, []);

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!goalName.trim() || !goalTarget || parseFloat(goalTarget) <= 0) {
      toast.error('Please enter valid goal details');
      return;
    }
    const target = parseFloat(goalTarget);
    const current = parseFloat(goalCurrent) || 0;
    
    if (current > target) {
      toast.error('Saved amount cannot exceed target');
      return;
    }

    const newGoal = {
      id: Date.now(),
      name: goalName.trim(),
      target,
      current
    };

    const updated = [...goals, newGoal];
    setGoals(updated);
    localStorage.setItem('smart_savings_goals', JSON.stringify(updated));
    toast.success('Savings Goal created!');
    
    setGoalName('');
    setGoalTarget('');
    setGoalCurrent('');
    setShowGoalModal(false);
  };

  const handleDeleteGoal = (id) => {
    if (window.confirm('Delete this savings goal?')) {
      const updated = goals.filter(g => g.id !== id);
      setGoals(updated);
      localStorage.setItem('smart_savings_goals', JSON.stringify(updated));
      toast.success('Goal deleted');
    }
  };

  const handleGoalTransaction = (e) => {
    e.preventDefault();
    const amount = parseFloat(transactionAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const updated = goals.map(g => {
      if (g.id === activeGoal.id) {
        let newCurrent = g.current;
        if (transactionType === 'deposit') {
          newCurrent = Math.min(g.current + amount, g.target);
          toast.success(`Deposited ${formatVND(amount)} to ${g.name}`);
        } else {
          newCurrent = Math.max(g.current - amount, 0);
          toast.success(`Withdrew ${formatVND(amount)} from ${g.name}`);
        }
        return { ...g, current: newCurrent };
      }
      return g;
    });

    setGoals(updated);
    localStorage.setItem('smart_savings_goals', JSON.stringify(updated));
    setTransactionAmount('');
    setShowTransactionModal(false);
    setActiveGoal(null);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await getDashboardData();
      const data = response.data;
      setSummary(data.summary);
      setRecentTransactions(data.recent_transactions);
      setTrendData(data.trend_data);
      setCategoryData(data.category_data);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const lineChartData = {
    labels: trendData.map(item => item.month),
    datasets: [
      {
        label: 'Thu nhập',
        data: trendData.map(item => item.income),
        borderColor: '#10b981', // emerald-premium
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointHoverRadius: 6,
      },
      {
        label: 'Chi tiêu',
        data: trendData.map(item => item.expense),
        borderColor: '#f43f5e', // rose-premium
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: '#f43f5e',
        pointHoverRadius: 6,
      }
    ]
  };

  const doughnutChartData = {
    labels: categoryData.labels || [],
    datasets: [
      {
        data: categoryData.data || [],
        backgroundColor: ['#06b6d4', '#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e', '#FF6B6B', '#4ECDC4'],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
      }
    ]
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-premium"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* 3 Columns KPI Grid với không gian Perspective 3D */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 perspective-3d">
        {/* KPI: Total Income */}
        <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:border-emerald-premium/40 transition-all duration-300 group tilt-card-3d">
          <div className="absolute w-36 h-36 bg-emerald-premium blur-[35px] -top-12 -right-12 opacity-[0.12] rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-20"></div>
          <div className="flex justify-between items-center relative z-10 preserve-3d-child">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                TỔNG THU NHẬP
              </p>
              <h3 className="text-3xl font-extrabold text-white mt-2 font-heading tracking-tight">
                {formatVND(summary.total_income)}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Các nguồn thu nhập trong tháng</p>
            </div>
            <div className="p-3.5 bg-emerald-premium/15 text-emerald-premium rounded-xl shadow-inner animate-float-3d">
              <FaArrowUp className="text-xl" />
            </div>
          </div>
        </div>

        {/* KPI: Total Expense */}
        <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:border-rose-premium/40 transition-all duration-300 group tilt-card-3d">
          <div className="absolute w-36 h-36 bg-rose-premium blur-[35px] -top-12 -right-12 opacity-[0.12] rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-20"></div>
          <div className="flex justify-between items-center relative z-10 preserve-3d-child">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                TỔNG CHI TIÊU
              </p>
              <h3 className="text-3xl font-extrabold text-white mt-2 font-heading tracking-tight">
                {formatVND(summary.total_expense)}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Các chi phí và hóa đơn đã thanh toán</p>
            </div>
            <div className="p-3.5 bg-rose-premium/15 text-rose-premium rounded-xl shadow-inner animate-float-3d-delayed">
              <FaArrowDown className="text-xl" />
            </div>
          </div>
        </div>

        {/* KPI: Net Balance */}
        <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:border-cyan-premium/40 transition-all duration-300 group tilt-card-3d">
          <div className="absolute w-36 h-36 bg-cyan-premium blur-[35px] -top-12 -right-12 opacity-[0.12] rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-20"></div>
          <div className="flex justify-between items-center relative z-10 preserve-3d-child">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                SỐ DƯ RÒNG
              </p>
              <h3 className="text-3xl font-extrabold text-white mt-2 font-heading tracking-tight">
                {formatVND(summary.balance)}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Nguồn tiền khả dụng hiện có</p>
            </div>
            <div className="p-3.5 bg-cyan-premium/15 text-cyan-premium rounded-xl shadow-inner animate-float-3d">
              <FaWallet className="text-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* 2 Column Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 perspective-3d">
        {/* cashflow trend */}
        <div className="bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl flex flex-col h-[380px] hover:border-white/[0.1] transition-all duration-300 tilt-card-3d">
          <div className="flex justify-between items-center mb-6 preserve-3d-child">
            <h3 className="text-base font-bold text-white tracking-wide font-heading">
              XU HƯỚNG DÒNG TIỀN
            </h3>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 font-semibold">
              <FaCalendarAlt /> Phân tích hàng tháng
            </span>
          </div>
          <div className="flex-1 min-h-0 preserve-3d-child">
            <Line 
              data={lineChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                  legend: { 
                    position: 'top',
                    labels: { 
                      color: '#94a3b8',
                      font: { family: 'Inter', size: 11, weight: '500' }
                    } 
                  } 
                },
                scales: {
                  x: { 
                    grid: { color: 'rgba(255, 255, 255, 0.02)' },
                    ticks: { color: '#64748b', font: { size: 10 } } 
                  },
                  y: { 
                    grid: { color: 'rgba(255, 255, 255, 0.02)' },
                    ticks: { color: '#64748b', font: { size: 10 } } 
                  }
                }
              }} 
            />
          </div>
        </div>

        {/* expense breakdown */}
        <div className="bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl flex flex-col h-[380px] hover:border-white/[0.1] transition-all duration-300 tilt-card-3d">
          <div className="flex justify-between items-center mb-6 preserve-3d-child">
            <h3 className="text-base font-bold text-white tracking-wide font-heading">
              CƠ CẤU CHI TIÊU
            </h3>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 font-semibold">
              Chi tiêu theo danh mục
            </span>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center preserve-3d-child">
            <Doughnut 
              data={doughnutChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                  legend: { 
                    position: 'right', 
                    labels: { 
                      color: '#94a3b8',
                      font: { family: 'Inter', size: 11 } 
                    } 
                  } 
                }
              }} 
            />
          </div>
        </div>
      </div>

    {/* Visual Savings Goals (Liquid Wave) */}
    <div className="bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:border-white/[0.1] transition-all duration-300 relative overflow-hidden perspective-3d tilt-card-3d">
      <div className="flex justify-between items-center mb-6 relative z-10 preserve-3d-child">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-cyan-premium/15 text-cyan-premium rounded-lg animate-float-3d">
            <FaPiggyBank className="text-base" />
          </div>
          <h3 className="text-base font-bold text-white tracking-wide font-heading">
            MỤC TIÊU TIẾT KIỆM TÍCH LŨY
          </h3>
        </div>
        <button
          onClick={() => setShowGoalModal(true)}
          className="py-1.5 px-4 bg-cyan-premium hover:bg-cyan-600 text-white font-heading font-extrabold text-[10px] tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer neo-button-3d"
        >
          <FaPlus /> <span>THÊM MỤC TIÊU MỚI</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-xs uppercase tracking-wider font-semibold border border-dashed border-dark-border rounded-xl">
          Chưa thiết lập mục tiêu tiết kiệm nào. Hãy tạo mục tiêu tích lũy ở trên nhé!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {goals.map(goal => {
            const percent = Math.min((goal.current / goal.target) * 100, 100);
            return (
              <div key={goal.id} className="relative overflow-hidden bg-[#101622]/40 border border-dark-border/60 hover:border-white/10 rounded-2xl p-5 shadow-lg flex items-center justify-between group transition-all duration-300">
                <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -bottom-10 -right-10 opacity-[0.03] rounded-full pointer-events-none group-hover:opacity-5 transition-opacity"></div>
                
                {/* Left Column: Details */}
                <div className="flex-1 pr-4">
                  <h4 className="text-sm font-extrabold text-white tracking-wide truncate uppercase font-heading">{goal.name}</h4>
                  <div className="mt-3.5 space-y-1 font-mono">
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Số dư tích lũy</span>
                      <span className="text-white font-semibold">{formatVND(goal.current)} / {formatVND(goal.target)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Tiến độ</span>
                      <span className="text-cyan-premium font-bold">{percent.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Deposit / Withdraw Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        setActiveGoal(goal);
                        setTransactionType('deposit');
                        setShowTransactionModal(true);
                      }}
                      className="py-1 px-2.5 bg-emerald-premium/15 hover:bg-emerald-premium/25 border border-emerald-premium/25 text-emerald-premium text-[9px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      TÍCH LŨY THÊM
                    </button>
                    <button
                      onClick={() => {
                        setActiveGoal(goal);
                        setTransactionType('withdraw');
                        setShowTransactionModal(true);
                      }}
                      className="py-1 px-2.5 bg-rose-premium/15 hover:bg-rose-premium/25 border border-rose-premium/25 text-rose-premium text-[9px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      RÚT SỬ DỤNG
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1 text-gray-500 hover:text-rose-premium transition-colors hover:bg-rose-premium/10 rounded-lg ml-auto cursor-pointer"
                      title="Xóa mục tiêu"
                    >
                      <FaTrash size={10} />
                    </button>
                  </div>
                </div>

                {/* Right Column: Dynamic Liquid Wave Jar */}
                <div className="flex-shrink-0 flex items-center justify-center pl-2">
                  <div className="wave-jar">
                    {/* Height of wave maps to savings percentage */}
                    <div 
                      className="wave-liquid" 
                      style={{ height: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* Modal Add Savings Goal */}
    {showGoalModal && (
      <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
        <form onSubmit={handleAddGoal} className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-sm w-full p-8 shadow-2xl relative animate-modal-scale">
          <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
          
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-heading flex items-center gap-2">
              <FaPiggyBank className="text-cyan-premium" /> Thiết lập mục tiêu
            </h3>
            <button 
              type="button"
              onClick={() => setShowGoalModal(false)} 
              className="p-1.5 bg-white/[0.03] border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes size={12} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Tên mục tiêu / Mô tả</label>
              <input 
                type="text" 
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Ví dụ: Du lịch Đà Lạt 🌸"
                className="w-full px-4 py-2.5 bg-[#0f172a]/80 border border-dark-border focus:border-cyan-premium rounded-xl text-xs text-white outline-none focus:shadow-cyan-glow transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Số tiền cần tích lũy (đ)</label>
                <input 
                  type="number" 
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="3000000"
                  className="w-full px-4 py-2.5 bg-[#0f172a]/80 border border-dark-border focus:border-cyan-premium rounded-xl text-xs text-white outline-none focus:shadow-cyan-glow transition-all font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Đã tích lũy sẵn (đ)</label>
                <input 
                  type="number" 
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  placeholder="500000"
                  className="w-full px-4 py-2.5 bg-[#0f172a]/80 border border-dark-border focus:border-cyan-premium rounded-xl text-xs text-white outline-none focus:shadow-cyan-glow transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-xs tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all mt-4 cursor-pointer"
            >
              THIẾT LẬP MỤC TIÊU
            </button>
          </div>
        </form>
      </div>
    )}

    {/* Modal Deposit / Withdraw Savings Goal */}
    {showTransactionModal && activeGoal && (
      <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
        <form onSubmit={handleGoalTransaction} className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-sm w-full p-8 shadow-2xl relative animate-modal-scale">
          <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>

          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-heading flex items-center gap-2">
              <FaCoins className={transactionType === 'deposit' ? 'text-emerald-premium' : 'text-rose-premium'} />
              {transactionType === 'deposit' ? 'Gửi tiền tích lũy' : 'Rút tiền sử dụng'}
            </h3>
            <button 
              type="button"
              onClick={() => {
                setShowTransactionModal(false);
                setActiveGoal(null);
              }} 
              className="p-1.5 bg-white/[0.03] border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes size={12} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-white/[0.02] border border-dark-border/40 rounded-xl text-center">
              <span className="text-[11px] text-gray-400">Mục tiêu hiện tại</span>
              <h4 className="text-sm font-bold text-white uppercase font-heading mt-1">{activeGoal.name}</h4>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                Số dư: {formatVND(activeGoal.current)} / {formatVND(activeGoal.target)} ({((activeGoal.current / activeGoal.target) * 100).toFixed(0)}%)
              </p>
            </div>

            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Số tiền muốn {transactionType === 'deposit' ? 'gửi' : 'rút'}</label>
              <input 
                type="number" 
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
                placeholder="Ví dụ: 500000"
                className="w-full px-4 py-2.5 bg-[#0f172a]/80 border border-dark-border focus:border-cyan-premium rounded-xl text-xs text-white outline-none focus:shadow-cyan-glow transition-all font-mono"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className={`w-full py-3 text-white font-heading font-extrabold text-xs tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all mt-4 cursor-pointer bg-gradient-to-r ${
                transactionType === 'deposit' 
                  ? 'from-emerald-premium to-teal-premium' 
                  : 'from-rose-premium to-orange-premium'
              }`}
            >
              {transactionType === 'deposit' ? 'XÁC NHẬN GỬI TIỀN' : 'XÁC NHẬN RÚT TIỀN'}
            </button>
          </div>
        </form>
      </div>
    )}

    {/* Recent Transactions list */}
    <div className="bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:border-white/[0.1] transition-colors">
        <h3 className="text-base font-bold text-white tracking-wide mb-6 font-heading">
          GIAO DỊCH GẦN ĐÂY
        </h3>
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-dark-border text-gray-500">
                <th className="py-4 px-4 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ngày</th>
                <th className="py-4 px-4 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Danh mục</th>
                <th className="py-4 px-4 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ghi chú</th>
                <th className="py-4 px-4 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/40">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500">
                    Chưa ghi nhận giao dịch nào. Hãy thêm giao dịch mới trong mục Giao dịch nhé.
                  </td>
                </tr>
              ) : (
                recentTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-white/[0.01] transition-colors duration-150">
                    <td className="py-4 px-4 text-gray-400 font-mono text-xs">{transaction.date}</td>
                    <td className="py-4 px-4">
                      <span className="flex items-center gap-2">
                        <span className="text-xl leading-none drop-shadow">{transaction.category_icon}</span>
                        <span className="text-white font-medium">{transaction.category_name}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-400 max-w-[200px] truncate">{transaction.note || '-'}</td>
                    <td className={`py-4 px-4 text-right font-bold tracking-tight ${
                      transaction.type === 'income' ? 'text-emerald-premium' : 'text-rose-premium'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatVND(Math.abs(transaction.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;