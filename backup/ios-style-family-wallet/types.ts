
export interface Transaction {
  id: string;
  personId: string;
  type: 'add' | 'subtract' | 'clear' | 'daily_wage';
  amount: number;
  timestamp: number;
  description: string;
}

export interface Person {
  id: string;
  name: string;
  balance: number;
  dailyWage: number;
}

export interface AppState {
  people: Person[];
}
