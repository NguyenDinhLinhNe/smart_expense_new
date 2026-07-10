import React, { useState, useEffect } from 'react';
import { getReports, getWeeklyReports, exportReport } from '../services/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { FaDownload, FaChevronDown, FaChevronUp, FaCalendarAlt, FaDatabase, FaList } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatVND } from '../services/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const [reportData, setReportData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'weekly'
  const [expandedWeek, setExpandedWeek] = useState(null);

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear, viewMode]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      if (viewMode === 'monthly') {
        const response = await getReports({ month: selectedMonth, year: selectedYear });
        setReportData(response.data);
      } else {
        const response = await getWeeklyReports({ month: selectedMonth, year: selectedYear });
        setWeeklyData(response.data);
        // Default expand first week with transactions
        if (response.data && response.data.weekly_data.length > 0) {
          setExpandedWeek(0);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await exportReport(format, { month: selectedMonth, year: selectedYear });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expense_report_${selectedMonth}_${selectedYear}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-premium"></div>
        <span className="text-xs text-gray-500 tracking-wide uppercase font-semibold">Compiling financial indexes...</span>
      </div>
    );
  }

  // Monthly View Calculations
  const expenseCategories = reportData && reportData.category_breakdown ? Object.keys(reportData.category_breakdown) : [];
  const incomeCategories = reportData && reportData.income_category_breakdown ? Object.keys(reportData.income_category_breakdown) : [];
  const allLabels = Array.from(new Set([...expenseCategories, ...incomeCategories]));

  const monthlyChartData = {
    labels: allLabels,
    datasets: [
      {
        label: 'Thu nhập',
        data: allLabels.map(label => reportData?.income_category_breakdown?.[label] || 0),
        backgroundColor: '#10b981',
        borderRadius: 8,
        borderWidth: 0
      },
      {
        label: 'Chi tiêu',
        data: allLabels.map(label => reportData?.category_breakdown?.[label] || 0),
        backgroundColor: '#f43f5e',
        borderRadius: 8,
        borderWidth: 0
      }
    ]
  };

  // Weekly View Calculations
  const weeklyLabels = weeklyData && weeklyData.weekly_data ? weeklyData.weekly_data.map(w => `${w.label.replace('Week', 'Tuần')} (${w.start_str} - ${w.end_str})`) : [];
  const weeklyChartData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: 'Thu nhập',
        data: weeklyData && weeklyData.weekly_data ? weeklyData.weekly_data.map(w => w.income) : [],
        backgroundColor: '#10b981',
        borderRadius: 8,
        borderWidth: 0
      },
      {
        label: 'Chi tiêu',
        data: weeklyData && weeklyData.weekly_data ? weeklyData.weekly_data.map(w => w.expense) : [],
        backgroundColor: '#f43f5e',
        borderRadius: 8,
        borderWidth: 0
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: '500'
          }
        }
      },
      tooltip: {
        backgroundColor: '#101622',
        titleColor: '#ffffff',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatVND(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'Inter, sans-serif',
            size: 10
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.02)'
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'Inter, sans-serif',
            size: 10
          },
          callback: (value) => formatVND(value)
        }
      }
    }
  };

  const currentKPI = viewMode === 'monthly' ? {
    income: reportData?.total_income || 0,
    expense: reportData?.total_expense || 0,
    balance: (reportData?.total_income - reportData?.total_expense) || 0
  } : {
    income: weeklyData?.total_income || 0,
    expense: weeklyData?.total_expense || 0,
    balance: weeklyData?.balance || 0
  };

  // Render check for empty states
  if (viewMode === 'monthly' && !reportData) {
    return (
      <div className="text-center py-16 bg-dark-glass border border-dark-border rounded-2xl p-8 shadow-xl max-w-xl mx-auto font-body">
        <FaDatabase className="text-4xl text-cyan-premium mb-4 mx-auto animate-pulse" />
        <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">
          No records captured
        </h3>
        <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
          Please verify that the backend services are running and you have transactions logged under the chosen parameters.
        </p>
      </div>
    );
  }

  if (viewMode === 'weekly' && !weeklyData) {
    return (
      <div className="text-center py-16 bg-dark-glass border border-dark-border rounded-2xl p-8 shadow-xl max-w-xl mx-auto font-body">
        <FaDatabase className="text-4xl text-cyan-premium mb-4 mx-auto animate-pulse" />
        <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">
          Không có bản ghi tuần nào
        </h3>
        <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
          Vui lòng kiểm tra lại dịch vụ backend có hoạt động và bạn đã ghi nhận giao dịch trong thời gian đã chọn hay chưa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-body perspective-3d">
      {/* Header Panel */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-dark-glass border border-dark-border p-6 rounded-2xl relative overflow-hidden tilt-card-3d">
        <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -bottom-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
        <div className="preserve-3d-child">
          <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-heading">
            Báo Cáo Tài Chính
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Thống kê tương tác, cơ cấu danh mục và xuất tệp tin dữ liệu</p>
        </div>
        
        <div className="flex items-center flex-wrap gap-3.5 self-start xl:self-center preserve-3d-child">
          {/* View Mode Toggle */}
          <div className="flex bg-[#0f172a]/80 p-1 border border-dark-border rounded-xl">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly'
                  ? 'bg-cyan-premium text-black shadow-md shadow-cyan-premium/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              HÀNG THÁNG
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'weekly'
                  ? 'bg-cyan-premium text-black shadow-md shadow-cyan-premium/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              HÀNG TUẦN
            </button>
          </div>

          {/* Month selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="appearance-none pl-4 pr-9 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>Tháng {month}</option>
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
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none pl-4 pr-9 py-2.5 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            >
              {[2023, 2024, 2025, 2026].map(year => (
                <option key={year} value={year}>Năm {year}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-xs">
              <FaChevronDown />
            </div>
          </div>
          
          <button
            onClick={() => handleExport('csv')}
            className="py-2.5 px-5 bg-gradient-to-r from-emerald-premium to-teal-premium text-white font-heading font-extrabold text-xs tracking-wide shadow-md shadow-emerald-premium/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-premium/45 active:translate-y-0 transition-all flex items-center gap-2.5 rounded-xl font-heading neo-button-3d cursor-pointer"
          >
            <FaDownload /> <span>XUẤT FILE (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3 Columns KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 perspective-3d">
        {/* KPI: Total Income */}
        <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:-translate-y-1 hover:border-emerald-premium/40 hover:shadow-emerald-premium/5 transition-all duration-300 group tilt-card-3d">
          <div className="absolute w-36 h-36 bg-emerald-premium blur-[35px] -top-12 -right-12 opacity-[0.12] rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-20"></div>
          <div className="preserve-3d-child">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
              TỔNG THU NHẬP
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-2 font-heading tracking-tight font-mono">
              {formatVND(currentKPI.income)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">Tổng tiền thu được trong kỳ</p>
          </div>
        </div>
        
        {/* KPI: Total Expense */}
        <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:-translate-y-1 hover:border-rose-premium/40 hover:shadow-rose-premium/5 transition-all duration-300 group tilt-card-3d">
          <div className="absolute w-36 h-36 bg-rose-premium blur-[35px] -top-12 -right-12 opacity-[0.12] rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-20"></div>
          <div className="preserve-3d-child">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
              TỔNG CHI TIÊU
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-2 font-heading tracking-tight font-mono">
              {formatVND(currentKPI.expense)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">Các khoản đã thanh toán và chi phí</p>
          </div>
        </div>
        
        {/* KPI: Net Savings */}
        <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl hover:-translate-y-1 hover:border-cyan-premium/40 hover:shadow-cyan-premium/5 transition-all duration-300 group tilt-card-3d">
          <div className="absolute w-36 h-36 bg-cyan-premium blur-[35px] -top-12 -right-12 opacity-[0.12] rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-20"></div>
          <div className="preserve-3d-child">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
              TIẾT KIỆM TÍCH LŨY
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-2 font-heading tracking-tight font-mono">
              {formatVND(currentKPI.balance)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">Số dư ròng thực tế tích lũy</p>
          </div>
        </div>
      </div>

      {/* Charts Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 perspective-3d">
        {/* Chart View */}
        <div className="bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl flex flex-col h-[380px] hover:border-white/[0.1] transition-colors tilt-card-3d">
          <div className="preserve-3d-child flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-white tracking-wide font-heading">
                {viewMode === 'monthly' ? 'CƠ CẤU THEO DANH MỤC' : 'PHÂN TÍCH HÀNG TUẦN'}
              </h3>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 font-semibold">
                <FaCalendarAlt /> Biểu đồ so sánh
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <Bar data={viewMode === 'monthly' ? monthlyChartData : weeklyChartData} options={chartOptions} />
            </div>
          </div>
        </div>
        
        {/* Analysis Summary */}
        <div className="bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-white/[0.1] transition-colors tilt-card-3d">
          <div className="preserve-3d-child flex flex-col justify-between h-full">
            <div>
              <h3 className="text-base font-bold text-white tracking-wide mb-6 font-heading">
                TÓM TẮT CHỈ SỐ
              </h3>
              
              {viewMode === 'monthly' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-white/[0.01] border border-dark-border rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase font-heading">Tổng số giao dịch</span>
                    <span className="text-white font-bold font-mono text-sm">{reportData?.transaction_count || 0}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-white/[0.01] border border-dark-border rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase font-heading">Chi tiêu trung bình</span>
                    <span className="text-white font-bold font-mono text-sm">
                      {formatVND((reportData?.total_expense || 0) / (reportData?.transaction_count || 1))}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-white/[0.01] border border-dark-border rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase font-heading">Khoảng thời gian</span>
                    <span className="text-white font-bold font-mono text-sm">Tháng {selectedMonth}/{selectedYear}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-white/[0.01] border border-dark-border rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase font-heading">Số tuần hoạt động</span>
                    <span className="text-white font-bold font-mono text-sm">{weeklyData?.weekly_data?.length || 0} Tuần</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-white/[0.01] border border-dark-border rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase font-heading">Chi tiêu trung bình tuần</span>
                    <span className="text-white font-bold font-mono text-sm">
                      {formatVND((weeklyData?.total_expense || 0) / (weeklyData?.weekly_data?.length || 1))}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-white/[0.01] border border-dark-border rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase font-heading">Phạm vi hàng tuần</span>
                    <span className="text-white font-bold font-mono text-sm">Tháng {selectedMonth}/{selectedYear}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center p-3 text-[10px] text-gray-600 tracking-wider uppercase mt-6 border-t border-dark-border/40">
              Chỉ số quản lý tài chính thông minh
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Details & Weeks Accordion */}
      {viewMode === 'monthly' ? (
        <div className="bg-dark-glass border border-dark-border rounded-2xl overflow-hidden shadow-2xl relative tilt-card-3d">
          <div className="absolute w-36 h-36 bg-purple-premium blur-[45px] -top-12 -right-12 opacity-[0.05] rounded-full pointer-events-none"></div>
          <div className="preserve-3d-child">
            <div className="p-6 border-b border-dark-border/40">
              <h3 className="text-base font-bold text-white tracking-wide font-heading">
                CHI TIẾT GIAO DỊCH TRONG BÁO CÁO
              </h3>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-dark-border text-gray-500">
                  <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ngày</th>
                  <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Danh mục</th>
                  <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ghi chú</th>
                  <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {(!reportData?.transactions || reportData.transactions.length === 0) ? (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-gray-500 text-xs uppercase tracking-widest font-medium">
                      Không có giao dịch nào trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  reportData.transactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-white/[0.01] transition-colors duration-150">
                      <td className="py-4 px-6 text-gray-400 font-mono text-xs">{transaction.date}</td>
                      <td className="py-4 px-6">
                        <span className="flex items-center gap-2.5">
                          <span className="text-xl leading-none drop-shadow">{transaction.category_icon}</span>
                          <span className="text-white font-medium text-xs">{transaction.category_name}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-400 max-w-[240px] truncate text-xs">{transaction.note || '-'}</td>
                      <td className={`py-4 px-6 text-right font-bold tracking-tight text-xs ${
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
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <FaList className="text-cyan-premium text-xs" />
            <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase font-heading">
              Báo cáo giao dịch theo tuần
            </h3>
          </div>
          
          {(!weeklyData || !weeklyData.weekly_data || weeklyData.weekly_data.length === 0) ? (
            <div className="text-center py-12 bg-dark-glass border border-dark-border rounded-2xl text-gray-500 text-xs uppercase tracking-widest font-medium">
              Không có dữ liệu tuần nào.
            </div>
          ) : (
            weeklyData.weekly_data.map((week, idx) => {
              const isExpanded = expandedWeek === idx;
              return (
                <div key={week.label} className="bg-dark-glass border border-dark-border rounded-2xl overflow-hidden transition-all duration-300 tilt-card-3d">
                  <div className="preserve-3d-child">
                  {/* Header / Trigger */}
                  <div
                    onClick={() => setExpandedWeek(isExpanded ? null : idx)}
                    className="p-5 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] select-none transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-lg bg-cyan-premium/10 border border-cyan-premium/20 flex items-center justify-center text-xs font-bold text-cyan-premium font-mono">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-extrabold text-white tracking-wide uppercase font-heading">
                          {week.label.replace('Week', 'Tuần')} <span className="text-[11px] text-gray-500 font-normal lowercase font-body">({week.start_str} - {week.end_str})</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">Đã ghi nhận {week.transactions.length} giao dịch</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="hidden sm:flex gap-6 text-xs text-right">
                        <div>
                          <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">THU NHẬP</span>
                          <span className="font-semibold text-emerald-premium font-mono">{formatVND(week.income)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">CHI TIÊU</span>
                          <span className="font-semibold text-rose-premium font-mono">{formatVND(week.expense)}</span>
                        </div>
                      </div>
                      
                      <div className="text-gray-400 text-xs">
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                    </div>
                  </div>
                  
                  {/* Body / Table */}
                  {isExpanded && (
                    <div className="border-t border-dark-border/40 overflow-x-auto bg-white/[0.005]">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-dark-border/40 text-gray-500">
                            <th className="py-3 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ngày</th>
                            <th className="py-3 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Danh mục</th>
                            <th className="py-3 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ghi chú</th>
                            <th className="py-3 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading text-right">Số tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/30">
                          {week.transactions.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center py-8 text-gray-500 text-xs uppercase tracking-widest">
                                Không có giao dịch nào trong tuần này.
                              </td>
                            </tr>
                          ) : (
                            week.transactions.map(t => (
                              <tr key={t.id} className="hover:bg-white/[0.01] transition-colors duration-150">
                                <td className="py-3 px-6 text-gray-400 font-mono text-xs">{t.date}</td>
                                <td className="py-3 px-6">
                                  <span className="flex items-center gap-2">
                                    <span className="text-lg leading-none">{t.category_icon}</span>
                                    <span className="text-white text-xs">{t.category_name}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-6 text-gray-400 max-w-[200px] truncate text-xs">{t.note || '-'}</td>
                                <td className={`py-3 px-6 text-right font-bold font-mono text-xs ${
                                  t.type === 'income' ? 'text-emerald-premium' : 'text-rose-premium'
                                }`}>
                                  {t.type === 'income' ? '+' : '-'}{formatVND(Math.abs(t.amount))}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;