
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Person, Transaction } from './types';
import { useLongPress } from './hooks/useLongPress';

// Utility to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  // --- State ---
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('wallet_people');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: '我', balance: 0, dailyWage: 100 }
    ];
  });
  
  const [activePersonId, setActivePersonId] = useState<string>(people[0]?.id || '');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  
  // History stacks for Undo/Redo
  const [past, setPast] = useState<Person[][]>([]);
  const [future, setFuture] = useState<Person[][]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('wallet_txs');
    return saved ? JSON.parse(saved) : [];
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('wallet_people', JSON.stringify(people));
    localStorage.setItem('wallet_txs', JSON.stringify(transactions));
  }, [people, transactions]);

  // --- Derived State ---
  const activePerson = useMemo(() => people.find(p => p.id === activePersonId), [people, activePersonId]);
  const activeTransactions = useMemo(() => 
    transactions.filter(t => t.personId === activePersonId).sort((a, b) => b.timestamp - a.timestamp),
    [transactions, activePersonId]
  );

  // --- Undo/Redo Logic ---
  const recordState = useCallback(() => {
    setPast(prev => [...prev, JSON.parse(JSON.stringify(people))]);
    setFuture([]); // Clear redo stack on new action
  }, [people]);

  const undo = () => {
    if (past.length > 0) {
      const previous = past[past.length - 1];
      const current = JSON.parse(JSON.stringify(people));
      setPast(prev => prev.slice(0, -1));
      setFuture(prev => [current, ...prev]);
      setPeople(previous);
    }
  };

  const redo = () => {
    if (future.length > 0) {
      const next = future[0];
      const current = JSON.parse(JSON.stringify(people));
      setFuture(prev => prev.slice(1));
      setPast(prev => [...prev, current]);
      setPeople(next);
    }
  };

  // --- Actions ---
  const executeModification = () => {
    if (!activePerson || adjustmentAmount === 0) return;
    recordState();
    
    setPeople(prev => prev.map(p => {
      if (p.id === activePersonId) {
        return { ...p, balance: p.balance + adjustmentAmount };
      }
      return p;
    }));

    const type = adjustmentAmount > 0 ? 'add' : 'subtract';
    const newTx: Transaction = {
      id: generateId(),
      personId: activePersonId,
      type,
      amount: Math.abs(adjustmentAmount),
      timestamp: Date.now(),
      description: `${adjustmentAmount > 0 ? '增加' : '减少'}${Math.abs(adjustmentAmount)}元`
    };
    setTransactions(prev => [newTx, ...prev]);
    setAdjustmentAmount(0); // Reset after application
  };

  const clearBalance = () => {
    if (!activePerson) return;
    recordState();
    setPeople(prev => prev.map(p => {
      if (p.id === activePersonId) {
        return { ...p, balance: 0 };
      }
      return p;
    }));
    const newTx: Transaction = {
      id: generateId(),
      personId: activePersonId,
      type: 'clear',
      amount: 0,
      timestamp: Date.now(),
      description: '清空余额'
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const handleAddPerson = () => {
    if (newName.trim()) {
      recordState();
      const newP: Person = { id: generateId(), name: newName.trim(), balance: 0, dailyWage: 100 };
      setPeople([...people, newP]);
      setNewName('');
      setIsAddModalOpen(false);
    }
  };

  // --- Long Press Handlers (Mainly for Adjustment Input) ---
  const lpAdjustInc1 = useLongPress(() => setAdjustmentAmount(prev => prev + 1));
  const lpAdjustDec1 = useLongPress(() => setAdjustmentAmount(prev => prev - 1));
  const lpAdjustInc10 = useLongPress(() => setAdjustmentAmount(prev => prev + 10));
  const lpAdjustDec10 = useLongPress(() => setAdjustmentAmount(prev => prev - 10));

  // --- Settings View ---
  if (isSettingsOpen) {
    return (
      <div className="flex flex-col h-screen bg-[#f2f2f7] pt-12 px-4 pb-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6 px-2">
          <h1 className="text-2xl font-bold">人员管理</h1>
          <button onClick={() => setIsSettingsOpen(false)} className="text-blue-500 font-bold px-2 py-1">完成</button>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden mb-6 ios-shadow">
          {people.map((p, idx) => (
            <div key={p.id} className={`flex items-center justify-between p-4 ${idx !== people.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="flex flex-col">
                <span className="text-lg font-bold">{p.name}</span>
                <span className="text-xs text-gray-400">日薪: ¥{p.dailyWage}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingPerson(p)} className="text-blue-500 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center active:bg-blue-100 transition-colors">
                  <i className="fa-solid fa-pen-to-square"></i>
                </button>
                <button onClick={() => {
                  if (people.length > 1) {
                    recordState();
                    setPeople(people.filter(person => person.id !== p.id));
                    if (activePersonId === p.id) setActivePersonId(people.find(person => person.id !== p.id)?.id || '');
                  }
                }} className="text-red-500 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center active:bg-red-100 transition-colors">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-full bg-white text-blue-500 font-bold p-4 rounded-2xl ios-shadow active:bg-gray-50 transition-all mb-20 flex items-center justify-center"
        >
          <i className="fa-solid fa-plus mr-2"></i> 添加人员
        </button>

        {/* Add Person Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 ios-shadow">
              <h2 className="text-xl font-bold text-center">添加新成员</h2>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold ml-1 uppercase">姓名</label>
                <input 
                  autoFocus
                  className="w-full p-4 bg-gray-100 rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all font-bold" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="请输入姓名..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setIsAddModalOpen(false); setNewName(''); }} className="flex-1 p-4 bg-gray-100 rounded-xl font-bold active:bg-gray-200">取消</button>
                <button onClick={handleAddPerson} className="flex-1 p-4 bg-blue-500 text-white rounded-xl font-bold active:opacity-90 shadow-lg shadow-blue-100">确定</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Person Modal */}
        {editingPerson && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 ios-shadow">
              <h2 className="text-xl font-bold text-center">修改信息</h2>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold ml-1 uppercase">姓名</label>
                <input 
                  className="w-full p-4 bg-gray-100 rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all font-bold" 
                  value={editingPerson.name} 
                  onChange={(e) => setEditingPerson({...editingPerson, name: e.target.value})}
                  placeholder="姓名"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold ml-1 uppercase">默认日薪</label>
                <input 
                  className="w-full p-4 bg-gray-100 rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all font-bold" 
                  type="number"
                  value={editingPerson.dailyWage} 
                  onChange={(e) => setEditingPerson({...editingPerson, dailyWage: Number(e.target.value)})}
                  placeholder="日薪"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingPerson(null)} className="flex-1 p-4 bg-gray-100 rounded-xl font-bold active:bg-gray-200">取消</button>
                <button onClick={() => {
                  recordState();
                  setPeople(people.map(p => p.id === editingPerson.id ? editingPerson : p));
                  setEditingPerson(null);
                }} className="flex-1 p-4 bg-blue-500 text-white rounded-xl font-bold active:opacity-90 shadow-lg shadow-blue-100">保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto relative text-[#1c1c1e] bg-[#f2f2f7] overflow-hidden">
      {/* --- Top Navbar (Switcher) --- */}
      <div className="pt-12 px-4 pb-3 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100 shadow-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {people.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePersonId(p.id)}
              className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 border-2 ${
                activePersonId === p.id 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 scale-105' 
                  : 'bg-white text-gray-400 border-transparent hover:bg-gray-50 active:scale-95'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-36 pt-4">
        {/* --- Balance Display --- */}
        <div className="bg-white rounded-[2.5rem] p-8 ios-shadow text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <i className="fa-solid fa-wallet text-6xl"></i>
          </div>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{activePerson?.name} 的现金余额</p>
          <h2 className="text-5xl font-black tracking-tighter text-blue-600 truncate px-2">
            ¥{activePerson?.balance.toLocaleString()}
          </h2>
        </div>

        {/* --- Daily Wage Display --- */}
        <div className="bg-white rounded-3xl p-5 ios-shadow">
          <div className="flex justify-between items-center">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 truncate">今日薪酬 (于设置中修改)</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-gray-400">¥</span>
                <span className="text-2xl font-black truncate">{activePerson?.dailyWage}</span>
              </div>
            </div>
            <div className="text-gray-200 pr-2">
              <i className="fa-solid fa-coins text-3xl"></i>
            </div>
          </div>
        </div>

        {/* --- Transaction Control --- */}
        <div className="bg-white rounded-3xl p-6 ios-shadow space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 relative">
              <input 
                type="number"
                value={adjustmentAmount === 0 ? '' : adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                className="w-full bg-gray-50 rounded-2xl p-4 text-3xl font-black text-center border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-200"
                placeholder="0"
              />
              {adjustmentAmount !== 0 && (
                <button 
                  onClick={() => setAdjustmentAmount(0)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <i className="fa-solid fa-circle-xmark text-lg"></i>
                </button>
              )}
            </div>
            <button 
              onClick={executeModification}
              disabled={adjustmentAmount === 0}
              className={`w-20 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-all flex-shrink-0 ${
                adjustmentAmount === 0 
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 text-white ios-btn-active shadow-blue-100 active:scale-95'
              }`}
            >
              改
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button {...lpAdjustDec10} className="py-3 bg-gray-50 rounded-xl text-xs font-black ios-btn-active text-gray-400 border border-gray-100">-10</button>
            <button {...lpAdjustDec1} className="py-3 bg-gray-50 rounded-xl text-xs font-black ios-btn-active text-gray-400 border border-gray-100">-1</button>
            <button {...lpAdjustInc1} className="py-3 bg-blue-50 rounded-xl text-xs font-black ios-btn-active text-blue-600 border border-blue-100">+1</button>
            <button {...lpAdjustInc10} className="py-3 bg-blue-50 rounded-xl text-xs font-black ios-btn-active text-blue-600 border border-blue-100">+10</button>
          </div>
        </div>

        {/* --- History List --- */}
        <div className="space-y-3 pb-10">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">最近变动</h3>
            <span className="text-[10px] text-gray-300 font-bold">{activeTransactions.length}</span>
          </div>
          <div className="space-y-2">
            {activeTransactions.length === 0 ? (
              <div className="text-center py-10 bg-white/40 rounded-3xl border-2 border-dashed border-gray-200 text-gray-300 italic text-sm">无记录</div>
            ) : (
              activeTransactions.map(tx => (
                <div key={tx.id} className="bg-white p-4 rounded-2xl flex justify-between items-center ios-shadow border border-white">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                      tx.type === 'add' ? 'bg-green-50 text-green-500' : 
                      tx.type === 'subtract' ? 'bg-red-50 text-red-500' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      <i className={`fa-solid ${
                        tx.type === 'add' ? 'fa-circle-plus' : 
                        tx.type === 'subtract' ? 'fa-circle-minus' : 
                        'fa-broom'
                      }`}></i>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate">{tx.description}</p>
                      <p className="text-[9px] text-gray-400 font-bold">{new Date(tx.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <p className={`font-black text-sm whitespace-nowrap flex-shrink-0 ${tx.type === 'add' ? 'text-green-500' : tx.type === 'subtract' ? 'text-red-500' : 'text-gray-400'}`}>
                    {tx.type === 'add' ? '+' : tx.type === 'subtract' ? '-' : ''}{tx.amount !== 0 ? `¥${tx.amount}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- Tab Bar --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-gray-100 px-6 py-4 flex justify-between items-center z-40 pb-safe-area-inset-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
        <button onClick={undo} disabled={past.length === 0} className="flex flex-col items-center gap-1 group">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${past.length > 0 ? 'bg-gray-50 text-blue-600 ios-btn-active' : 'text-gray-200'}`}>
            <i className="fa-solid fa-arrow-rotate-left text-xl"></i>
          </div>
          <span className={`text-[10px] font-black ${past.length > 0 ? 'text-gray-500' : 'text-gray-200'}`}>后退</span>
        </button>

        <button onClick={redo} disabled={future.length === 0} className="flex flex-col items-center gap-1 group">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${future.length > 0 ? 'bg-gray-50 text-blue-600 ios-btn-active' : 'text-gray-200'}`}>
            <i className="fa-solid fa-arrow-rotate-right text-xl"></i>
          </div>
          <span className={`text-[10px] font-black ${future.length > 0 ? 'text-gray-500' : 'text-gray-200'}`}>前进</span>
        </button>

        <button onClick={() => setIsClearModalOpen(true)} className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 ios-btn-active shadow-sm border border-red-100/30">
            <i className="fa-solid fa-broom text-xl"></i>
          </div>
          <span className="text-[10px] font-black text-gray-400">清除</span>
        </button>

        <button onClick={() => setIsSettingsOpen(true)} className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 ios-btn-active border border-gray-100">
            <i className="fa-solid fa-gear text-xl"></i>
          </div>
          <span className="text-[10px] font-black text-gray-400">设置</span>
        </button>
      </div>

      {/* --- Clear Confirmation Modal --- */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 z-[100]">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-7 ios-shadow text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl border border-red-100">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="text-xl font-black">确认清零？</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-bold">此操作将清空 <span className="text-gray-800 underline">{activePerson?.name}</span> 的所有现金。您可以撤回此操作。</p>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  clearBalance();
                  setIsClearModalOpen(false);
                }} 
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black active:opacity-80 shadow-lg shadow-red-100"
              >
                确定清空
              </button>
              <button 
                onClick={() => setIsClearModalOpen(false)} 
                className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-black active:bg-gray-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
