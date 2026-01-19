import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiTrendingDown, FiUsers, FiRefreshCw, FiCreditCard } from 'react-icons/fi';
import { TbCurrencyLira } from 'react-icons/tb';
import {
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Badge,
  BalanceBadge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '../components/ui';
import { useDataCache } from '../hooks';
import { formatCurrency, formatDate } from '../utils/formatters';
import { TRANSACTION_TYPE_LABELS } from '../utils/constants';
import type {
  DashboardStats,
  TransactionWithDetails,
  DebtorCreditor,
  ProjectWithSummary,
  TransactionType,
} from '../types';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year';

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'year', label: 'Bu Yıl' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'today', label: 'Bugün' },
  { value: 'all', label: 'Tüm Zamanlar' },
];

const getDateRange = (filter: DateFilter): { start: Date | null; end: Date } => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (filter) {
    case 'today':
      return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end };
    case 'week': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      return { start: startOfWeek, end };
    }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1), end };
    default:
      return { start: null, end };
  }
};

// İşlem tipi renk haritası
const getTransactionColor = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
      return 'bg-green-500';
    case 'payment_in':
      return 'bg-blue-500';
    case 'invoice_in':
      return 'bg-red-500';
    case 'payment_out':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
};

const getTransactionTextColor = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
      return 'text-green-600';
    case 'payment_in':
      return 'text-blue-600';
    case 'invoice_in':
      return 'text-red-600';
    case 'payment_out':
      return 'text-orange-600';
    default:
      return 'text-gray-600';
  }
};

const getTransactionPrefix = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
      return '+';
    case 'payment_in':
      return '+';
    case 'invoice_in':
      return '-';
    case 'payment_out':
      return '-';
    default:
      return '';
  }
};

// Cache configuration - 5 minutes TTL, auto-refresh every 2 minutes
const CACHE_OPTIONS = { ttl: 5 * 60 * 1000, refreshInterval: 2 * 60 * 1000 };

// Fetcher functions defined outside component to prevent re-creation
const fetchStats = () => window.electronAPI.dashboard.getStats();
const fetchTransactions = () => window.electronAPI.transaction.getAll({});
const fetchDebtors = () => window.electronAPI.dashboard.getTopDebtors(5);
const fetchCreditors = () => window.electronAPI.dashboard.getTopCreditors(5);
const fetchProjects = () => window.electronAPI.project.getWithSummary();

function Dashboard() {
  const navigate = useNavigate();
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(
    null
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>('year');

  // Use cached data hooks
  const {
    data: stats,
    loading: statsLoading,
    refresh: refreshStats,
    isStale: statsStale,
  } = useDataCache<DashboardStats>('dashboard:stats', fetchStats, CACHE_OPTIONS);

  const {
    data: allTransactions,
    loading: txLoading,
    refresh: refreshTx,
    isStale: txStale,
  } = useDataCache<TransactionWithDetails[]>(
    'dashboard:transactions',
    fetchTransactions,
    CACHE_OPTIONS
  );

  const {
    data: topDebtors,
    loading: debtorsLoading,
    refresh: refreshDebtors,
  } = useDataCache<DebtorCreditor[]>('dashboard:debtors', fetchDebtors, CACHE_OPTIONS);

  const {
    data: topCreditors,
    loading: creditorsLoading,
    refresh: refreshCreditors,
  } = useDataCache<DebtorCreditor[]>('dashboard:creditors', fetchCreditors, CACHE_OPTIONS);

  const {
    data: allProjects,
    loading: projectsLoading,
    refresh: refreshProjects,
  } = useDataCache<ProjectWithSummary[]>('dashboard:projects', fetchProjects, CACHE_OPTIONS);

  // Derive active projects from cached data
  const projects = useMemo(
    () => allProjects?.filter((p) => p.status === 'active').slice(0, 5) ?? [],
    [allProjects]
  );

  // Combined loading state
  const loading =
    statsLoading || txLoading || debtorsLoading || creditorsLoading || projectsLoading;

  // Show stale indicator
  const isStale = statsStale || txStale;

  // Refresh all data
  const loadDashboardData = useCallback(async () => {
    await Promise.all([
      refreshStats(),
      refreshTx(),
      refreshDebtors(),
      refreshCreditors(),
      refreshProjects(),
    ]);
  }, [refreshStats, refreshTx, refreshDebtors, refreshCreditors, refreshProjects]);

  const filteredData = useMemo(() => {
    const { start } = getDateRange(dateFilter);
    const transactions = allTransactions ?? [];

    const filtered = start ? transactions.filter((tx) => new Date(tx.date) >= start) : transactions;

    const income = filtered
      .filter((tx) => tx.type === 'invoice_out')
      .reduce((sum, tx) => sum + (tx.amount_try || tx.amount), 0);

    const expense = filtered
      .filter((tx) => tx.type === 'invoice_in')
      .reduce((sum, tx) => sum + (tx.amount_try || tx.amount), 0);

    const collected = filtered
      .filter((tx) => tx.type === 'payment_in')
      .reduce((sum, tx) => sum + (tx.amount_try || tx.amount), 0);

    const paid = filtered
      .filter((tx) => tx.type === 'payment_out')
      .reduce((sum, tx) => sum + (tx.amount_try || tx.amount), 0);

    return {
      transactions: filtered.slice(0, 8),
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
      totalCollected: collected,
      totalPaid: paid,
    };
  }, [allTransactions, dateFilter]);

  const displayStats =
    dateFilter === 'all'
      ? stats
      : {
          ...stats,
          totalIncome: filteredData.totalIncome,
          totalExpense: filteredData.totalExpense,
          netProfit: filteredData.netProfit,
          totalCollected: filteredData.totalCollected,
          totalPaid: filteredData.totalPaid,
        };

  const recentTransactions =
    dateFilter === 'all' ? (allTransactions ?? []).slice(0, 8) : filteredData.transactions;

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gösterge Paneli</h1>
          <p className="text-gray-500 text-sm mt-1">Genel bakış ve özet bilgiler</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  dateFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button
            onClick={loadDashboardData}
            className={`btn btn-secondary ${isStale ? 'ring-2 ring-yellow-400' : ''}`}
            title={isStale ? 'Veriler güncelleniyor...' : 'Verileri yenile'}
          >
            <FiRefreshCw size={18} className={isStale ? 'animate-spin' : ''} />
            {isStale ? 'Güncelleniyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {/* Stats Grid - Row 1: Gelir/Gider (Kar-Zarar) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Toplam Gelir"
          value={formatCurrency(displayStats?.totalIncome)}
          subtitle="Satış faturaları"
          icon={FiTrendingUp}
          color="green"
        />
        <StatCard
          title="Toplam Gider"
          value={formatCurrency(displayStats?.totalExpense)}
          subtitle="Alış faturaları"
          icon={FiTrendingDown}
          color="red"
        />
        <StatCard
          title="Net Kâr/Zarar"
          value={formatCurrency(displayStats?.netProfit)}
          subtitle={
            displayStats?.netProfit !== undefined && displayStats.netProfit >= 0
              ? 'Kârlı'
              : 'Zararlı'
          }
          icon={TbCurrencyLira}
          color={
            displayStats?.netProfit !== undefined && displayStats.netProfit >= 0 ? 'green' : 'red'
          }
          highlighted
        />
      </div>

      {/* Stats Grid - Row 2: Nakit Akışı ve Cari Bakiyeler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Toplam Tahsilat"
          value={formatCurrency(displayStats?.totalCollected)}
          subtitle="Müşterilerden"
          icon={FiCreditCard}
          color="blue"
        />
        <StatCard
          title="Toplam Ödeme"
          value={formatCurrency(displayStats?.totalPaid)}
          subtitle="Tedarikçilere"
          icon={FiCreditCard}
          color="orange"
        />
        <StatCard
          title="Toplam Alacak"
          value={formatCurrency(stats?.totalReceivables)}
          subtitle="Bize borçlular"
          icon={FiUsers}
          color="green"
        />
        <StatCard
          title="Toplam Borç"
          value={formatCurrency(stats?.totalPayables)}
          subtitle="Biz borçluyuz"
          icon={FiUsers}
          color="red"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Transactions & Projects */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Transactions */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Son İşlemler</h3>
              <button
                onClick={() => navigate('/transactions')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Tümünü Gör
              </button>
            </CardHeader>
            <CardBody className="p-0">
              {recentTransactions.length === 0 ? (
                <div className="p-6 text-center text-gray-500">Henüz işlem bulunmuyor</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTransaction(tx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getTransactionColor(tx.type)}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                          <p className="text-xs text-gray-500">
                            {TRANSACTION_TYPE_LABELS[tx.type]} •{' '}
                            {tx.company_name || tx.project_name || 'Firma Genel'} •{' '}
                            {formatDate(tx.date)}
                          </p>
                        </div>
                      </div>
                      <span className={`font-medium ${getTransactionTextColor(tx.type)}`}>
                        {getTransactionPrefix(tx.type)}
                        {formatCurrency(tx.amount)}
                        {tx.currency !== 'TRY' && (
                          <span className="text-xs text-gray-400 ml-1">({tx.currency})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Active Projects */}
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Aktif Projeler</h3>
              <button
                onClick={() => navigate('/projects')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Tümünü Gör
              </button>
            </CardHeader>
            <CardBody className="p-0 overflow-hidden">
              {projects.length === 0 ? (
                <div className="p-6 text-center text-gray-500">Aktif proje bulunmuyor</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {projects.map((project) => {
                    const budgetUsed = project.estimated_budget
                      ? (project.total_expense / project.estimated_budget) * 100
                      : 0;
                    return (
                      <div
                        key={project.id}
                        className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">{project.name}</p>
                            <p className="text-xs text-gray-500">{project.code}</p>
                          </div>
                          <Badge
                            variant={project.ownership_type === 'own' ? 'info' : 'purple'}
                            className="flex-shrink-0"
                          >
                            {project.ownership_type === 'own' ? 'Kendi' : 'Müşteri'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          {project.estimated_budget ? (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>Bütçe Kullanımı</span>
                                <span>{budgetUsed.toFixed(0)}%</span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    budgetUsed > 90
                                      ? 'bg-red-500'
                                      : budgetUsed > 70
                                        ? 'bg-yellow-500'
                                        : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}
                          <div className="text-right flex-shrink-0">
                            <BalanceBadge amount={project.profit_loss} size="sm" />
                            <p className="text-xs text-gray-500 mt-1">Kar/Zarar</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column - Debtors, Creditors, Low Stock */}
        <div className="space-y-6">
          {/* Top Debtors */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Bize Borçlu Cariler</h3>
              <p className="text-xs text-gray-500">Bize borçlu olanlar</p>
            </CardHeader>
            <CardBody className="p-0">
              {!topDebtors || topDebtors.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">Borçlu cari bulunmuyor</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {topDebtors.map((debtor, index) => (
                    <div
                      key={debtor.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/companies/${debtor.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-900">{debtor.name}</span>
                      </div>
                      <BalanceBadge amount={debtor.balance} size="sm" showIcon={false} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Top Creditors */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Bizim Borçlu Olduklarımız</h3>
              <p className="text-xs text-gray-500">Biz borçluyuz</p>
            </CardHeader>
            <CardBody className="p-0">
              {!topCreditors || topCreditors.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Alacaklı cari bulunmuyor
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {topCreditors.map((creditor, index) => (
                    <div
                      key={creditor.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/companies/${creditor.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-900">{creditor.name}</span>
                      </div>
                      <BalanceBadge amount={creditor.balance} size="sm" showIcon={false} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <Modal isOpen={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} size="lg">
        {selectedTransaction && (
          <>
            <ModalHeader onClose={() => setSelectedTransaction(null)}>İşlem Detayı</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Tarih</label>
                  <p className="py-2 text-gray-900">{formatDate(selectedTransaction.date)}</p>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Tür</label>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(selectedTransaction.type)} text-white`}
                  >
                    {TRANSACTION_TYPE_LABELS[selectedTransaction.type]}
                  </span>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Kaynak</label>
                  <p className="py-2 text-gray-900">
                    {selectedTransaction.company_name
                      ? 'Cari'
                      : selectedTransaction.project_name
                        ? 'Proje'
                        : 'Firma'}
                  </p>
                </div>
                {selectedTransaction.company_name && (
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Cari</label>
                    <p className="py-2 text-gray-900">{selectedTransaction.company_name}</p>
                  </div>
                )}
                {selectedTransaction.project_name && (
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Proje</label>
                    <p className="py-2 text-gray-900">{selectedTransaction.project_name}</p>
                  </div>
                )}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Tutar</label>
                  <p
                    className={`text-lg font-bold ${getTransactionTextColor(selectedTransaction.type)}`}
                  >
                    {getTransactionPrefix(selectedTransaction.type)}
                    {formatCurrency(selectedTransaction.amount)}
                    {selectedTransaction.currency !== 'TRY' && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({selectedTransaction.currency})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Kategori</label>
                  <p className="py-2 text-gray-900">{selectedTransaction.category_name || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">Açıklama</label>
                  <p className="py-2 text-gray-900">{selectedTransaction.description || '-'}</p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="btn btn-secondary"
              >
                Kapat
              </button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}

export default Dashboard;
