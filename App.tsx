
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  ArrowRightLeft, 
  FileText, 
  Wallet,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { AppData } from './types';
import { loadData, saveData } from './dataService';
import Dashboard from './components/Dashboard';
import Companies from './components/Companies';
import Partners from './components/Partners';
import Transactions from './components/Transactions';
import Reports from './components/Reports';

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(loadData());
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateData = (newData: AppData) => {
    setData(newData);
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  return (
    <HashRouter>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-[#2B589A]/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-translate-x-full lg:w-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-8 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#2B589A] flex items-center justify-center relative overflow-hidden">
                     <span className="text-white font-black text-xs">JC</span>
                     <div className="absolute top-0 right-0 w-3 h-3 bg-[#00E676] translate-x-1.5 -translate-y-1.5 rounded-full"></div>
                  </div>
                  <h1 className="text-xl font-black text-[#2B589A] tracking-tighter">
                    JCBUARQUE
                  </h1>
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-[0.2em] font-bold leading-none">
                  Soluções Contábeis
                </p>
              </div>
              <button 
                onClick={toggleSidebar}
                className="lg:hidden p-2 text-slate-400 hover:text-[#2B589A]"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 mt-2 px-4 space-y-1.5 overflow-y-auto">
              <SidebarItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)} />
              <SidebarItem to="/empresas" icon={<Building2 size={20} />} label="Empresas" onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)} />
              <SidebarItem to="/socios" icon={<Users size={20} />} label="Sócios" onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)} />
              <SidebarItem to="/transacoes" icon={<ArrowRightLeft size={20} />} label="Movimentações" onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)} />
              <SidebarItem to="/relatorios" icon={<FileText size={20} />} label="Relatórios" onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)} />
            </nav>

            <div className="p-6 border-t border-slate-100 bg-slate-50/80">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#2B589A] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#2B589A]/20">
                    AD
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-800 truncate">Administrador</p>
                    <p className="text-[10px] text-slate-500 truncate">valter@jcbuarque.com.br</p>
                  </div>
                </div>
                <a 
                  href="https://wa.me/5581992893801" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <MessageSquare size={14} />
                  81 99289-3801
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
          {/* Header Bar */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 shrink-0 shadow-sm z-20">
            <button 
              onClick={toggleSidebar}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              title={isSidebarOpen ? "Fechar menu" : "Abrir menu"}
            >
              {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
            <div className="ml-4 h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div className="ml-4 hidden sm:block">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SócioCash - Gestão de Caixa Societário</span>
            </div>
            
            <div className="ml-auto flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-bold text-[#2B589A] leading-tight">JC BUARQUE</span>
                <span className="text-[8px] text-slate-400 leading-tight uppercase font-medium">Accounting Excellence</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[#2B589A]">
                <Users size={16} />
              </div>
            </div>
          </header>

          {/* Page Wrapper */}
          <main className="flex-1 overflow-y-auto bg-slate-50 relative">
            <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
              <Routes>
                <Route path="/" element={<Dashboard data={data} />} />
                <Route path="/empresas" element={<Companies data={data} onUpdate={updateData} />} />
                <Route path="/socios" element={<Partners data={data} onUpdate={updateData} />} />
                <Route path="/transacoes" element={<Transactions data={data} onUpdate={updateData} />} />
                <Route path="/relatorios" element={<Reports data={data} />} />
              </Routes>
            </div>
            
            {/* Discret Logo Overlay */}
            <div className="fixed bottom-4 right-4 opacity-10 pointer-events-none select-none">
                <h2 className="text-2xl font-black text-[#2B589A]">JCBUARQUE</h2>
            </div>
          </main>
        </div>
      </div>
    </HashRouter>
  );
};

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
        isActive 
          ? 'bg-[#2B589A] text-white shadow-lg shadow-[#2B589A]/30 font-bold scale-[1.02]' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-[#2B589A]'
      }`}
    >
      <span className={isActive ? 'text-white' : 'text-slate-400 transition-colors'}>
        {icon}
      </span>
      <span className="text-[13px] tracking-tight">{label}</span>
    </Link>
  );
};

export default App;
