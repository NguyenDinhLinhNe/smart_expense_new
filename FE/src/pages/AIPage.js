import React, { useState, useEffect, useRef } from 'react';
import { getAIPredictions, getAIRecommendations, askAIChat, getDashboardData, createTransaction, getCategories, createBudget, getBudgets } from '../services/api';
import { 
  FaBrain, 
  FaChartLine, 
  FaLightbulb, 
  FaExclamationTriangle, 
  FaPaperPlane, 
  FaRobot, 
  FaUser, 
  FaCommentDots,
  FaChevronRight,
  FaDatabase,
  FaPiggyBank,
  FaMoneyBillWave,
  FaRegCompass,
  FaMicrophone,
  FaMicrophoneSlash
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatVND } from '../services/utils';

const AIPage = () => {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2024-12');
  const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'chat'
  
  // Chat state
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Xin chào! Tôi là **Trợ lý Tài chính AI** của bạn. 🧠🤖\n\nTôi ở đây để tư vấn và phân tích số liệu tài chính trực tiếp từ tài khoản của bạn. Bạn có thể hỏi tôi bất kỳ câu hỏi nào hoặc sử dụng các gợi ý nhanh bên trái để trải nghiệm thử nhé!",
      timestamp: new Date()
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const inputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Auto focus input when chat tab is active or sending state completes
  useEffect(() => {
    if (!sending && activeTab === 'chat' && inputRef.current) {
      const timer = setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sending, activeTab]);

  useEffect(() => {
    fetchAIData();
    fetchBudgetSummary();
  }, [selectedMonth]);

  const fetchBudgetSummary = async () => {
    try {
      setBudgetLoading(true);
      const today = new Date();
      const res = await getBudgets(today.getMonth() + 1, today.getFullYear());
      const data = res.data;
      // Calculate totals
      const categories = data.budgets || [];
      const totalBudget = categories.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      const totalSpent = categories.reduce((sum, b) => sum + parseFloat(b.spent || 0), 0);
      setBudgetSummary({ categories, totalBudget, totalSpent });
    } catch (e) {
      // silently fail
    } finally {
      setBudgetLoading(false);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

  const fetchAIData = async () => {
    try {
      setLoading(true);
      const [predRes, recRes, dashRes] = await Promise.all([
        getAIPredictions(selectedMonth),
        getAIRecommendations(),
        getDashboardData()
      ]);
      setPredictions(predRes.data);
      setRecommendations(recRes.data.recommendations);
      setDashboardData(dashRes.data);
    } catch (error) {
      toast.error("Failed to fetch AI insights");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputVal.trim();
    if (!text) return;

    if (!textToSend) {
      setInputVal('');
    }

    // Add user message
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const response = await askAIChat(text);
      const rawText = response.data.response;
      
      let parsedAction = null;
      let actionType = null;
      let cleanedText = rawText;
      
      const rxTx = /\[TRANSACTION_ACTION\]([\s\S]*?)\[\/TRANSACTION_ACTION\]/;
      const rxBg = /\[BUDGET_ACTION\]([\s\S]*?)\[\/BUDGET_ACTION\]/;
      
      const matchTx = rawText.match(rxTx);
      const matchBg = rawText.match(rxBg);
      
      if (matchTx) {
        try {
          parsedAction = JSON.parse(matchTx[1].trim());
          cleanedText = rawText.replace(rxTx, '').trim();
          actionType = 'transaction';
        } catch (e) {
          console.error("Failed to parse transaction JSON:", e);
        }
      } else if (matchBg) {
        try {
          parsedAction = JSON.parse(matchBg[1].trim());
          cleanedText = rawText.replace(rxBg, '').trim();
          actionType = 'budget';
        } catch (e) {
          console.error("Failed to parse budget JSON:", e);
        }
      }

      let actionExecuted = false;
      if (parsedAction) {
        try {
          const categoriesRes = await getCategories();
          const cats = categoriesRes.data.categories;
          const foundCat = cats.find(c => c.name.toLowerCase() === parsedAction.category_name.toLowerCase());
          const catId = foundCat ? foundCat.id : (cats.length > 0 ? cats[0].id : 1);
          
          if (actionType === 'transaction') {
            const payload = {
              amount: parsedAction.amount,
              type: parsedAction.type || 'expense',
              category_id: catId,
              note: parsedAction.note || '',
              date: new Date().toISOString().split('T')[0]
            };
            await createTransaction(payload);
            toast.success(`Đã tự động ghi nhận chi tiêu: ${formatVND(parsedAction.amount)}!`);
            actionExecuted = true;
          } else if (actionType === 'budget') {
            const today = new Date();
            const payload = {
              category_id: catId,
              amount: parsedAction.amount,
              month: today.getMonth() + 1,
              year: today.getFullYear(),
              week: 1
            };
            await createBudget(payload);
            toast.success(`Đã tự động thiết lập ngân sách: ${formatVND(parsedAction.amount)}!`);
            actionExecuted = true;
          }
        } catch (e) {
          console.error("Auto log failed:", e);
        }
      }

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: cleanedText,
        action: parsedAction,
        actionType: actionType,
        actionExecuted: actionExecuted,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: "Tôi đang gặp khó khăn khi kết nối với máy chủ phân tích tài chính. Vui lòng kiểm tra lại dịch vụ hệ thống của bạn nhé! 🤖💼",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
      fetchBudgetSummary();
    }
  };

  const handleConfirmActionTransaction = async (msg) => {
    try {
      const categoriesRes = await getCategories();
      const cats = categoriesRes.data.categories;
      const foundCat = cats.find(c => c.name.toLowerCase() === msg.action.category_name.toLowerCase());
      
      const payload = {
        amount: msg.action.amount,
        type: msg.action.type,
        category_id: foundCat ? foundCat.id : (cats.length > 0 ? cats[0].id : 1),
        note: msg.action.note || '',
        date: new Date().toISOString().split('T')[0]
      };
      
      await createTransaction(payload);
      toast.success("Ghi chép giao dịch thành công!");
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, actionExecuted: true } : m));
    } catch (err) {
      toast.error("Không thể ghi nhận giao dịch");
    }
  };

  const handleConfirmActionBudget = async (msg) => {
    try {
      const categoriesRes = await getCategories();
      const cats = categoriesRes.data.categories;
      const foundCat = cats.find(c => c.name.toLowerCase() === msg.action.category_name.toLowerCase());
      
      const today = new Date();
      const payload = {
        category_id: foundCat ? foundCat.id : (cats.length > 0 ? cats[0].id : 1),
        amount: msg.action.amount,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        week: 1
      };
      
      await createBudget(payload);
      toast.success("Thiết lập ngân sách thành công!");
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, actionExecuted: true } : m));
    } catch (err) {
      toast.error("Không thể thiết lập ngân sách");
    }
  };

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
      toast.success("Đang nghe... Hãy nói ngay!");
    };
    
    recognition.onerror = (event) => {
      setIsRecording(false);
      toast.error("Lỗi giọng nói: " + event.error);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setInputVal(speechToText);
      handleSendMessage(speechToText);
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

  // Simple custom inline style parser for bullet points, bold and inline code
  const parseInlineStyle = (text) => {
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const splitParts = text.split(regex);
    
    return splitParts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="bg-[#090d16] text-[#06b6d4] px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  // Basic Markdown parser for paragraphs, headers and list items
  const renderMarkdown = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, index) => {
      let content = line;
      if (content.startsWith('### ')) {
        return <h4 key={index} className="text-sm font-extrabold text-cyan-premium mt-4 mb-2 border-b border-dark-border pb-1 font-heading uppercase tracking-wide">{content.replace('### ', '')}</h4>;
      }
      if (content.startsWith('## ')) {
        return <h3 key={index} className="text-base font-extrabold text-purple-premium mt-4 mb-2 font-heading uppercase tracking-wide">{content.replace('## ', '')}</h3>;
      }
      if (content.startsWith('* ') || content.startsWith('- ')) {
        const cleanText = content.replace(/^[\*\-]\s+/, '');
        return (
          <li key={index} className="ml-4 list-disc text-gray-300 my-1 text-xs">
            {parseInlineStyle(cleanText)}
          </li>
        );
      }
      if (content.trim() === '') {
        return <div key={index} className="h-2"></div>;
      }
      return <p key={index} className="text-gray-300 my-1 leading-relaxed text-xs">{parseInlineStyle(content)}</p>;
    });
  };

  const suggestions = [
    { label: "📊 Phân tích chi tiêu", query: "Phân tích chi tiêu tháng này" },
    { label: "💰 Nguồn thu nhập", query: "Thu nhập tháng này của tôi" },
    { label: "💡 Tư vấn tiết kiệm", query: "Tư vấn cách tiết kiệm tiền" },
    { label: "🛡️ Trạng thái ngân sách", query: "Kiểm tra hạn mức ngân sách" },
    { label: "🏆 Danh mục lớn nhất", query: "Danh mục chi tiêu cao nhất" },
    { label: "🚨 Giao dịch bất thường", query: "Chi tiêu bất thường" }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 font-body">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-premium"></div>
        <span className="text-xs text-gray-500 tracking-wide uppercase font-semibold">Đang chạy dự báo tài chính...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-body perspective-3d">
      {/* Dynamic Cosmic Header */}
      <div className="bg-dark-glass border border-dark-border p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300 shadow-xl tilt-card-3d">
        <div className="absolute w-36 h-36 bg-cyan-premium blur-[45px] -top-12 -right-12 opacity-[0.08] rounded-full pointer-events-none"></div>
        <div className="absolute w-36 h-36 bg-purple-premium blur-[45px] -bottom-12 -left-12 opacity-[0.05] rounded-full pointer-events-none"></div>

        <div className="flex items-center gap-4.5 relative z-10 preserve-3d-child">
          <div className="w-[50px] h-[50px] rounded-xl bg-gradient-to-br from-cyan-premium to-purple-premium flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-premium/25 animate-pulse">
            <FaBrain className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-heading">Trí tuệ Tài chính AI</h2>
            <p className="text-xs text-gray-500 mt-0.5">Cố văn thông minh và tự động dự báo dòng tiền theo thời gian thực</p>
          </div>
        </div>
      </div>


        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[680px] lg:h-[680px] relative font-body perspective-3d">
          
          {/* Quick Suggestions Panel */}
          <div className="lg:col-span-1 bg-dark-glass border border-dark-border rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden tilt-card-3d">
            <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -bottom-10 -left-10 opacity-[0.05] rounded-full pointer-events-none"></div>
            <div className="preserve-3d-child flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-dark-border/40 pb-3">
                <FaLightbulb className="text-amber-premium text-sm animate-pulse" />
                <span className="text-white text-xs font-bold uppercase tracking-wider font-heading">
                  Gợi ý Nhanh
                </span>
              </div>
              
              <div className="space-y-2.5">
                {suggestions.map((s, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(s.query)}
                    disabled={sending}
                    className="w-full text-left py-3 px-3.5 bg-white/[0.01] hover:bg-cyan-premium/10 border border-dark-border hover:border-cyan-premium rounded-xl text-gray-400 hover:text-cyan-premium text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 flex items-center justify-between"
                  >
                    <span>{s.label}</span>
                    <FaChevronRight className="text-[9px] opacity-40" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-purple-premium/5 border border-purple-premium/15 rounded-xl text-[10px] text-purple-300 leading-relaxed font-semibold">
              🤖 TRỢ LÝ AI: Trực tiếp phân tích cơ sở dữ liệu tài chính của bạn theo thời gian thực để đưa ra các đề xuất phù hợp.
            </div>

            {/* Real-time Budget Summary */}
            <div className="mt-4 border-t border-dark-border/40 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FaPiggyBank className="text-amber-premium text-xs" />
                  <span className="text-white text-[10px] font-bold uppercase tracking-wider font-heading">Ngân Sách Thực</span>
                </div>
                {budgetLoading && (
                  <div className="h-2 w-2 rounded-full bg-cyan-premium animate-ping" />
                )}
              </div>

              {budgetSummary ? (
                <div className="space-y-2.5">
                  {/* Total bar */}
                  <div className="p-2.5 bg-white/[0.02] rounded-xl border border-dark-border/60">
                    <div className="flex justify-between text-[9px] text-gray-400 mb-1.5 font-mono uppercase tracking-wide">
                      <span>Tổng chi / Hạn mức</span>
                      <span className={budgetSummary.totalSpent > budgetSummary.totalBudget ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {budgetSummary.totalBudget > 0
                          ? `${Math.min(Math.round((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100), 999)}%`
                          : '–'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          budgetSummary.totalBudget > 0 && budgetSummary.totalSpent >= budgetSummary.totalBudget
                            ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                            : 'bg-gradient-to-r from-cyan-premium to-purple-premium'
                        }`}
                        style={{ width: budgetSummary.totalBudget > 0 ? `${Math.min((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100, 100)}%` : '0%' }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-500 mt-1 font-mono">
                      <span>{formatVND(budgetSummary.totalSpent)}</span>
                      <span>{formatVND(budgetSummary.totalBudget)}</span>
                    </div>
                  </div>

                  {/* Per-category mini rows */}
                  {budgetSummary.categories.slice(0, 4).map((b, i) => {
                    const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
                    const over = b.spent > b.amount;
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] font-semibold">
                          <span className="text-gray-400 truncate max-w-[60%]">{b.category_name}</span>
                          <span className={over ? 'text-rose-400' : 'text-gray-500'}>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-400' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {budgetSummary.categories.length === 0 && (
                    <p className="text-[9px] text-gray-600 italic text-center py-1">Chưa có ngân sách nào được thiết lập</p>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-gray-600 italic text-center py-2">Đang tải dữ liệu ngân sách...</p>
              )}
            </div>
          </div>
        </div>

          {/* Main Chat Interface */}
          <div className="lg:col-span-3 bg-dark-glass border border-dark-border rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl relative tilt-card-3d">
            <div className="absolute w-36 h-36 bg-cyan-premium blur-[45px] -top-12 -right-12 opacity-[0.03] rounded-full pointer-events-none"></div>
            <div className="preserve-3d-child flex flex-col h-full overflow-hidden">
              {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/10">
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`p-2.5 rounded-xl shrink-0 border ${
                      msg.sender === 'user' 
                        ? 'bg-cyan-premium/15 border-cyan-premium/25 text-cyan-premium' 
                        : 'bg-purple-premium/15 border-purple-premium/25 text-purple-premium shadow-lg shadow-purple-premium/5'
                    }`}>
                      {msg.sender === 'user' ? <FaUser className="text-xs" /> : <FaRobot className="text-xs" />}
                    </div>

                    {/* Message Bubble */}
                    <div className={`p-4 rounded-2xl text-xs shadow-lg leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-gradient-to-r from-cyan-premium to-purple-premium text-white rounded-tr-none' 
                        : 'bg-[#101622]/90 border border-dark-border text-gray-200 rounded-tl-none'
                    }`}>
                      {msg.sender === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div className="space-y-1">
                          {renderMarkdown(msg.text)}
                          
                          {msg.action && msg.actionType === 'transaction' && (
                            <div className="mt-4 p-4 bg-emerald-premium/10 border border-emerald-premium/20 rounded-2xl animate-fade-in text-xs space-y-3">
                              <p className="font-bold text-emerald-premium flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                <FaMoneyBillWave /> Nhận diện hành động: Thêm Giao dịch
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                                <div><strong>Số tiền:</strong> {formatVND(msg.action.amount)}</div>
                                <div><strong>Loại:</strong> {msg.action.type === 'income' ? 'Thu nhập 🟢' : 'Chi tiêu 🔴'}</div>
                                <div><strong>Danh mục:</strong> {msg.action.category_name}</div>
                                {msg.action.note && <div><strong>Ghi chú:</strong> {msg.action.note}</div>}
                              </div>
                              
                              {msg.actionExecuted ? (
                                <div className="text-[10px] text-emerald-premium font-bold italic">
                                  ✓ Đã ghi nhận giao dịch thành công!
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmActionTransaction(msg)}
                                  className="px-4 py-2 bg-emerald-premium text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] cursor-pointer hover:shadow-emerald-glow"
                                >
                                  Ghi nhận ngay
                                </button>
                              )}
                            </div>
                          )}

                          {msg.action && msg.actionType === 'budget' && (
                            <div className="mt-4 p-4 bg-purple-premium/10 border border-purple-premium/20 rounded-2xl animate-fade-in text-xs space-y-3">
                              <p className="font-bold text-purple-premium flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                <FaPiggyBank /> Nhận diện hành động: Đặt Ngân sách
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                                <div><strong>Hạn mức:</strong> {formatVND(msg.action.amount)}</div>
                                <div><strong>Danh mục:</strong> {msg.action.category_name}</div>
                              </div>
                              
                              {msg.actionExecuted ? (
                                <div className="text-[10px] text-purple-premium font-bold italic">
                                  ✓ Đã thiết lập ngân sách thành công!
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmActionBudget(msg)}
                                  className="px-4 py-2 bg-purple-premium text-white font-bold rounded-xl active:scale-95 transition-all text-[11px] cursor-pointer hover:shadow-purple-glow"
                                >
                                  Thiết lập ngay
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <span className="block text-[9px] text-gray-500 mt-2.5 text-right font-mono font-bold tracking-wider uppercase">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 max-w-[85%]">
                    <div className="p-2.5 rounded-xl bg-purple-premium/15 border border-purple-premium/25 text-purple-premium shrink-0 animate-pulse">
                      <FaRobot className="text-xs" />
                    </div>
                    <div className="flex gap-1.5 items-center bg-[#101622]/70 border border-dark-border rounded-2xl px-4 py-3 shadow-inner">
                      <div className="h-1.5 w-1.5 bg-cyan-premium rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="h-1.5 w-1.5 bg-cyan-premium rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-1.5 w-1.5 bg-cyan-premium rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-4 bg-[#0f172a]/60 border-t border-dark-border/40 flex items-center gap-3 w-full"
            >
              {/* Text Input area - Translucent Dark Background with White Text! Completely fixed styling and highly visible */}
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Hỏi cố vấn tài chính hoặc dự báo chi tiêu..."
                disabled={sending}
                className="flex-1 bg-[#0f172a]/85 border border-dark-border rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-premium focus:shadow-cyan-glow text-xs font-semibold transition-all duration-300"
              />
              
              <button
                type="button"
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={sending}
                className={`p-3.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer ${
                  isRecording 
                    ? 'bg-rose-500 text-white animate-pulse' 
                    : 'bg-white/[0.04] border border-dark-border text-gray-400 hover:text-white hover:bg-white/[0.08]'
                }`}
                title="Khẩu lệnh giọng nói (vi-VN)"
              >
                {isRecording ? <FaMicrophoneSlash className="text-xs" /> : <FaMicrophone className="text-xs" />}
              </button>
              
              <button
                type="submit"
                disabled={sending || !inputVal.trim()}
                className="p-3.5 bg-gradient-to-r from-cyan-premium to-purple-premium text-white rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-premium/30 active:translate-y-0 neo-button-3d-purple cursor-pointer"
              >
                <FaPaperPlane className="text-xs" />
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPage;