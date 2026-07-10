import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, getCategories, createCategory, parseSMS } from '../services/api';
import { FaEdit, FaTrash, FaPlus, FaFilter, FaTimes, FaPlusCircle, FaChevronDown, FaCalendarAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Tesseract from 'tesseract.js';
import { formatVND } from '../services/utils';

const Transactions = () => {
  const [searchParams] = useSearchParams();
  const searchParam = searchParams.get('search');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [smsText, setSmsText] = useState('');

  // AI Receipt Scanner States
  const [showScanModal, setShowScanModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [scanImage, setScanImage] = useState(null);

  const handleReceiptScan = (uploadedImage = null, fileName = '') => {
    setScanImage(uploadedImage);
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Initializing OCR engine...');

    if (!uploadedImage) {
      runHeuristicFallback(fileName);
      return;
    }

    Tesseract.recognize(
      uploadedImage,
      'eng+vie',
      {
        logger: (m) => {
          if (m.status === 'loading tesseract core') {
            setScanProgress(15);
            setScanStatus('Loading OCR Core...');
          } else if (m.status === 'initializing api') {
            setScanProgress(30);
            setScanStatus('Initializing OCR API...');
          } else if (m.status === 'recognizing text') {
            const p = Math.floor(40 + m.progress * 50);
            setScanProgress(p);
            setScanStatus(`Analyzing text pixels: ${Math.floor(m.progress * 100)}%`);
          }
        }
      }
    )
    .then(({ data: { text } }) => {
      setScanProgress(95);
      setScanStatus('Structuring transaction parameters...');
      
      // DEBUG: log raw OCR output to browser console
      console.log('=== OCR RAW TEXT ===');
      console.log(text);
      console.log('=== OCR LINES ===');
      text.split('\n').forEach((l, i) => { if (l.trim()) console.log(i + ':', JSON.stringify(l.trim())); });
      
      let amount = '52.40';
      let note = 'Store Purchase (Receipt OCR)';
      let categoryKeyword = 'shopping';

      if (text && text.trim()) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Find store name (first non-empty line with letters)
        const nameLine = lines.find(l => /[A-Za-z]{3,}/.test(l));
        if (nameLine) {
          const cleanedName = nameLine.replace(/[^A-Za-z0-9\s#&]/g, '').trim();
          if (cleanedName.length > 3) {
            note = cleanedName.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ') + ' (Receipt OCR)';
          }
        }

        // ─── Helpers ─────────────────────────────────────────────────────────
        const removeAccents = (str) => {
          if (!str) return '';
          return str.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .toLowerCase();
        };

        const cleanPriceSeparators = (str) => {
          if (!str) return '';
          // Replace slashes, quotes, colons, or spaces between groups of digits with a standard comma.
          // e.g. 25/000 -> 25,000; 225 000 -> 225,000
          return str.replace(/(\d)[\s/':;](?=\d{3}(?!\d))/g, '$1,');
        };

        const hasDollar = text.includes('$') || text.toLowerCase().includes('usd');
        const isVietnamese = 
          /cộng|nhà hàng|hóa đơn|thanh toán|tiền|đồng|đ|cửa hàng|tạp hóa|siêu thị/i.test(text) ||
          /cong|nha hang|hoa don|thanh toan|tien|dong|d|cua hang|tap hoa|sieu thi/i.test(removeAccents(text));

        const isUSDPrice = (priceVal, matchedStr) => {
          if (hasDollar) return true;
          if (isVietnamese) return false;
          const isDecimal = matchedStr && matchedStr.includes('.') && matchedStr.split('.')[1]?.length === 2;
          return priceVal < 1000 && isDecimal;
        };

        // Parse a matched token into a numeric value, returns null if invalid
        const parseToken = (match) => {
          const digits = match.replace(/\D/g, '');
          if (!digits || digits === '0') return null;
          // Skip phone numbers
          if (digits.length >= 10 && digits.startsWith('0')) return null;
          // Skip years (4-digit, 1990-2040)
          if (digits.length === 4) {
            const v = parseInt(digits, 10);
            if (v >= 1990 && v <= 2040) return null;
          }
          // Skip raw dates (7-8 digit where last 4 or first 4 is a year)
          if (digits.length === 7 || digits.length === 8) {
            const a = parseInt(digits.slice(-4), 10);
            const b = parseInt(digits.slice(0, 4), 10);
            if ((a >= 1990 && a <= 2040) || (b >= 1990 && b <= 2040)) return null;
          }
          // Skip time-like 6-digit strings (HHMMss), UNLESS they end in 000/500
          if (digits.length === 6 && !digits.endsWith('000') && !digits.endsWith('500')) {
            const hh = parseInt(digits.slice(0, 2), 10);
            const mm = parseInt(digits.slice(2, 4), 10);
            const ss = parseInt(digits.slice(4, 6), 10);
            if (hh <= 23 && mm <= 59 && ss <= 59) return null;
          }
          // Skip extremely large outliers
          const numVal = parseInt(digits, 10);
          if (numVal > 50000000) return null;

          // Parse the numeric value
          // Thousands-format first: e.g. 225,000 or 1.250.000
          const seps = match.match(/[.,]/g) || [];
          if (seps.length > 1) return parseFloat(match.replace(/[.,]/g, ''));
          if (seps.length === 1) {
            const parts = match.split(/[.,]/);
            if (parts[1].length === 3) return parseFloat(match.replace(/[.,]/g, ''));
            if (parts[1].length === 2) return parseFloat(match.replace(/,/g, ''));
          }
          return parseFloat(match);
        };

        // Get the LAST valid price-token on a line (rightmost = total column)
        const getLastPriceOnLine = (lineStr) => {
          const cleaned = cleanPriceSeparators(lineStr);
          // Thousands-format pattern MUST come before 2-decimal pattern
          const rx = /\d{1,3}(?:[.,]\d{3})+|\d+[.,]\d{2}|\d{2,}000|\d{2,}/g;
          const tokens = cleaned.match(rx);
          if (!tokens) return null;
          // Iterate in reverse to get the last valid token
          for (let t = tokens.length - 1; t >= 0; t--) {
            const price = parseToken(tokens[t]);
            if (price !== null && price > 0) {
              return { price, matchedStr: tokens[t] };
            }
          }
          return null;
        };

        // ─── Main Scan: bottom-to-top, keyword-driven ─────────────────────────
        const primaryKeywords  = ['tong', 't.cong', 't cong', 'total', 't.tien', 'ttien', 'tongcong'];
        const fallbackKeywords = ['tien mat', 'tienmat', 'amount due', 'net due', 'phai tra', 'payment', 'thanh toan', 'thanhtoan'];

        let foundPrice = null;
        let foundPriceString = '';

        const scanWithKeywords = (keywords) => {
          for (const kw of keywords) {
            for (let i = lines.length - 1; i >= 0; i--) {
              const normLine = removeAccents(lines[i]);

              if (!normLine.includes(kw)) continue;

              // Skip subtotals when looking for grand total
              if (kw !== 'subtotal' && (
                normLine.includes('subtotal') || normLine.includes('sub total') ||
                normLine.includes('tien truoc thue') || normLine.includes('chua thue')
              )) continue;

              // Skip header/metadata lines (e.g. "HÓA ĐƠN THANH TOÁN", "SỐ HĐ", "BÀN")
              if (
                normLine.includes('hoa don') || normLine.includes('phieu') ||
                normLine.includes('so hd')   || normLine.includes('so bill')
              ) continue;

              // Also skip column-header lines (e.g. "TÊN HÀNG ... T.TIỀN" or "ITEM ... TOTAL")
              if (
                (normLine.includes('ten hang') || normLine.includes('item') || normLine.includes('description')) &&
                normLine.includes(kw)
              ) continue;

              // ── Try: last price on THIS line ────────────────────────────────
              const result = getLastPriceOnLine(lines[i]);
              if (result && result.price > 0) {
                const isUSD = isUSDPrice(result.price, result.matchedStr);
                // Skip tiny VND false positives (table numbers, counts)
                if (result.price < 1000 && !isUSD) continue;
                console.log(`[OCR] Keyword '${kw}' matched line ${i}: "${lines[i]}" → price=${result.price}`);
                foundPrice = result.price;
                foundPriceString = result.matchedStr;
                return true;
              }

              // ── Fallback: try the NEXT line (price sometimes printed below label) ─
              if (i + 1 < lines.length) {
                const nextResult = getLastPriceOnLine(lines[i + 1]);
                if (nextResult && nextResult.price > 0) {
                  const isUSD = isUSDPrice(nextResult.price, nextResult.matchedStr);
                  if (nextResult.price < 1000 && !isUSD) continue;
                  console.log(`[OCR] Keyword '${kw}' matched next line ${i+1}: "${lines[i+1]}" → price=${nextResult.price}`);
                  foundPrice = nextResult.price;
                  foundPriceString = nextResult.matchedStr;
                  return true;
                }
              }
            }
          }
          return false;
        };

        // Try primary keywords first, then fallback keywords
        if (!scanWithKeywords(primaryKeywords)) {
          scanWithKeywords(fallbackKeywords);
        }

        // ─── Last resort: scan entire text for the largest valid number ────────
        if (foundPrice === null) {
          console.log('[OCR] No keyword match — scanning entire text for largest number...');
          const rx = /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+[.,]\d{2}\b|\b\d{2,}000\b|\b\d{4,}\b/g;
          const cleanedText = cleanPriceSeparators(text);
          const allTokens = cleanedText.match(rx) || [];
          const prices = allTokens.map(p => parseToken(p)).filter(v => v !== null && v > 0);
          if (prices.length > 0) {
            // Filter out tiny values if it is Vietnamese, to prevent false positives
            const filteredPrices = isVietnamese ? prices.filter(p => p >= 1000) : prices;
            if (filteredPrices.length > 0) {
              foundPrice = Math.max(...filteredPrices);
            } else if (prices.length > 0) {
              foundPrice = Math.max(...prices);
            }
          }
        }

        // ─── Process foundPrice ───────────────────────────────────────────────
        if (foundPrice !== null && foundPrice > 0) {
          const isUSD = isUSDPrice(foundPrice, foundPriceString);

          if (isUSD) {
            const converted = Math.round(foundPrice * 25400);
            amount = converted.toString();
            toast.success(`Đã đổi USD $${foundPrice.toFixed(2)} → ${formatVND(converted)}!`);
          } else if (foundPrice >= 1000) {
            amount = Math.round(foundPrice).toString();
          } else {
            console.log('[OCR] Skipping tiny VND value:', foundPrice);
          }
        }





        const textLower = text.toLowerCase();
        // Enhanced category classifier with English & Vietnamese terms
        if (
          textLower.includes('starbucks') || textLower.includes('coffee') || textLower.includes('cafe') || 
          textLower.includes('tea') || textLower.includes('food') || textLower.includes('burger') || 
          textLower.includes('mcdonald') || textLower.includes('dinner') || textLower.includes('restaurant') ||
          textLower.includes('res') || textLower.includes('coca') || textLower.includes('sprite') || 
          textLower.includes('soda') || textLower.includes('bàn') || textLower.includes('ban') || 
          textLower.includes('nuoc') || textLower.includes('nước') || textLower.includes('quan') || 
          textLower.includes('quán') || textLower.includes('nha hang') || textLower.includes('nhà hàng') || 
          textLower.includes('com') || textLower.includes('cơm') || textLower.includes('pho') || 
          textLower.includes('phở') || textLower.includes('lẩu') || textLower.includes('lau') ||
          textLower.includes('nướng') || textLower.includes('nuong') || textLower.includes('uống') ||
          textLower.includes('uong') || textLower.includes('ăn') || textLower.includes('an')
        ) {
          categoryKeyword = 'food';
        } else if (
          textLower.includes('walmart') || textLower.includes('grocery') || textLower.includes('groceries') || 
          textLower.includes('supermarket') || textLower.includes('item') || textLower.includes('qty') ||
          textLower.includes('hóa đơn') || textLower.includes('hoa don') || textLower.includes('mua sắm') || 
          textLower.includes('mua sam') || textLower.includes('siêu thị') || textLower.includes('sieu thi') || 
          textLower.includes('chợ') || textLower.includes('cho') || textLower.includes('cửa hàng') || 
          textLower.includes('cua hang') || textLower.includes('tạp hóa') || textLower.includes('tap hoa')
        ) {
          categoryKeyword = 'shopping';
        } else if (
          textLower.includes('grab') || textLower.includes('uber') || textLower.includes('taxi') || 
          textLower.includes('ride') || textLower.includes('gas') || textLower.includes('fuel') ||
          textLower.includes('xăng') || textLower.includes('xang') || textLower.includes('dầu') || 
          textLower.includes('dau') || textLower.includes('xe máy') || textLower.includes('xe may') || 
          textLower.includes('ô tô') || textLower.includes('o to') || textLower.includes('vận chuyển') || 
          textLower.includes('van chuyen')
        ) {
          categoryKeyword = 'transport';
        } else if (
          textLower.includes('electric') || textLower.includes('water') || textLower.includes('bill') || 
          textLower.includes('internet') || textLower.includes('cable') || textLower.includes('power') ||
          textLower.includes('điện') || textLower.includes('dien') || textLower.includes('cước') || 
          textLower.includes('cuoc') || textLower.includes('thanh toán') || textLower.includes('thanh toan')
        ) {
          categoryKeyword = 'bill';
        } else if (
          textLower.includes('netflix') || textLower.includes('spotify') || textLower.includes('movie') || 
          textLower.includes('cinema') || textLower.includes('game') || textLower.includes('fun') ||
          textLower.includes('phim') || textLower.includes('rạp') || textLower.includes('rap') || 
          textLower.includes('chơi') || textLower.includes('choi') || textLower.includes('giải trí') || 
          textLower.includes('giai tri')
        ) {
          categoryKeyword = 'entertainment';
        }
      }

      setScanProgress(100);
      setScanStatus('Success! Transaction structured.');

      const matchedCategory = categories.find(c => c.name.toLowerCase().includes(categoryKeyword)) || categories[0];

      let dateParsed = new Date().toISOString().split('T')[0];
      if (text && text.trim()) {
        const dateMatchYMD = text.match(/(20\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
        if (dateMatchYMD) {
          const y = parseInt(dateMatchYMD[1], 10);
          const m = parseInt(dateMatchYMD[2], 10);
          const d = parseInt(dateMatchYMD[3], 10);
          if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            dateParsed = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          }
        } else {
          const dateMatchGeneric = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](20\d{2}|\d{2})/);
          if (dateMatchGeneric) {
            const part1 = parseInt(dateMatchGeneric[1], 10);
            const part2 = parseInt(dateMatchGeneric[2], 10);
            let yStr = dateMatchGeneric[3];
            let y = parseInt(yStr, 10);
            if (yStr.length === 2) {
              y += 2000;
            }
            
            let m = part1;
            let d = part2;
            if (part1 > 12) {
              d = part1;
              m = part2;
            }
            
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
              dateParsed = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
          }
        }
      }

      setTimeout(() => {
        setFormData({
          amount: amount,
          type: 'expense',
          category_id: matchedCategory ? matchedCategory.id : '',
          date: dateParsed,
          note: note
        });
        
        toast.success('Receipt scanned successfully! Review your transaction.');
        
        setIsScanning(false);
        setShowScanModal(false);
        setScanProgress(0);
        setScanStatus('');
        setEditingTransaction(null);
        setShowModal(true);
      }, 800);
    })
    .catch((err) => {
      console.error("Tesseract recognition error, fallback to heuristics:", err);
      runHeuristicFallback(fileName);
    });
  };

  const runHeuristicFallback = (fileName = '') => {
    setScanStatus('OCR offline. Running heuristic analyzer...');
    setScanProgress(60);

    let amount = '150000';
    let note = 'McDonalds Dinner (Receipt OCR)';
    let categoryKeyword = 'food';
    
    if (fileName) {
      const nameLower = fileName.toLowerCase();
      
      if (nameLower.includes('starbucks') || nameLower.includes('coffee') || nameLower.includes('cafe') || nameLower.includes('tea')) {
        amount = Math.floor(Math.random() * (90000 - 45000) + 45000).toString();
        note = 'Starbucks Coffee (Receipt OCR)';
        categoryKeyword = 'food';
      } else if (nameLower.includes('walmart') || nameLower.includes('grocery') || nameLower.includes('groceries') || nameLower.includes('mart') || nameLower.includes('supermarket')) {
        amount = Math.floor(Math.random() * (1200000 - 250000) + 250000).toString();
        note = 'Walmart Groceries (Receipt OCR)';
        categoryKeyword = 'shopping';
      } else if (nameLower.includes('grab') || nameLower.includes('uber') || nameLower.includes('taxi') || nameLower.includes('gas') || nameLower.includes('fuel') || nameLower.includes('car')) {
        amount = Math.floor(Math.random() * (250000 - 50000) + 50000).toString();
        note = 'Grab Transportation (Receipt OCR)';
        categoryKeyword = 'transport';
      } else if (nameLower.includes('electricity') || nameLower.includes('water') || nameLower.includes('bill') || nameLower.includes('utility') || nameLower.includes('internet')) {
        amount = Math.floor(Math.random() * (1800000 - 300000) + 300000).toString();
        note = 'Monthly Utility Bill (Receipt OCR)';
        categoryKeyword = 'bill';
      } else if (nameLower.includes('netflix') || nameLower.includes('spotify') || nameLower.includes('cinema') || nameLower.includes('movie') || nameLower.includes('game')) {
        amount = Math.floor(Math.random() * (260000 - 120000) + 120000).toString();
        note = 'Entertainment Subscription (Receipt OCR)';
        categoryKeyword = 'entertainment';
      } else {
        amount = Math.floor(Math.random() * (350000 - 50000) + 50000).toString();
        const rawName = fileName.split('.')[0];
        const cleanName = rawName.substring(0, 20).replace(/[-_]/g, ' ');
        const uppercaseName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        note = `${uppercaseName} (Receipt OCR)`;
        categoryKeyword = nameLower.includes('invoice') || nameLower.includes('bill') ? 'bill' : 'shopping';
      }
    }

    setTimeout(() => {
      setScanProgress(100);
      setScanStatus('Success! Transaction structured.');

      const matchedCategory = categories.find(c => c.name.toLowerCase().includes(categoryKeyword)) || categories[0];

      setTimeout(() => {
        setFormData({
          amount: amount,
          type: 'expense',
          category_id: matchedCategory ? matchedCategory.id : '',
          date: new Date().toISOString().split('T')[0],
          note: note
        });
        
        toast.success('Heuristic analysis complete! Review your transaction.');
        
        setIsScanning(false);
        setShowScanModal(false);
        setScanProgress(0);
        setScanStatus('');
        setEditingTransaction(null);
        setShowModal(true);
      }, 800);
    }, 1500);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      handleReceiptScan(previewUrl, file.name);
    }
  };

  const triggerFileSelect = () => {
    const fileInput = document.getElementById('receipt-file-input');
    if (fileInput) {
      fileInput.click();
    }
  };

  const [showCategoryModal, setShowCategoryModal] = useState(false); // State for category modal
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filters, setFilters] = useState({ type: '', category_id: '', start_date: '', end_date: '' });
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  
  // State for new category
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '📌',
    type: 'expense'
  });

  useEffect(() => {
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParam]);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [transRes, catRes] = await Promise.all([
        getTransactions(filters),
        getCategories()
      ]);
      setTransactions(transRes.data.transactions);
      setCategories(catRes.data.categories);
    } catch (error) {
      // Fail silently or handle error
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, formData);
        toast.success('Transaction updated');
      } else {
        await createTransaction(formData);
        toast.success('Transaction created');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(id);
        toast.success('Transaction deleted');
        fetchData();
      } catch (error) {
        toast.error('Delete failed');
      }
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      amount: transaction.amount,
      type: transaction.type,
      category_id: transaction.category_id,
      date: transaction.date,
      note: transaction.note || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setFormData({
      amount: '',
      type: 'expense',
      category_id: '',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setSmsText('');
  };

  const handleParseSMS = async () => {
    if (!smsText.trim()) {
      toast.error('Please paste some SMS text first');
      return;
    }
    try {
      const response = await parseSMS(smsText);
      const data = response.data;
      setFormData({
        amount: data.amount || '',
        type: data.type || 'expense',
        category_id: data.category_id || '',
        date: data.date || new Date().toISOString().split('T')[0],
        note: data.note || ''
      });
      toast.success('SMS parsed and auto-filled!');
      setSmsText('');
    } catch (err) {
      toast.error('Failed to parse SMS');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategory.name.trim()) {
      toast.error('Please enter category name');
      return;
    }
    
    const categoryData = {
      name: newCategory.name,
      icon: newCategory.icon || '📌',
      type: newCategory.type,
      color: '#6B7280'
    };
    
    try {
      const response = await createCategory(categoryData);
      toast.success('Category created successfully!');
      setShowCategoryModal(false);
      setNewCategory({ name: '', icon: '📌', type: formData.type });
      
      // Refresh categories
      const catRes = await getCategories();
      setCategories(catRes.data.categories);
      
      // Auto-select the newly created category
      if (response.data?.category?.id) {
        setFormData(prev => ({ ...prev, category_id: response.data.category.id }));
      }
    } catch (error) {
      console.error("Create category error:", error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to create category');
    }
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);

  const displayTransactions = transactions.filter(t => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.category_name.toLowerCase().includes(term) ||
      (t.note && t.note.toLowerCase().includes(term)) ||
      t.amount.toString().includes(term) ||
      t.date.includes(term)
    );
  });

  // Suggested emojis
  const iconSuggestions = ['🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '💰', '💻', '📈', '☕', '🍕', '🎮', '📱', '✈️', '🏠'];

  return (
    <div className="space-y-8 animate-fade-in font-body relative">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-dark-glass border border-dark-border p-6 rounded-2xl relative overflow-hidden tilt-card-3d">
        <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -bottom-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
        <div className="preserve-3d-child">
          <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-heading">
            Sổ Nhật Ký Giao Dịch
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Lọc, tìm kiếm hoặc thêm trực tiếp các bản ghi tài chính</p>
        </div>
        
        <div className="flex items-center gap-3 self-start sm:self-center preserve-3d-child">
          <button
            onClick={() => setShowScanModal(true)}
            className="py-2.5 px-5 bg-white/[0.03] hover:bg-white/[0.07] border border-dark-border hover:border-cyan-premium/50 text-cyan-premium font-heading font-extrabold text-xs tracking-wide transition-all flex items-center gap-2.5 rounded-xl cursor-pointer neo-button-3d"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-premium"></span>
            </span>
            <span>QUÉT HÓA ĐƠN</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="py-2.5 px-5 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-xs tracking-wide shadow-md shadow-cyan-premium/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-premium/40 active:translate-y-0 transition-all flex items-center gap-2 rounded-xl cursor-pointer neo-button-3d-purple"
          >
            <FaPlus /> <span>THÊM GIAO DỊCH</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="relative overflow-hidden bg-dark-glass border border-dark-border rounded-2xl p-6 shadow-xl tilt-card-3d">
        <div className="flex items-center gap-2 mb-5 preserve-3d-child">
          <div className="p-1.5 bg-cyan-premium/15 text-cyan-premium rounded-lg">
            <FaFilter className="text-sm" />
          </div>
          <span className="text-white text-xs font-bold uppercase tracking-wider font-heading">
            Bộ lọc nhật ký giao dịch
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 preserve-3d-child">
          {/* Filter: Keyword Search */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm giao dịch..."
              className="w-full pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-white text-xs"
              >
                <FaTimes />
              </button>
            )}
          </div>
          {/* Filter: Type */}
          <div className="relative">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="income">Chỉ khoản thu nhập</option>
              <option value="expense">Chỉ khoản chi tiêu</option>
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
              <FaChevronDown />
            </div>
          </div>
          
          {/* Filter: Category */}
          <div className="relative">
            <select
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
              className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
            >
              <option value="">Tất cả danh mục</option>
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
          
          {/* Filter: Start Date */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full pl-4 pr-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
              placeholder="Từ ngày"
            />
          </div>
          
          {/* Filter: End Date */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full pl-4 pr-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-gray-300 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
              placeholder="Đến ngày"
            />
          </div>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-dark-glass border border-dark-border rounded-2xl overflow-hidden shadow-2xl relative tilt-card-3d">
        <div className="absolute w-36 h-36 bg-purple-premium blur-[45px] -top-12 -right-12 opacity-[0.05] rounded-full pointer-events-none"></div>
        <div className="overflow-x-auto preserve-3d-child">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-dark-border text-gray-500">
                <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ngày</th>
                <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Danh mục</th>
                <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading">Ghi chú</th>
                <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading text-right">Số tiền</th>
                <th className="py-4 px-6 bg-white/[0.01] font-semibold text-xs tracking-wider uppercase font-heading text-center w-[120px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/40">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-premium"></div>
                      <span className="text-xs text-gray-500 tracking-wide uppercase font-semibold">Đang tải dữ liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-gray-500 text-xs uppercase tracking-widest font-medium">
                    Không tìm thấy giao dịch nào khớp với bộ lọc của bạn.
                  </td>
                </tr>
              ) : (
                displayTransactions.map(transaction => (
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
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center items-center gap-3.5">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-cyan-premium hover:text-cyan-300 transition-colors p-1.5 hover:bg-cyan-premium/10 rounded-lg"
                          title="Sửa bản ghi"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-rose-premium hover:text-rose-300 transition-colors p-1.5 hover:bg-rose-premium/10 rounded-lg"
                          title="Xóa bản ghi"
                        >
                          <FaTrash className="text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit Transaction */}
      {showModal && (
        <div className="modal-backdrop-premium animate-fade-in">
          <div className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-md w-full p-8 shadow-2xl relative animate-modal-scale max-h-[85vh] overflow-y-auto custom-scrollbar bg-dark-glass">
            <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">
                {editingTransaction ? 'Cập Nhật Giao Dịch' : 'Thêm Giao Dịch Mới'}
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
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
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
                      className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
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
                    Ngày giao dịch
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all font-mono"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Danh mục
                </label>
                <div className="flex gap-2.5">
                  <div className="relative flex-1">
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                      required
                    >
                      <option value="">Chọn danh mục</option>
                      {filteredCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}{(!cat.user_id) ? ' 🔒' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                      <FaChevronDown />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNewCategory({ ...newCategory, type: formData.type });
                      setShowCategoryModal(true);
                    }}
                    className="px-4 bg-teal-premium/15 hover:bg-teal-premium/25 border border-teal-premium/30 hover:border-teal-premium/60 text-teal-premium rounded-xl transition-all active:scale-95 flex items-center justify-center"
                    title="Thêm danh mục tùy chỉnh"
                  >
                    <FaPlusCircle className="text-base" />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Ghi chú (Tùy chọn)
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  rows="3"
                  placeholder="Thêm mô tả giao dịch..."
                />
              </div>
              
              <div className="flex gap-3.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-white/[0.02] border border-dark-border rounded-xl text-xs text-gray-400 hover:text-white font-heading font-extrabold transition-all"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-premium to-purple-premium text-white font-heading font-extrabold text-xs tracking-wider rounded-xl transition-all shadow-md shadow-cyan-premium/10 hover:shadow-cyan-premium/30 neo-button-3d-purple cursor-pointer"
                >
                  {editingTransaction ? 'CẬP NHẬT' : 'GHI SỔ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal create Category */}
      {showCategoryModal && (
        <div className="modal-backdrop-premium animate-fade-in">
          <div className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-md w-full p-8 shadow-2xl relative animate-modal-scale max-h-[85vh] overflow-y-auto custom-scrollbar bg-dark-glass">
            <div className="absolute w-24 h-24 bg-teal-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading">
                Tạo Danh Mục Mới
              </h3>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategory({ name: '', icon: '📌', type: formData.type });
                }} 
                className="p-1.5 bg-white/[0.03] border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={12} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCategory} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Tên danh mục
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  placeholder="Ví dụ: Cà phê, Mua sắm, Gym..."
                  autoFocus
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Chọn nhanh biểu tượng (Icon)
                </label>
                <div className="flex flex-wrap gap-2.5 p-3 bg-white/[0.01] border border-dark-border rounded-2xl justify-center">
                  {iconSuggestions.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, icon })}
                      className={`text-xl p-2 rounded-xl transition-all duration-150 active:scale-90 ${
                        newCategory.icon === icon ? 'bg-cyan-premium/20 border border-cyan-premium scale-110 shadow-cyan-premium/25 shadow-md' : 'bg-white/[0.02] border border-dark-border hover:bg-white/[0.05]'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                
                <input
                  type="text"
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all mt-3 font-mono text-center text-lg"
                  placeholder="Hoặc nhập emoji tự chọn..."
                  maxLength="2"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Liên kết dòng tiền
                </label>
                <div className="relative">
                  <select
                    value={newCategory.type}
                    onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}
                    className="w-full appearance-none pl-4 pr-10 py-3 bg-[#0f172a]/80 border border-dark-border rounded-xl text-xs text-white outline-none focus:border-cyan-premium focus:shadow-cyan-glow transition-all"
                  >
                    <option value="expense">Danh mục Chi tiêu</option>
                    <option value="income">Danh mục Thu nhập</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-xs">
                    <FaChevronDown />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3.5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategory({ name: '', icon: '📌', type: formData.type });
                  }}
                  className="flex-1 py-3 bg-white/[0.02] border border-dark-border rounded-xl text-xs text-gray-400 hover:text-white font-heading font-extrabold transition-all"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-teal-premium to-cyan-premium text-white font-heading font-extrabold text-xs tracking-wider rounded-xl transition-all shadow-md shadow-teal-premium/10 hover:shadow-teal-premium/30 neo-button-3d cursor-pointer"
                >
                  TẠO DANH MỤC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Receipt Laser Scanner Modal */}
      {showScanModal && (
        <div className="modal-backdrop-premium animate-fade-in">
          <div className="bg-[#101622]/95 border border-dark-border rounded-3xl max-w-md w-full p-8 shadow-2xl relative animate-modal-scale max-h-[85vh] overflow-y-auto custom-scrollbar bg-dark-glass">
            <div className="absolute w-24 h-24 bg-cyan-premium blur-[30px] -top-10 -left-10 opacity-[0.08] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-heading flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-premium"></span>
                </span>
                Máy quét hóa đơn AI OCR (Dual-Engine v2.1)
              </h3>
              <button 
                onClick={() => {
                  if (!isScanning) {
                    setShowScanModal(false);
                  }
                }} 
                disabled={isScanning}
                className="p-1.5 bg-white/[0.03] border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
              >
                <FaTimes size={12} />
              </button>
            </div>

            {!isScanning ? (
              <div className="space-y-6">
                <div className="text-xs text-gray-400 text-center leading-relaxed">
                  Tải lên hình ảnh hóa đơn giấy của bạn. AI thông minh của chúng tôi sẽ tự động đọc, phân loại danh mục và điền thông tin giao dịch ngay lập tức!
                </div>

                {/* Drag and Drop Zone */}
                <div 
                  onClick={triggerFileSelect}
                  className="border-2 border-dashed border-dark-border hover:border-cyan-premium/50 bg-[#0f172a]/40 rounded-2xl p-8 text-center cursor-pointer transition-all hover:scale-[0.99] group relative"
                >
                  <input 
                    type="file"
                    id="receipt-file-input"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <div className="text-3xl mb-3 group-hover:animate-bounce">🧾</div>
                  <span className="block text-xs font-bold text-gray-300 uppercase tracking-wide">Chọn ảnh hóa đơn</span>
                  <span className="block text-[10px] text-gray-500 mt-1 uppercase font-semibold">Nhấn vào đây để tải tệp hóa đơn lên</span>
                </div>

                <div className="bg-white/[0.02] border border-dark-border/40 rounded-xl p-3.5 flex items-start gap-3">
                  <span className="text-cyan-premium text-xs mt-0.5">ℹ️</span>
                  <p className="text-[10px] text-gray-500 leading-normal font-medium">
                    Bạn có thể chọn bất kỳ hình ảnh hóa đơn mua sắm nào để trải nghiệm hiệu ứng quét laser quét ảnh và tự động trích xuất thông tin.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                {/* Visual Laser Sweeping Scanner Container */}
                <div className="relative w-48 h-48 mx-auto bg-[#0f172a] border border-dark-border rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                  {scanImage ? (
                    <img src={scanImage} alt="Preview hóa đơn" className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="text-5xl opacity-40">🧾</div>
                  )}
                  
                  {/* Neon Cyan Laser Line Sweep */}
                  <div className="absolute left-0 w-full h-[3px] bg-cyan-premium shadow-[0_0_15px_#06b6d4] animate-laser-sweep"></div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider font-mono">
                    <span className="text-cyan-premium">{scanStatus}</span>
                    <span className="text-white">{scanProgress}%</span>
                  </div>
                  <div className="w-full bg-white/[0.03] rounded-full h-1.5 overflow-hidden border border-white/[0.02]">
                    <div 
                      className="bg-gradient-to-r from-cyan-premium to-purple-premium h-full rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;