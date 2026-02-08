// 前端类型（id 改为 number 以匹配数据库 SERIAL）
export interface Transaction {
  id: number;
  personId: number;
  type: 'add' | 'subtract' | 'clear' | 'daily_wage';
  amount: number;
  createdAt: string;
  description: string;
}

export interface Person {
  id: number;
  name: string;
  balance: number;
  dailyWage: number;
  lastWageDate?: string;
  createdAt?: string;
}

// 用户信息
export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

// API 响应类型
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}

// JWT Payload（后端用）
export interface JwtPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
}
