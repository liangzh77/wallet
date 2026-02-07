import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Person, Transaction, User } from './types';
import { useLongPress } from './hooks/useLongPress';

// API 请求封装
const api = {
  getToken: () => localStorage.getItem('token'),
  headers: () => ({
    'Content-Type': 'application/json',
    ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
  }),
  async post(url: string, body: object) {
    const res = await fetch(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  async get(url: string) {
    const res = await fetch(url, { headers: this.headers() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  async put(url: string, body: object) {
    const res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  async del(url: string) {
    const res = await fetch(url, { method: 'DELETE', headers: this.headers() });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '请求失败');
    }
  },
};

// ============== 登录/注册页面 ==============
const AuthPage: React.FC<{ onLogin: (token: string, user: User) => void }> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('用户名和密码不能为空');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const data = await api.post(url, { username: username.trim(), password });
      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f2f2f7] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-blue-600 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-lg shadow-blue-200">
            <i className="fa-solid fa-wallet text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-black text-gray-800">家庭记账本</h1>
          <p className="text-sm text-gray-400 font-bold">{isRegister ? '创建新账号' : '登录您的账号'}</p>
        </div>

        {/* 表单 */}
        <div className="bg-white rounded-3xl p-6 ios-shadow space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl text-center border border-red-100">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] text-gray-400 font-bold ml-1 uppercase">用户名</label>
            <input
              autoFocus
              className="w-full p-4 bg-gray-100 rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all font-bold"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-400 font-bold ml-1 uppercase">密码</label>
            <input
              type="password"
              className="w-full p-4 bg-gray-100 rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {isRegister && (
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 font-bold ml-1 uppercase">确认密码</label>
              <input
                type="password"
                className="w-full p-4 bg-gray-100 rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-blue-500 transition-all font-bold"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full p-4 bg-blue-600 text-white rounded-xl font-black active:opacity-90 shadow-lg shadow-blue-100 disabled:opacity-50 transition-all"
          >
            {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
          </button>
        </div>

        {/* 切换登录/注册 */}
        <div className="text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); setConfirmPassword(''); }}
            className="text-blue-500 font-bold text-sm"
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============== 管理员页面 ==============
const AdminPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [users, setUsers] = useState<{ id: number; username: string; isAdmin: boolean; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/users');
      setUsers(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleResetPassword = async (userId: number, username: string) => {
    try {
      const data = await api.post('/api/admin/reset-password', { userId });
      setResetResult({ username, password: data.newPassword });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await api.del(`/api/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f2f2f7] pt-12 px-4 pb-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 px-2">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <button onClick={onBack} className="text-blue-500 font-bold px-2 py-1">返回</button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 font-bold">加载中...</div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden mb-6 ios-shadow">
          {users.map((u, idx) => (
            <div key={u.id} className={`flex items-center justify-between p-4 ${idx !== users.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold truncate">{u.username}</span>
                  {u.isAdmin && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">管理员</span>}
                </div>
                <span className="text-xs text-gray-400">注册于 {new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleResetPassword(u.id, u.username)}
                  className="text-orange-500 w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center active:bg-orange-100 transition-colors"
                  title="重置密码"
                >
                  <i className="fa-solid fa-key text-sm"></i>
                </button>
                <button
                  onClick={() => setDeleteConfirm(u.id)}
                  className="text-red-500 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center active:bg-red-100 transition-colors"
                  title="删除用户"
                >
                  <i className="fa-solid fa-trash-can text-sm"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 重置密码结果弹窗 */}
      {resetResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 ios-shadow text-center">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto text-2xl border border-green-100">
              <i className="fa-solid fa-check"></i>
            </div>
            <h2 className="text-xl font-bold">密码已重置</h2>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-sm text-gray-500">用户: <span className="font-bold text-gray-800">{resetResult.username}</span></p>
              <p className="text-sm text-gray-500">新密码: <span className="font-black text-blue-600 text-lg">{resetResult.password}</span></p>
            </div>
            <p className="text-xs text-gray-400">请将新密码告知用户</p>
            <button
              onClick={() => setResetResult(null)}
              className="w-full p-4 bg-blue-600 text-white rounded-xl font-bold active:opacity-90"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 z-[100]">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-7 ios-shadow text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl border border-red-100">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="text-xl font-black">确认删除？</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-bold">
              删除用户将同时删除该用户的所有数据，此操作不可撤回。
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleDeleteUser(deleteConfirm)}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black active:opacity-80 shadow-lg shadow-red-100"
              >
                确定删除
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
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

// ============== 主应用 ==============
const App: React.FC = () => {
  // --- 认证状态 ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- 数据状态 ---
  const [people, setPeople] = useState<Person[]>([]);
  const [activePersonId, setActivePersonId] = useState<number>(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // --- UI 状态 ---
  const [past, setPast] = useState<Person[][]>([]);
  const [future, setFuture] = useState<Person[][]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // --- 初始化: 检查已有 token ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api.get('/api/auth/me')
      .then((data) => {
        setUser({ id: data.id, username: data.username, isAdmin: data.isAdmin });
      })
      .catch(() => {
        localStorage.removeItem('token');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // --- 登录成功后加载数据 ---
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [personsData, txData] = await Promise.all([
        api.get('/api/persons'),
        api.get('/api/transactions?personId=all'),
      ]);
      setPeople(personsData.map((p: any) => ({
        id: p.id,
        name: p.name,
        balance: Number(p.balance),
        dailyWage: Number(p.dailyWage),
        createdAt: p.createdAt,
      })));
      setTransactions(txData.map((t: any) => ({
        id: t.id,
        personId: t.personId,
        type: t.type,
        amount: Number(t.amount),
        createdAt: t.createdAt,
        description: t.description,
      })));
      if (personsData.length > 0) {
        setActivePersonId(personsData[0].id);
      }
    } catch (err: any) {
      console.error('加载数据失败:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // --- 登录回调 ---
  const handleLogin = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  // --- 退出登录 ---
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPeople([]);
    setTransactions([]);
    setPast([]);
    setFuture([]);
    setIsSettingsOpen(false);
    setIsAdminOpen(false);
  };

  // --- 派生状态 ---
  const activePerson = useMemo(() => people.find(p => p.id === activePersonId), [people, activePersonId]);
  const activeTransactions = useMemo(() =>
    transactions
      .filter(t => t.personId === activePersonId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [transactions, activePersonId]
  );

  // --- Undo/Redo（纯前端）---
  const recordState = useCallback(() => {
    setPast(prev => [...prev, JSON.parse(JSON.stringify(people))]);
    setFuture([]);
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

  // --- 长按按钮（仅修改本地 adjustmentAmount）---
  const lpAdjustInc1 = useLongPress(() => setAdjustmentAmount(prev => prev + 1));
  const lpAdjustDec1 = useLongPress(() => setAdjustmentAmount(prev => prev - 1));
  const lpAdjustInc10 = useLongPress(() => setAdjustmentAmount(prev => prev + 10));
  const lpAdjustDec10 = useLongPress(() => setAdjustmentAmount(prev => prev - 10));

  // --- 应用修改（调用 API）---
  const executeModification = async () => {
    if (!activePerson || adjustmentAmount === 0) return;
    recordState();

    const newBalance = activePerson.balance + adjustmentAmount;
    const type = adjustmentAmount > 0 ? 'add' : 'subtract';
    const description = `${adjustmentAmount > 0 ? '增加' : '减少'}${Math.abs(adjustmentAmount)}元`;

    try {
      const [, txData] = await Promise.all([
        api.put(`/api/persons/${activePersonId}`, { balance: newBalance }),
        api.post('/api/transactions', {
          personId: activePersonId,
          type,
          amount: Math.abs(adjustmentAmount),
          description,
        }),
      ]);

      setPeople(prev => prev.map(p =>
        p.id === activePersonId ? { ...p, balance: newBalance } : p
      ));
      setTransactions(prev => [{
        id: txData.id,
        personId: txData.personId,
        type: txData.type,
        amount: Number(txData.amount),
        createdAt: txData.createdAt,
        description: txData.description,
      }, ...prev]);
    } catch (err: any) {
      alert('操作失败: ' + err.message);
    }
  };

  // --- 清空余额（调用 API）---
  const clearBalance = async () => {
    if (!activePerson) return;
    recordState();

    try {
      const [, txData] = await Promise.all([
        api.put(`/api/persons/${activePersonId}`, { balance: 0 }),
        api.post('/api/transactions', {
          personId: activePersonId,
          type: 'clear',
          amount: 0,
          description: '清空余额',
        }),
      ]);

      setPeople(prev => prev.map(p =>
        p.id === activePersonId ? { ...p, balance: 0 } : p
      ));
      setTransactions(prev => [{
        id: txData.id,
        personId: txData.personId,
        type: txData.type,
        amount: Number(txData.amount),
        createdAt: txData.createdAt,
        description: txData.description,
      }, ...prev]);
    } catch (err: any) {
      alert('操作失败: ' + err.message);
    }
  };

  // --- 添加家庭成员（调用 API）---
  const handleAddPerson = async () => {
    if (!newName.trim()) return;
    recordState();

    try {
      const data = await api.post('/api/persons', { name: newName.trim(), dailyWage: 100 });
      const newP: Person = {
        id: data.id,
        name: data.name,
        balance: Number(data.balance),
        dailyWage: Number(data.dailyWage),
      };
      setPeople(prev => [...prev, newP]);
      setNewName('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert('添加失败: ' + err.message);
    }
  };

  // --- 删除家庭成员（调用 API）---
  const handleDeletePerson = async (personId: number) => {
    if (people.length <= 1) return;
    recordState();

    try {
      await api.del(`/api/persons/${personId}`);
      setPeople(prev => prev.filter(p => p.id !== personId));
      setTransactions(prev => prev.filter(t => t.personId !== personId));
      if (activePersonId === personId) {
        const remaining = people.find(p => p.id !== personId);
        if (remaining) setActivePersonId(remaining.id);
      }
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  // --- 保存编辑（调用 API）---
  const handleSaveEdit = async () => {
    if (!editingPerson) return;
    recordState();

    try {
      await api.put(`/api/persons/${editingPerson.id}`, {
        name: editingPerson.name,
        dailyWage: editingPerson.dailyWage,
      });
      setPeople(prev => prev.map(p => p.id === editingPerson.id ? editingPerson : p));
      setEditingPerson(null);
    } catch (err: any) {
      alert('保存失败: ' + err.message);
    }
  };

  // --- 加载中 ---
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f2f2f7]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.2rem] flex items-center justify-center mx-auto shadow-lg shadow-blue-200">
            <i className="fa-solid fa-wallet text-2xl text-white"></i>
          </div>
          <p className="text-gray-400 font-bold text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // --- 未登录: 显示登录页 ---
  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  // --- 管理员页面 ---
  if (isAdminOpen) {
    return <AdminPage onBack={() => setIsAdminOpen(false)} />;
  }

  // --- 数据加载中 ---
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f2f2f7]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.2rem] flex items-center justify-center mx-auto shadow-lg shadow-blue-200 animate-pulse">
            <i className="fa-solid fa-wallet text-2xl text-white"></i>
          </div>
          <p className="text-gray-400 font-bold text-sm">正在加载数据...</p>
        </div>
      </div>
    );
  }

  // --- 设置页面（人员管理 + 退出登录） ---
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
                <button onClick={() => setEditingPerson({...p})} className="text-blue-500 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center active:bg-blue-100 transition-colors">
                  <i className="fa-solid fa-pen-to-square"></i>
                </button>
                <button onClick={() => handleDeletePerson(p.id)} className="text-red-500 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center active:bg-red-100 transition-colors">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full bg-white text-blue-500 font-bold p-4 rounded-2xl ios-shadow active:bg-gray-50 transition-all mb-4 flex items-center justify-center"
        >
          <i className="fa-solid fa-plus mr-2"></i> 添加人员
        </button>

        {/* 管理员入口 */}
        {user.isAdmin && (
          <button
            onClick={() => { setIsSettingsOpen(false); setIsAdminOpen(true); }}
            className="w-full bg-white text-blue-600 font-bold p-4 rounded-2xl ios-shadow active:bg-gray-50 transition-all mb-4 flex items-center justify-center"
          >
            <i className="fa-solid fa-shield-halved mr-2"></i> 用户管理（管理员）
          </button>
        )}

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          className="w-full bg-white text-red-500 font-bold p-4 rounded-2xl ios-shadow active:bg-gray-50 transition-all mb-20 flex items-center justify-center"
        >
          <i className="fa-solid fa-right-from-bracket mr-2"></i> 退出登录
        </button>

        {/* 当前用户信息 */}
        <div className="text-center text-xs text-gray-300 mb-4">
          当前用户: {user.username}
        </div>

        {/* 添加成员弹窗 */}
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
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setIsAddModalOpen(false); setNewName(''); }} className="flex-1 p-4 bg-gray-100 rounded-xl font-bold active:bg-gray-200">取消</button>
                <button onClick={handleAddPerson} className="flex-1 p-4 bg-blue-500 text-white rounded-xl font-bold active:opacity-90 shadow-lg shadow-blue-100">确定</button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑成员弹窗 */}
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
                <button onClick={handleSaveEdit} className="flex-1 p-4 bg-blue-500 text-white rounded-xl font-bold active:opacity-90 shadow-lg shadow-blue-100">保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 主界面 ---
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
        {people.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-user-plus text-3xl text-gray-300"></i>
            </div>
            <p className="text-gray-400 font-bold mb-4">还没有家庭成员</p>
            <button
              onClick={() => { setIsSettingsOpen(true); setIsAddModalOpen(true); }}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold active:opacity-90"
            >
              添加第一位成员
            </button>
          </div>
        ) : activePerson && (
          <>
            {/* --- Balance Display --- */}
            <div className="bg-white rounded-[2.5rem] p-8 ios-shadow text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <i className="fa-solid fa-wallet text-6xl"></i>
              </div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{activePerson.name} 的现金余额</p>
              <h2 className="text-5xl font-black tracking-tighter text-blue-600 truncate px-2">
                ¥{activePerson.balance.toLocaleString()}
              </h2>
            </div>

            {/* --- Daily Wage Display --- */}
            <div className="bg-white rounded-3xl p-5 ios-shadow">
              <div className="flex justify-between items-center">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 truncate">今日薪酬 (于设置中修改)</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-gray-400">¥</span>
                    <span className="text-2xl font-black truncate">{activePerson.dailyWage}</span>
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
                          <p className="text-[9px] text-gray-400 font-bold">{new Date(tx.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</p>
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
          </>
        )}
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
