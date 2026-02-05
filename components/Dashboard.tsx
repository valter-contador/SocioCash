
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Building2,
  Calendar
} from 'lucide-react';
import { AppData, TransactionType } from '../types';
import { formatCurrency } from '../dataService';

interface DashboardProps {
  data: AppData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const stats = useMemo(() => {
    const totalCredits = data.transactions
      .filter(t => t.type === TransactionType.CREDIT)
      .reduce((sum, t) => sum + t.value, 0);

    const totalDebits = data.transactions
      .filter(t => t.type === TransactionType.DEBIT)
      .reduce((sum, t) => sum + t.value, 0);

    const monthTransactions = data.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthCredits = monthTransactions
      .filter(t => t.type === TransactionType.CREDIT)
      .reduce((sum, t) => sum + t.value, 0);

    const monthDebits = monthTransactions
      .filter(t => t.type === TransactionType.DEBIT)
      .reduce((sum, t) => sum + t.value, 0);

    return {
      totalBalance: totalCredits - totalDebits,
      monthCredits,
      monthDebits,
      monthNet: monthCredits - monthDebits,
      companiesCount: data.companies.length,
      partnersCount: data.partners.length
    };
  }, [data, currentMonth, currentYear]);

  const dailyChartData = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const result = [];
    let runningBalance = 0;

    const previousTransactions = data.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getTime() < new Date(currentYear, currentMonth, 1).getTime();
    });
    runningBalance = previousTransactions.reduce((acc, t) => {
        return t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value;
    }, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = day.toString().padStart(2, '0');
      const dailyTransactions = data.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      const dayChange = dailyTransactions.reduce((acc, t) => {
        return t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value;
      }, 0);

      runningBalance += dayChange;

      result.push({
        day: `${day}/${currentMonth + 1}`,
        saldo: runningBalance,
        movimentacao: dayChange
      });
    }
    return result;
  }, [data, currentMonth, currentYear]);

  const partnerDistribution = useMemo(() => {
    return data.partners.map(p => {
      const balance = data.transactions
        .filter(t => t.partnerId === p.id)
        .reduce((acc, t) => t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value, 0);
      return {
        name: p.name,
        balance
      };
    });
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Painel Executivo</h2>
          <p className="text-slate-500 font-medium">Análise do Caixa Societário</p>
        </div>
        <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <Calendar className="text-[#2B589A]" size={18} />
          <span className="text-sm font-bold text-slate-700">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now)}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Saldos Totais" 
          value={formatCurrency(stats.totalBalance)} 
          icon={<DollarSign className="text-white" />} 
          variant="primary"
          trend={stats.totalBalance >= 0 ? 'up' : 'down'}
        />
        <StatCard 
          label="Aportes (Mês)" 
          value={formatCurrency(stats.monthCredits)} 
          icon={<TrendingUp className="text-emerald-600" />} 
          trend="up"
        />
        <StatCard 
          label="Retiradas (Mês)" 
          value={formatCurrency(stats.monthDebits)} 
          icon={<TrendingDown className="text-rose-600" />} 
          trend="down"
        />
        <StatCard 
          label="Saldo Líquido" 
          value={formatCurrency(stats.monthNet)} 
          icon={<Calendar className="text-[#00BCD4]" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-lg font-bold text-slate-800">Fluxo de Capital Acumulado</h3>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#2B589A]"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Evolução Diária</span>
             </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2B589A" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2B589A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={(val) => `R$ ${val/1000}k`} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="#2B589A" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorSaldo)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#2B589A', stroke: 'white', strokeWidth: 2 }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Partner List */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">Participação por Sócio</h3>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {partnerDistribution.length > 0 ? partnerDistribution.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-[#2B589A]/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-sm font-black text-[#2B589A] group-hover:bg-[#2B589A] group-hover:text-white transition-colors">
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700 block">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Sócio Quota</span>
                  </div>
                </div>
                <span className={`text-sm font-black ${p.balance >= 0 ? 'text-[#00E676]' : 'text-rose-500'}`}>
                  {formatCurrency(p.balance)}
                </span>
              </div>
            )) : (
              <div className="text-center py-16 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <Users className="text-slate-200" size={32} />
                </div>
                <p className="text-sm text-slate-400 font-medium tracking-tight">Nenhum sócio ativo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800">Empresas Gerenciadas</h3>
            <span className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-3 py-1 rounded-full">{data.companies.length} Entidades</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.companies.map(c => {
               const balance = data.transactions
                 .filter(t => t.companyId === c.id)
                 .reduce((acc, t) => t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value, 0);
               return (
                 <div key={c.id} className="flex flex-col p-6 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all border-b-4 border-b-[#2B589A]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#2B589A] shadow-sm">
                        <Building2 size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <span className="font-black text-slate-800 text-sm truncate block">{c.nomeFantasia}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{c.tipo}</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mb-4 bg-white px-2 py-1 rounded w-fit">{c.cnpj}</div>
                    <div className="mt-auto">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Saldo em Caixa</p>
                      <p className="text-xl font-black text-[#2B589A]">
                        {formatCurrency(balance)}
                      </p>
                    </div>
                 </div>
               )
            })}
            {data.companies.length === 0 && (
              <div className="col-span-full text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                 <Building2 className="mx-auto text-slate-200 mb-4" size={48} />
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aguardando registro de empresa</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  label: string; 
  value: string; 
  icon: React.ReactNode; 
  variant?: 'primary' | 'default';
  trend?: 'up' | 'down' 
}> = ({ label, value, icon, variant = 'default', trend }) => (
  <div className={`p-6 rounded-3xl shadow-sm flex flex-col transition-all hover:scale-[1.02] ${
    variant === 'primary' ? 'bg-[#2B589A] text-white' : 'bg-white border border-slate-200 text-slate-800'
  }`}>
    <div className="flex justify-between items-start mb-6">
      <div className={`p-3 rounded-2xl shadow-inner ${
        variant === 'primary' ? 'bg-white/10' : 'bg-slate-50'
      }`}>
        {icon}
      </div>
      {trend && (
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-tight ${
          trend === 'up' ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-rose-500/20 text-rose-500'
        }`}>
          {trend === 'up' ? 'Profit' : 'Saída'}
        </span>
      )}
    </div>
    <span className={`text-xs font-bold uppercase tracking-[0.15em] ${
      variant === 'primary' ? 'text-white/60' : 'text-slate-400'
    }`}>{label}</span>
    <span className="text-2xl font-black mt-1 tracking-tight">{value}</span>
  </div>
);

export default Dashboard;
