import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBudgets, createBudget, updateBudget, deleteBudget, getCategories } from '../services/api';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaExclamationTriangle, FaChevronDown, FaCalendarAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatVND } from '../services/utils';

const Budgets = () => {
  const [searchParams] = useSearchParams();
  const highlightParam = searchParams.get('highlight');

  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(null);
  const skipNextFetch = useRef(false);
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    month: selectedMonth,
    year: selectedYear,
    week: ''
  });

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    fetchData();
  }, [selectedMonth, selectedYear, selectedWeek]);

  // Adjust week parameter if it falls out of bound on month/year changes
  useEffect(() => {
    if (weeks.length > 0 && selectedWeek && selectedWeek > weeks.length) {
      setSelectedWeek(1);
    }
  }, [weeks]);

  useEffect(() => {
    if (!loading && highlightParam && budgets.length > 0) {
      const targetId = `budget-card-${highlightParam.toLowerCase()}`;
      const element = document.getElementById(targetId);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add(
            'ring-2', 
            'ring-cyan-premium', 
            'shadow-[0_0_25px_rgba(6,182,212,0.45)]', 
            'scale-[1.02]'
          );
          
          setTimeout(() => {
            element.classList.remove(
              'ring-2', 
              'ring-cyan-premium', 
              'shadow-[0_0_25px_rgba(6,182,212,0.45)]', 
              'scale-[1.02]'
            );
          }, 4000);
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, highlightParam, budgets]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [budgetsRes, categoriesRes] = await Promise.all([
        getBudgets(selectedMonth, selectedYear, selectedWeek || ''),
        getCategories()
      ]);
      setBudgets(budgetsRes.data.budgets);
      setWeeks(budgetsRes.data.weeks || []);
      setCategories(categoriesRes.data.categories.filter(c => c.type === 'expense'));
      
      const serverActiveWeek = budgetsRes.data.active_week || 1;
      if (selectedWeek === null) {
        skipNextFetch.current = true;
        setSelectedWeek(serverActiveWeek);
      }
      
      // Update form data month, year, week
      setFormData(prev => ({
        ...prev,
        month: selectedMonth,
        year: selectedYear,
        week: serverActiveWeek
      }));
    } catch (error) {
      // Fail silently
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBudget) {
        await updateBudget(editingBudget.id, formData);
        toast.success('Budget updated');
      } else {
        await createBudget(formData);
        toast.success('Budget created');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      try {
        await deleteBudget(id);
        toast.success('Budget deleted');
        fetchData();
      } catch (error) {
        toast.error('Delete failed');
      }
    }
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormData({
      category_id: budget.category_id,
      amount: budget.amount,
      month: budget.month,
      year: budget.year,
      week: budget.week
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingBudget(null);
    setFormData({
      category_id: '',
      amount: '',
      month: selectedMonth,
      year: selectedYear,
      week: selectedWeek
    });
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-gradient-to-r from-rose-premium to-[#e11d48] shadow-[0_0_10px_rgba(244,63,94,0.4)]';
    if (percentage >= 80) return 'bg-gradient-to-r from-amber-premium to-[#d97706] shadow-[0_0_10px_rgba(245,158,11,0.4)]';
    return 'bg-gradient-to-r from-emerald-premium to-[#059669] shadow-[0_0_10px_rgba(16,185,129,0.4)]';
  };

  const activeWeekInfo = weeks.find(w => w.week === selectedWeek);

  return (
    <div className="space-y-8 animate-fade-in font-body relative">
      {/* Header Panel */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-dark-glass border border-dark-border p-6 rounded-2xl relative overflow-hidden perspective-3d tilt-card-3d">
        <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -bottom-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
        <div className="preserve-3d-child">
          <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-heading">
            Quản Lý Ngân Sách Tuần
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Kiểm soát giới hạn chi tiêu hàng tuần để duy trì các mục tiêu tích lũy lành mạnh</p>
        </div>
        
        <div className="flex items-center flex-wrap gap-3.5 self-start xl:self-center preserve-3d-child">
          {/* Week selector */}
          {weeks.length > 0 && (
            <div className="relative">
              <select
                value={selectedWeek || ''}
                onChange={(e) => setSelectedWeek(e.target.value ? parseInt(e.target.value) : null)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium transition-all cursor-pointer"
              >
                {weeks.map(w => (
                  <option key={w.week} value={w.week}>
                    Tuần {w.week} ({w.start_str} - {w.end_str})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                <FaChevronDown />
              </div>
            </div>
          )}

          {/* Month selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium transition-all cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
              <FaChevronDown />
            </div>
          </div>
          
          {/* Year selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium transition-all cursor-pointer"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
              <FaChevronDown />
            </div>
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="py-2.5 px-4 bg-cyan-premium hover:bg-cyan-600 text-white font-heading font-extrabold text-[10px] tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer neo-button-3d"
          >
            <FaPlus /> <span>THÊM NGÂN SÁCH TUẦN</span>
          </button>
        </div>
      </div>

      {activeWeekInfo && (
        <div className="p-3 bg-cyan-premium/5 border border-cyan-premium/20 rounded-xl text-[10px] font-bold text-cyan-premium uppercase tracking-widest flex items-center gap-2 max-w-max animate-float-3d">
          <FaCalendarAlt className="text-cyan-premium" />
          <span>Thời gian áp dụng: Tuần {activeWeekInfo.week} ({activeWeekInfo.start_str} - {activeWeekInfo.end_str})</span>
        </div>
      )}

      {/* Budget Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-premium"></div>
          <span className="text-xs text-gray-500 tracking-wide uppercase font-semibold">Đang chuẩn bị dữ liệu...</span>
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-dark-glass border border-dark-border rounded-2xl p-12 text-center text-gray-500 text-xs uppercase tracking-widest font-medium">
          Chưa thiết lập ngân sách tuần nào cho khoảng thời gian này. Hãy nhấn "Thêm ngân sách tuần" để thiết lập nhé.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 perspective-3d">
          {budgets.map(budget => (
            <div 
              key={budget.id} 
              id={`budget-card-${budget.category_name.toLowerCase()}`}
              className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:border-white/10 transition-all duration-300 group tilt-card-3d"
            >
              <div className="absolute w-32 h-32 bg-cyan-premium blur-[35px] -top-12 -right-12 opacity-[0.05] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10 preserve-3d-child">
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">{budget.category_name}</h3>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">NHÓM HẠN MỨC</p>
                </div>
                
                <div className="flex gap-2.5">
                  <button 
                    onClick={() => handleEdit(budget)} 
                    className="text-cyan-premium hover:text-cyan-300 transition-colors p-1.5 hover:bg-cyan-premium/10 rounded-lg cursor-pointer"
                    title="Sửa ngân sách"
                  >
                    <FaEdit className="text-sm animate-float-3d" />
                  </button>
                  <button 
                    onClick={() => handleDelete(budget.id)} 
                    className="text-rose-premium hover:text-rose-300 transition-colors p-1.5 hover:bg-rose-premium/10 rounded-lg cursor-pointer"
                    title="Xóa ngân sách"
                  >
                    <FaTrash className="text-sm animate-float-3d-delayed" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4 relative z-10 preserve-3d-child">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-400">Đã chi tiêu</span>
                  <span className="text-white font-semibold font-mono">{formatVND(budget.spent)} / {formatVND(budget.amount)}</span>
                </div>
                
                <div className="w-full bg-white/[0.04] rounded-full h-3 overflow-hidden border border-white/[0.03] p-[1.5px]">
                  <div
                    className={`${getProgressColor(budget.percentage)} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
              </div>
              
              <div className="flex justify-between text-xs relative z-10 border-t border-dark-border/40 pt-3 preserve-3d-child">
                <span className="text-gray-400">Trạng thái số dư</span>
                <span className={`font-bold font-mono tracking-tight ${budget.remaining >= 0 ? 'text-emerald-premium' : 'text-rose-premium'}`}>
                  {budget.remaining < 0 ? 'Vượt hạn mức ' : 'Còn lại '}{formatVND(Math.abs(budget.remaining))}
                </span>
              </div>
              
              {budget.percentage >= 80 && (
                <div className={`mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold relative z-10 preserve-3d-child ${
                  budget.percentage >= 100 
                    ? 'bg-rose-premium/10 border border-rose-premium/20 text-rose-300 animate-pulse' 
                    : 'bg-amber-premium/10 border border-amber-premium/20 text-amber-300'
                }`}>
                  <FaExclamationTriangle className="flex-shrink-0" />
                  <span>
                    {budget.percentage >= 100 
                      ? 'VƯỢT HẠN MỨC: Hãy dừng chi tiêu ngay lập tức!' 
                      : 'CẢNH BÁO: Sắp chạm trần ngân sách cho phép!'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit Budget */}
      {showModal && (
        <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-md w-full p-8 shadow-2xl relative animate-modal-scale">
            <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">
                {editingBudget ? 'Sửa Hạn Mức Ngân Sách' : 'Thiết Lập Hạn Mức Ngân Sách'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 bg-white/[0.03] border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <FaTimes size={12} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Danh mục
                </label>
                <div className="relative">
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                    required
                    disabled={editingBudget}
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}{(!cat.user_id) ? ' 🔒' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                    <FaChevronDown />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Số tiền hạn mức (VNĐ)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  placeholder="0"
                  required
                />
              </div>

              {/* Show selected week info inside the form */}
              <div className="p-3 bg-white/[0.02] border border-dark-border/40 rounded-xl text-xs text-gray-400">
                <span>Thiết lập cho khoảng thời gian: </span>
                <span className="font-semibold text-white">
                  Tuần {formData.week} {activeWeekInfo ? `(${activeWeekInfo.start_str} - ${activeWeekInfo.end_str})` : ''}
                </span>
              </div>
              
              <div className="flex gap-3.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-white/[0.02] border border-dark-border rounded-xl text-xs text-gray-400 hover:text-white font-heading font-extrabold transition-all cursor-pointer"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-xs tracking-wider rounded-xl transition-all neo-button-3d cursor-pointer"
                >
                  {editingBudget ? 'CẬP NHẬT HẠN MỨC' : 'THIẾT LẬP HẠN MỨC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgets;