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
    <div className="space-y-8 animate-fade-in font-body">
      {/* Header Panel */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-dark-glass border border-dark-border p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -bottom-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-heading">
            Weekly Budgets
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Control weekly limits to enforce healthy savings goals</p>
        </div>
        
        <div className="flex items-center flex-wrap gap-3.5 self-start xl:self-center">
          {/* Week selector */}
          {weeks.length > 0 && (
            <div className="relative">
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="appearance-none pl-4 pr-9 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
              >
                {weeks.map(w => (
                  <option key={w.week} value={w.week}>
                    Week {w.week} ({w.start_str} - {w.end_str})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-xs">
                <FaChevronDown />
              </div>
            </div>
          )}

          {/* Month selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(parseInt(e.target.value));
                setSelectedWeek(null);
              }}
              className="appearance-none pl-4 pr-9 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>Month {month}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-xs">
              <FaChevronDown />
            </div>
          </div>
          
          {/* Year selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value));
                setSelectedWeek(null);
              }}
              className="appearance-none pl-4 pr-9 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            >
              {[2023, 2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-xs">
              <FaChevronDown />
            </div>
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="py-2.5 px-5 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-xs tracking-wide shadow-md shadow-cyan-premium/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-premium/40 active:translate-y-0 transition-all flex items-center gap-2 rounded-xl"
          >
            <FaPlus /> <span>ADD WEEKLY BUDGET</span>
          </button>
        </div>
      </div>

      {activeWeekInfo && (
        <div className="flex items-center gap-2 px-1 text-xs text-gray-400">
          <FaCalendarAlt className="text-cyan-premium" />
          <span>Active Period: Week {activeWeekInfo.week} ({activeWeekInfo.start_str} - {activeWeekInfo.end_str})</span>
        </div>
      )}

      {/* Budget Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-premium"></div>
          <span className="text-xs text-gray-500 tracking-wide uppercase font-semibold">Tuning allowances...</span>
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-dark-glass border border-dark-border rounded-2xl p-12 text-center text-gray-500 text-xs uppercase tracking-widest font-medium">
          No weekly budgets found for this period. Click "Add Weekly Budget" to establish parameters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map(budget => (
            <div 
              key={budget.id} 
              id={`budget-card-${budget.category_name.toLowerCase()}`}
              className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:-translate-y-1 hover:border-white/10 transition-[box-shadow,transform,border-color] duration-500 group"
            >
              <div className="absolute w-32 h-32 bg-cyan-premium blur-[35px] -top-12 -right-12 opacity-[0.05] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">{budget.category_name}</h3>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">ALLOWANCE GROUP</p>
                </div>
                
                <div className="flex gap-2.5">
                  <button 
                    onClick={() => handleEdit(budget)} 
                    className="text-cyan-premium hover:text-cyan-300 transition-colors p-1.5 hover:bg-cyan-premium/10 rounded-lg"
                    title="Edit budget limit"
                  >
                    <FaEdit className="text-sm" />
                  </button>
                  <button 
                    onClick={() => handleDelete(budget.id)} 
                    className="text-rose-premium hover:text-rose-300 transition-colors p-1.5 hover:bg-rose-premium/10 rounded-lg"
                    title="Delete budget limit"
                  >
                    <FaTrash className="text-sm" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4 relative z-10">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-400">Total Spent</span>
                  <span className="text-white font-semibold font-mono">{formatVND(budget.spent)} / {formatVND(budget.amount)}</span>
                </div>
                
                <div className="w-full bg-white/[0.04] rounded-full h-3 overflow-hidden border border-white/[0.03] p-[1.5px]">
                  <div
                    className={`${getProgressColor(budget.percentage)} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
              </div>
              
              <div className="flex justify-between text-xs relative z-10 border-t border-dark-border/40 pt-3">
                <span className="text-gray-400">Balance Status</span>
                <span className={`font-bold font-mono tracking-tight ${budget.remaining >= 0 ? 'text-emerald-premium' : 'text-rose-premium'}`}>
                  {budget.remaining < 0 ? '-' : ''}{formatVND(Math.abs(budget.remaining))} {budget.remaining < 0 ? 'overspent' : 'remaining'}
                </span>
              </div>
              
              {budget.percentage >= 80 && (
                <div className={`mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold relative z-10 ${
                  budget.percentage >= 100 
                    ? 'bg-rose-premium/10 border border-rose-premium/20 text-rose-300 animate-pulse' 
                    : 'bg-amber-premium/10 border border-amber-premium/20 text-amber-300'
                }`}>
                  <FaExclamationTriangle className="flex-shrink-0" />
                  <span>
                    {budget.percentage >= 100 
                      ? 'EXCEEDED: Stop spending immediately!' 
                      : 'WARNING: Rapidly approaching allocation ceiling!'}
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
                {editingBudget ? 'Edit Weekly Allowance' : 'Set Weekly Allowance Limit'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 bg-white/[0.03] border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={12} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                    required
                    disabled={editingBudget}
                  >
                    <option value="">Select Category</option>
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
                  Budget Amount (VND)
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
                <span>Saving to Period: </span>
                <span className="font-semibold text-white">
                  Week {formData.week} {activeWeekInfo ? `(${activeWeekInfo.start_str} - ${activeWeekInfo.end_str})` : ''}
                </span>
              </div>
              
              <div className="flex gap-3.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-white/[0.02] border border-dark-border rounded-xl text-xs text-gray-400 hover:text-white font-heading font-extrabold transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-xs tracking-wider rounded-xl transition-all shadow-md shadow-cyan-premium/10 hover:shadow-cyan-premium/30"
                >
                  {editingBudget ? 'UPDATE ALLOWANCE' : 'ESTABLISH ALLOWANCE'}
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