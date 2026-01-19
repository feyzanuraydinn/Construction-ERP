import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiFolder,
  FiPackage,
  FiBriefcase,
  FiList,
  FiBarChart2,
  FiSettings,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
} from 'react-icons/fi';

// Error Boundary ve Toast
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { CommandPalette } from './components/ui';

// Logo Component
interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = 'w-10 h-10' }) => (
  <img src="./logo.svg" alt="Logo" className={className} />
);

// Lazy loaded pages for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Stock = lazy(() => import('./pages/Stock'));
const CompanyAccount = lazy(() => import('./pages/CompanyAccount'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const Trash = lazy(() => import('./pages/Trash'));

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

interface MenuItem {
  path: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const menuItems: MenuItem[] = [
  { path: '/', icon: FiHome, label: 'Dashboard' },
  { path: '/companies', icon: FiUsers, label: 'Cari Hesaplar' },
  { path: '/projects', icon: FiFolder, label: 'Projeler' },
  { path: '/stock', icon: FiPackage, label: 'Stok Yönetimi' },
  { path: '/company-account', icon: FiBriefcase, label: 'Firma Hesabı' },
  { path: '/transactions', icon: FiList, label: 'Tüm İşlemler' },
  { path: '/analytics', icon: FiBarChart2, label: 'Analizler' },
];

const bottomMenuItems: MenuItem[] = [
  { path: '/settings', icon: FiSettings, label: 'Ayarlar' },
  { path: '/trash', icon: FiTrash2, label: 'Çöp Kutusu' },
];

// Inner App component that can use Toast context
const AppContent: React.FC = () => {
  const toast = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);

  const handleBackup = useCallback(async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      await window.electronAPI.backup.create();
      toast.success('Veritabanı yedeği başarıyla oluşturuldu');
    } catch (error) {
      toast.error('Yedek oluşturulamadı');
      console.error('Backup error:', error);
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K - Global search (works with both lowercase and uppercase)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Ctrl+S - Backup database (works with both lowercase and uppercase)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleBackup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBackup]);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-20' : 'w-64'
          } bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 ease-in-out relative flex-shrink-0`}
        >
          {/* Logo */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Logo className="w-10 h-10 text-blue-500" />
              {!sidebarCollapsed && (
                <div className="fade-in">
                  <h1 className="font-bold text-lg">İnşaat ERP</h1>
                  <p className="text-xs text-gray-400">v2.1.0</p>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 bg-slate-800 text-white p-1.5 rounded-full border border-white/20 hover:bg-slate-700 transition-colors z-10"
          >
            {sidebarCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
          </button>

          {/* Search Button */}
          <div className="px-3 pt-4">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
              title={sidebarCollapsed ? 'Ara (Ctrl+K)' : ''}
            >
              <FiSearch size={20} />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm">Ara...</span>
                  <kbd className="text-xs px-1.5 py-0.5 bg-white/10 rounded">Ctrl+K</kbd>
                </>
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active bg-white/10' : 'text-gray-300 hover:text-white'}`
                }
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon size={20} />
                {!sidebarCollapsed && <span className="fade-in">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Bottom Menu */}
          <div className="border-t border-white/10 py-4 px-3 space-y-1">
            {bottomMenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active bg-white/10' : 'text-gray-300 hover:text-white'}`
                }
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon size={20} />
                {!sidebarCollapsed && <span className="fade-in">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:id" element={<CompanyDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/company-account" element={<CompanyAccount />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/trash" element={<Trash />} />
            </Routes>
          </Suspense>
        </main>

        {/* Command Palette */}
        <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      </div>
    </HashRouter>
  );
};

// Main App wrapper with providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
