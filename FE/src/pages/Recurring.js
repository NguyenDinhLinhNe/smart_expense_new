import React, { useState, useEffect } from 'react';
import { getRecurringTransactions, createRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, getCategories } from '../services/api';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaSync, FaToggleOn, FaToggleOff, FaCalendarAlt, FaChevronDown } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatVND } from '../services/utils';

const Recurring = () => {
  const [recurrings, setRecurrings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    type: 'expense',
    description: '',
    frequency: 'monthly',
    day_of_period: 1,
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recurringsRes, categoriesRes] = await Promise.all([
        getRecurringTransactions(),
        getCategories()
      ]);
      setRecurrings(recurringsRes.data.recurring_transactions || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (error) {
      toast.error('Failed to load recurring data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await updateRecurringTransaction(rule.id, { is_active: !rule.is_active });
      toast.success(rule.is_active ? 'Rule paused' : 'Rule activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle state');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this recurring rule?')) {
      try {
        await deleteRecurringTransaction(id);
        toast.success('Recurring rule deleted');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete rule');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRecurring) {
        await updateRecurringTransaction(editingRecurring.id, formData);
        toast.success('Recurring rule updated');
      } else {
        await createRecurringTransaction(formData);
        toast.success('Recurring rule created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save recurring rule');
    }
  };

  const resetForm = () => {
    setEditingRecurring(null);
    setFormData({
      category_id: '',
      amount: '',
      type: 'expense',
      description: '',
      frequency: 'monthly',
      day_of_period: 1,
      is_active: true
    });
  };

  const handleEdit = (rule) => {
    setEditingRecurring(rule);
    setFormData({
      category_id: rule.category_id,
      amount: rule.amount,
      type: rule.type,
      description: rule.description || '',
      frequency: rule.frequency,
      day_of_period: rule.day_of_period,
      is_active: rule.is_active
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6 relative">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 bg-gradient-to-r from-emerald-premium/5 to-cyan-premium/5 border border-dark-border rounded-3xl relative overflow-hidden backdrop-blur-md tilt-card-3d">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-premium/10 blur-[60px] rounded-full pointer-events-none"></div>
        <div className="preserve-3d-child">
          <h2 className="text-xl font-black text-white font-heading mb-1.5 flex items-center gap-2">
            <FaSync className="text-emerald-premium animate-spin-slow" />
            GIAO DỊCH ĐỊNH KỲ
          </h2>
          <p className="text-gray-400 text-xs tracking-wide">
            Tự động hóa các hóa đơn định kỳ, dịch vụ đăng ký thuê bao hoặc lương định kỳ.
          </p>
        </div>
        
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-premium to-cyan-premium text-white font-bold rounded-2xl text-xs shadow-cyan-glow transition-all hover:scale-105 active:scale-95 cursor-pointer neo-button-3d preserve-3d-child"
        >
          <FaPlus size={11} />
          THÊM QUY TẮC ĐỊNH KỲ
        </button>
      </div>

      {/* Rules List Container */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-premium"></div>
        </div>
      ) : recurrings.length === 0 ? (
        <div className="text-center py-16 bg-[#101622]/50 border border-dark-border rounded-3xl backdrop-blur-md">
          <FaSync size={40} className="mx-auto text-gray-600 mb-4 animate-pulse" />
          <p className="text-gray-400 text-xs font-semibold">Chưa tìm thấy quy tắc định kỳ hoạt động nào.</p>
          <p className="text-gray-600 text-[10px] mt-1">Hãy tạo quy tắc đầu tiên để hệ thống tự động ghi sổ nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 perspective-3d">
          {recurrings.map(rule => (
            <div 
              key={rule.id} 
              className={`p-6 border rounded-3xl bg-[#101622]/80 backdrop-blur-md relative overflow-hidden transition-all hover:-translate-y-1 tilt-card-3d ${
                rule.is_active ? 'border-dark-border hover:border-emerald-premium/45' : 'border-dark-border opacity-60'
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-premium/5 blur-2xl rounded-full pointer-events-none"></div>
              <div className="preserve-3d-child">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center bg-white/[0.04] border border-dark-border rounded-xl text-lg">
                    {rule.category_icon || '📌'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{rule.category_name}</h4>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                      {rule.frequency === 'daily' ? 'Hàng ngày' : rule.frequency === 'weekly' ? 'Hàng tuần' : rule.frequency === 'monthly' ? 'Hàng tháng' : rule.frequency} 
                      {rule.frequency !== 'daily' && ` (Ngày ${rule.day_of_period})`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => handleToggleActive(rule)} 
                    className="text-lg transition-colors cursor-pointer text-gray-400 hover:text-white"
                  >
                    {rule.is_active ? <FaToggleOn className="text-emerald-premium" /> : <FaToggleOff className="text-gray-600" />}
                  </button>
                  <button 
                    onClick={() => handleEdit(rule)} 
                    className="p-1.5 bg-white/[0.02] border border-dark-border rounded-lg text-gray-400 hover:text-cyan-premium transition-colors cursor-pointer"
                  >
                    <FaEdit size={11} />
                  </button>
                  <button 
                    onClick={() => handleDelete(rule.id)} 
                    className="p-1.5 bg-white/[0.02] border border-dark-border rounded-lg text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <FaTrash size={11} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-dark-border/40">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Số tiền</span>
                  <span className={`text-sm font-black font-heading ${rule.type === 'income' ? 'text-emerald-premium' : 'text-rose-500'}`}>
                    {rule.type === 'income' ? '+' : '-'}{formatVND(rule.amount)}
                  </span>
                </div>
                {rule.description && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500 font-semibold uppercase tracking-wider">Mô tả</span>
                    <span className="text-gray-300 font-medium truncate max-w-[150px]">{rule.description}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500 font-semibold uppercase tracking-wider">Lần chạy cuối</span>
                  <span className="text-gray-400 font-mono font-semibold">{rule.last_executed ? new Date(rule.last_executed).toLocaleDateString('vi-VN') : 'Chưa chạy'}</span>
                </div>
              </div>
              
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit Rule */}
      {showModal && (
        <div className="modal-backdrop-premium animate-fade-in">
          <div className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-md w-full p-8 shadow-2xl relative animate-modal-scale max-h-[85vh] overflow-y-auto custom-scrollbar bg-dark-glass">
            <div className="absolute w-24 h-24 bg-emerald-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">
                {editingRecurring ? 'Sửa Quy Tắc' : 'Quy Tắc Định Kỳ Mới'}
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
                  Số tiền (VNĐ)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                  placeholder="0"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Loại giao dịch
                  </label>
                  <div className="relative">
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value, category_id: '' })}
                      className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                    >
                      <option value="expense">Chi tiêu</option>
                      <option value="income">Thu nhập</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                      <FaChevronDown />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Danh mục
                  </label>
                  <div className="relative">
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                      required
                    >
                      <option value="">Chọn</option>
                      {categories.filter(c => c.type === formData.type).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                      <FaChevronDown />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Tần suất
                  </label>
                  <div className="relative">
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value, day_of_period: 1 })}
                      className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                    >
                      <option value="daily">Hàng ngày</option>
                      <option value="weekly">Hàng tuần</option>
                      <option value="monthly">Hàng tháng</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                      <FaChevronDown />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    {formData.frequency === 'weekly' ? 'Ngày trong tuần' : formData.frequency === 'monthly' ? 'Ngày trong tháng' : 'Không có'}
                  </label>
                  {formData.frequency === 'daily' ? (
                    <input
                      type="text"
                      disabled
                      value="Mỗi ngày"
                      className="w-full px-4 py-3 bg-white/[0.02] border border-dark-border rounded-xl text-xs text-gray-500 cursor-not-allowed"
                    />
                  ) : formData.frequency === 'weekly' ? (
                    <div className="relative">
                      <select
                        value={formData.day_of_period}
                        onChange={(e) => setFormData({ ...formData, day_of_period: parseInt(e.target.value) })}
                        className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                      >
                        <option value="0">Thứ Hai</option>
                        <option value="1">Thứ Ba</option>
                        <option value="2">Thứ Tư</option>
                        <option value="3">Thứ Năm</option>
                        <option value="4">Thứ Sáu</option>
                        <option value="5">Thứ Bảy</option>
                        <option value="6">Chủ Nhật</option>
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                        <FaChevronDown />
                      </div>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.day_of_period}
                      onChange={(e) => setFormData({ ...formData, day_of_period: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-premium focus:shadow-emerald-glow transition-all"
                  placeholder="Ví dụ: Tiền thuê nhà hàng tháng, đăng ký Netflix"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-emerald-premium to-cyan-premium hover:opacity-90 text-white font-extrabold rounded-2xl text-xs tracking-wider uppercase shadow-cyan-glow transition-all cursor-pointer neo-button-3d"
                >
                  {editingRecurring ? 'CẬP NHẬT QUY TẮC' : 'THIẾT LẬP QUY TẮC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recurring;
