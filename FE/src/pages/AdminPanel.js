import React, { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory, getUsers } from '../services/api';
import { 
  FaUserShield, 
  FaUsers, 
  FaTags, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaTimes, 
  FaCheck, 
  FaFolderOpen 
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const PRESET_COLORS = [
  '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', 
  '#f43f5e', '#3b82f6', '#ec4899', '#14b8a6', 
  '#ff6b6b', '#ffeaa7', '#dda0dd', '#96ceb4'
];

const PRESET_EMOJIS = [
  '🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '💰', 
  '💻', '📈', '✈️', '🏠', '🎁', '🍕', '☕', '👟', 
  '🏋️', '🎮', '📞', '🛡️', '📌', '⭐', '🐾', '🌍'
];

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals / Editing States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  
  // Category Form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '📌',
    color: '#06b6d4',
    type: 'expense'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, catRes] = await Promise.all([
        getUsers(),
        getCategories()
      ]);
      setUsers(userRes.data.users);
      const globalCats = catRes.data.categories.filter(c => c.user_id === null || c.user_id === undefined);
      setCategories(globalCats);
    } catch (error) {
      toast.error('Failed to load data from server.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Category name cannot be empty.');
      return;
    }

    try {
      if (editingCategory) {
        // Calling update API for the global category
        await updateCategory(editingCategory.id, categoryForm);
        toast.success('Global category updated successfully!');
      } else {
        // Creating a new Global category requires passing is_global: true
        await createCategory({ ...categoryForm, is_global: true });
        toast.success('Global category created successfully!');
      }
      setShowCategoryModal(false);
      resetCategoryForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not complete this operation.');
    }
  };

  const handleEditCategoryClick = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Are you sure you want to delete this global category? It will no longer be available for any users.')) {
      try {
        await deleteCategory(id);
        toast.success('Global category deleted successfully!');
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete category. It might be linked to existing transactions.');
      }
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      icon: '📌',
      color: '#06b6d4',
      type: 'expense'
    });
    setEditingCategory(null);
  };

  // Stats calculation
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = totalUsers - adminCount;
  const totalGlobalCategories = categories.length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section with glass panel and custom glow */}
      <div className="glass-panel px-8 py-7 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border border-white/[0.06] bg-[#101622]/65 backdrop-blur-md">
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-premium/20 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3.5 tracking-tight font-heading text-transparent bg-clip-text bg-gradient-to-r from-cyan-premium via-purple-premium to-teal-premium">
            <FaUserShield className="text-cyan-premium animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
            System Administration
          </h1>
          <p className="text-gray-400 mt-1.5 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Manage system resources, configure default global categories, and audit system registered users directory.
          </p>
        </div>
        
        {activeTab === 'categories' && (
          <button
            onClick={() => {
              resetCategoryForm();
              setShowCategoryModal(true);
            }}
            className="relative z-10 flex items-center gap-2.5 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-cyan-premium/20 hover:shadow-cyan-premium/30 hover:scale-[1.03] active:scale-95 transition-all duration-200 border border-white/10 group"
          >
            <FaPlus className="text-xs group-hover:rotate-90 transition-transform duration-200" />
            <span>Add Global Category</span>
          </button>
        )}
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="glass-panel relative p-6 rounded-2xl border border-white/[0.06] bg-[#101622]/50 backdrop-blur-md overflow-hidden kpi-card-hover group">
          <div className="kpi-glow bg-cyan-premium/20"></div>
          <div className="relative z-10 flex justify-between items-start mb-4">
            <div>
              <h3 className="text-gray-500 font-bold uppercase text-[10px] tracking-widest font-heading">Total Users</h3>
              <p className="text-3xl font-black text-white mt-1 font-heading tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                {loading ? '...' : totalUsers}
              </p>
            </div>
            <div className="p-3 bg-cyan-premium/10 text-cyan-premium rounded-xl shadow-md border border-cyan-premium/25 shadow-cyan-premium/5">
              <FaUsers size={20} />
            </div>
          </div>
          <div className="relative z-10 text-xs text-gray-500 font-medium">Registered system accounts</div>
        </div>

        {/* Administrators */}
        <div className="glass-panel relative p-6 rounded-2xl border border-white/[0.06] bg-[#101622]/50 backdrop-blur-md overflow-hidden kpi-card-hover group">
          <div className="kpi-glow bg-purple-premium/20"></div>
          <div className="relative z-10 flex justify-between items-start mb-4">
            <div>
              <h3 className="text-gray-500 font-bold uppercase text-[10px] tracking-widest font-heading">Administrators</h3>
              <p className="text-3xl font-black text-white mt-1 font-heading tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                {loading ? '...' : adminCount}
              </p>
            </div>
            <div className="p-3 bg-purple-premium/10 text-purple-premium rounded-xl shadow-md border border-purple-premium/25 shadow-purple-premium/5">
              <FaUserShield size={20} />
            </div>
          </div>
          <div className="relative z-10 text-xs text-gray-500 font-medium">Privileged access roles</div>
        </div>

        {/* Standard Users */}
        <div className="glass-panel relative p-6 rounded-2xl border border-white/[0.06] bg-[#101622]/50 backdrop-blur-md overflow-hidden kpi-card-hover group">
          <div className="kpi-glow bg-emerald-premium/20"></div>
          <div className="relative z-10 flex justify-between items-start mb-4">
            <div>
              <h3 className="text-gray-500 font-bold uppercase text-[10px] tracking-widest font-heading">Standard Users</h3>
              <p className="text-3xl font-black text-white mt-1 font-heading tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                {loading ? '...' : userCount}
              </p>
            </div>
            <div className="p-3 bg-emerald-premium/10 text-emerald-premium rounded-xl shadow-md border border-emerald-premium/25 shadow-emerald-premium/5">
              <FaUsers size={20} />
            </div>
          </div>
          <div className="relative z-10 text-xs text-gray-500 font-medium">Standard customer tier</div>
        </div>

        {/* Global Categories */}
        <div className="glass-panel relative p-6 rounded-2xl border border-white/[0.06] bg-[#101622]/50 backdrop-blur-md overflow-hidden kpi-card-hover group">
          <div className="kpi-glow bg-amber-premium/20"></div>
          <div className="relative z-10 flex justify-between items-start mb-4">
            <div>
              <h3 className="text-gray-500 font-bold uppercase text-[10px] tracking-widest font-heading">Global Categories</h3>
              <p className="text-3xl font-black text-white mt-1 font-heading tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                {loading ? '...' : totalGlobalCategories}
              </p>
            </div>
            <div className="p-3 bg-amber-premium/10 text-amber-premium rounded-xl shadow-md border border-amber-premium/25 shadow-amber-premium/5">
              <FaTags size={20} />
            </div>
          </div>
          <div className="relative z-10 text-xs text-gray-500 font-medium">Default expense options</div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-[#0b0f19]/60 backdrop-blur-md p-1 border border-white/[0.05] rounded-xl max-w-sm shadow-inner shadow-black/40">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTab === 'categories'
              ? 'bg-gradient-to-r from-cyan-premium to-purple-premium text-white shadow-md shadow-cyan-premium/20'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <FaTags size={12} />
          <span>Global Categories</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-cyan-premium to-purple-premium text-white shadow-md shadow-cyan-premium/20'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <FaUsers size={13} />
          <span>User Directory</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="glass-panel p-20 flex justify-center items-center border border-white/[0.06] bg-[#101622]/40 backdrop-blur-lg rounded-2xl shadow-xl">
          <div className="relative flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-premium/20 border-t-cyan-premium animate-spin"></div>
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-widest mt-4">Syncing server database...</span>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 border border-white/[0.06] bg-[#101622]/40 backdrop-blur-lg rounded-2xl shadow-xl">
          {activeTab === 'categories' ? (
            /* Category Management Tab */
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-premium/10 border border-cyan-premium/25 flex items-center justify-center text-cyan-premium">
                  <FaFolderOpen size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight font-heading">
                    Manage Default Categories
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">Add, update, or remove default template categories loaded for every new user</p>
                </div>
              </div>
              
              {categories.length === 0 ? (
                <div className="text-center py-20 text-gray-500 border border-dashed border-white/[0.06] rounded-xl bg-black/10">
                  <FaTags size={36} className="mx-auto mb-4 text-gray-600 opacity-60 animate-bounce" />
                  <p className="font-semibold text-gray-400">No global categories found</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Create a template category by clicking the Add Global Category button above</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-black/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/[0.06] text-gray-400 font-bold text-[10px] tracking-wider uppercase">
                        <th className="py-4 px-5 w-20">Icon</th>
                        <th className="py-4 px-5">Category Name</th>
                        <th className="py-4 px-5">Color Code</th>
                        <th className="py-4 px-5">Transaction Type</th>
                        <th className="py-4 px-5 text-right w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-white/[0.02] transition-colors duration-150 text-sm">
                          <td className="py-4 px-5">
                            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-xl shadow-inner shadow-black/20">
                              {cat.icon}
                            </span>
                          </td>
                          <td className="py-4 px-5 font-bold text-white font-heading text-[15px]">{cat.name}</td>
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2.5">
                              <span 
                                className="inline-block w-3.5 h-3.5 rounded-full border border-white/20 shadow-md" 
                                style={{ backgroundColor: cat.color, boxShadow: `0 0 10px ${cat.color}80` }}
                              ></span>
                              <span className="font-mono text-gray-400 text-xs font-semibold">{cat.color.toUpperCase()}</span>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 border ${
                              cat.type === 'expense' 
                                ? 'bg-rose-premium/10 text-rose-premium border-rose-premium/20 shadow-[0_0_12px_rgba(244,63,94,0.06)]' 
                                : 'bg-emerald-premium/10 text-emerald-premium border-emerald-premium/20 shadow-[0_0_12px_rgba(16,185,129,0.06)]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cat.type === 'expense' ? 'bg-rose-premium' : 'bg-emerald-premium'}`} />
                              <span className="capitalize">{cat.type}</span>
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex justify-end gap-2.5">
                              <button
                                onClick={() => handleEditCategoryClick(cat)}
                                className="p-2 text-cyan-premium hover:text-white bg-cyan-premium/10 hover:bg-cyan-premium hover:scale-105 rounded-lg border border-cyan-premium/20 transition-all shadow-md shadow-cyan-premium/5"
                                title="Edit Category"
                              >
                                <FaEdit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 text-rose-premium hover:text-white bg-rose-premium/10 hover:bg-rose-premium hover:scale-105 rounded-lg border border-rose-premium/20 transition-all shadow-md shadow-rose-premium/5"
                                title="Delete Category"
                              >
                                <FaTrash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* User Directory Tab */
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-premium/10 border border-purple-premium/25 flex items-center justify-center text-purple-premium">
                  <FaUsers size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight font-heading">
                    System User Directory
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">Verify credentials, roles, and administrative records of all signed up members</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-black/10">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.06] text-gray-400 font-bold text-[10px] tracking-wider uppercase">
                      <th className="py-4 px-5">User Profile</th>
                      <th className="py-4 px-5">Email Address</th>
                      <th className="py-4 px-5">Access Rank</th>
                      <th className="py-4 px-5">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors duration-150 text-sm">
                        <td className="py-4 px-5 font-bold text-white font-heading text-[15px] flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-premium/20 to-purple-premium/20 border border-cyan-premium/30 flex items-center justify-center text-xs font-black text-cyan-premium">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{u.name}</span>
                        </td>
                        <td className="py-4 px-5 text-gray-300 font-mono text-xs">{u.email}</td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            u.role === 'admin' 
                              ? 'bg-purple-premium/20 text-purple-premium border-purple-premium/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]' 
                              : 'bg-white/[0.04] text-gray-400 border-white/[0.06]'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-gray-400 font-medium">
                          {new Date(u.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Modal (Add/Edit) */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d16]/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel max-w-lg w-full overflow-hidden border border-white/[0.08] bg-[#101622]/90 backdrop-blur-xl shadow-2xl shadow-black/80 animate-modal-scale relative">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-premium/10 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
            <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-premium/10 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
            
            {/* Modal Header */}
            <div className="relative z-10 flex justify-between items-center px-6 py-5 bg-[#0b0f19]/80 border-b border-white/[0.08]">
              <h3 className="text-lg font-extrabold text-white tracking-tight font-heading">
                {editingCategory ? '✏️ Edit Global Category' : '✨ Add Global Category'}
              </h3>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  resetCategoryForm();
                }} 
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCategorySubmit} className="relative z-10 p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 font-heading">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Travel, Shopping, Bills..."
                  className="w-full bg-[#0b0f19]/90 border border-white/[0.08] focus:border-cyan-premium rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-all focus:ring-1 focus:ring-cyan-premium/30 font-medium"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 font-heading">Transaction Type</label>
                  <select
                    className="w-full bg-[#0b0f19]/95 border border-white/[0.08] focus:border-cyan-premium rounded-xl px-4 py-3 text-white outline-none transition-all focus:ring-1 focus:ring-cyan-premium/30 font-semibold"
                    value={categoryForm.type}
                    onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}
                  >
                    <option className="bg-[#101622] text-white" value="expense">Expense</option>
                    <option className="bg-[#101622] text-white" value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 font-heading">Current Icon</label>
                  <div className="w-full bg-[#0b0f19]/60 border border-white/[0.06] rounded-xl py-2 px-4 text-3xl text-center shadow-inner shadow-black/25">
                    {categoryForm.icon}
                  </div>
                </div>
              </div>

              {/* Emoji Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 font-heading">Select Icon (Emoji)</label>
                <div className="grid grid-cols-8 gap-2 bg-[#0b0f19]/60 p-3 rounded-xl max-h-32 overflow-y-auto border border-white/[0.06] custom-scroll">
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, icon: emoji })}
                      className={`text-2xl p-1.5 rounded-lg hover:bg-white/[0.05] transition-all flex items-center justify-center ${
                        categoryForm.icon === emoji ? 'bg-gradient-to-br from-cyan-premium to-purple-premium scale-110 shadow-md shadow-cyan-premium/25' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 font-heading">Representative Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    className="w-11 h-11 bg-transparent cursor-pointer rounded-xl overflow-hidden border border-white/[0.08] flex-shrink-0 transition-transform hover:scale-105"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="flex-1 bg-[#0b0f19]/90 border border-white/[0.08] focus:border-cyan-premium rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-500 outline-none transition-all focus:ring-1 focus:ring-cyan-premium/30"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2 bg-[#0b0f19]/60 p-3 rounded-xl border border-white/[0.06]">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, color: color })}
                      className="w-7 h-7 rounded-lg transition-all flex items-center justify-center hover:scale-110 shadow-md"
                      style={{ backgroundColor: color, border: categoryForm.color === color ? '2px solid white' : '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {categoryForm.color === color && <FaCheck size={10} className="text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    resetCategoryForm();
                  }}
                  className="bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.06] text-white font-bold py-2.5 px-5 rounded-xl transition-all text-xs tracking-wider uppercase active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-bold py-2.5 px-6 rounded-xl transition-all text-xs tracking-wider uppercase active:scale-95 shadow-lg shadow-cyan-premium/20 hover:shadow-cyan-premium/30 border border-white/10"
                >
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

