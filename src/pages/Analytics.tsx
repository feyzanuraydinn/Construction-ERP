import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { FiBarChart2 } from 'react-icons/fi';
import { Card, CardHeader, CardBody, Select, EmptyState } from '../components/ui';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';
import { MONTHS } from '../utils/constants';
import type {
  ProjectWithSummary,
  CompanyWithBalance,
  MonthlyStats,
  CategoryBreakdown,
} from '../types';

const COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b',
  '#14b8a6',
  '#f97316',
];

interface FormattedMonthlyData {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

interface CompanyMonthlyData {
  month: string;
  income: number;
  expense: number;
}

function Analytics() {
  const [monthlyStats, setMonthlyStats] = useState<FormattedMonthlyData[]>([]);
  const [projects, setProjects] = useState<ProjectWithSummary[]>([]);
  const [companies, setCompanies] = useState<CompanyWithBalance[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [projectBreakdown, setProjectBreakdown] = useState<CategoryBreakdown[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyMonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (availableYears.length > 0) {
      loadMonthlyStats();
    }
  }, [selectedYear, availableYears]);

  useEffect(() => {
    if (selectedProject) loadProjectBreakdown();
  }, [selectedProject]);

  useEffect(() => {
    if (selectedCompany && selectedYear !== 'all') {
      loadCompanyStats();
    } else if (selectedCompany && selectedYear === 'all') {
      setCompanyStats([]);
    }
  }, [selectedCompany, selectedYear]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [projectsData, companiesData, transactionsData] = await Promise.all([
        window.electronAPI.project.getWithSummary(),
        window.electronAPI.company.getWithBalance(),
        window.electronAPI.transaction.getAll({}),
      ]);
      setProjects(projectsData);
      setCompanies(companiesData);

      // Extract unique years from transactions
      const years = [
        ...new Set(transactionsData.map((t: { date: string }) => new Date(t.date).getFullYear())),
      ].sort((a, b) => b - a) as number[];
      setAvailableYears(years);

      // Set default to current year if exists, otherwise 'all'
      const currentYear = new Date().getFullYear();
      if (years.includes(currentYear)) {
        setSelectedYear(currentYear);
      } else if (years.length > 0) {
        setSelectedYear(years[0]);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyStats = async () => {
    try {
      if (selectedYear === 'all') {
        // Aggregate all years
        const allData: MonthlyStats[] = [];
        for (const year of availableYears) {
          const data = await window.electronAPI.analytics.getMonthlyStats(year);
          data.forEach((d: MonthlyStats) => {
            const existing = allData.find((a) => a.month === d.month);
            if (existing) {
              existing.income += d.income || 0;
              existing.expense += d.expense || 0;
              existing.collected += d.collected || 0;
              existing.paid += d.paid || 0;
            } else {
              allData.push({
                month: d.month,
                income: d.income || 0,
                expense: d.expense || 0,
                collected: d.collected || 0,
                paid: d.paid || 0,
              });
            }
          });
        }
        const formattedData = MONTHS.map((month) => {
          const found = allData.find((d) => d.month === month.value);
          return {
            month: month.label.slice(0, 3),
            income: found?.income || 0,
            expense: found?.expense || 0,
            profit: (found?.income || 0) - (found?.expense || 0),
          };
        });
        setMonthlyStats(formattedData);
      } else {
        const data = await window.electronAPI.analytics.getMonthlyStats(selectedYear);
        const formattedData = MONTHS.map((month) => {
          const found = data.find((d: MonthlyStats) => d.month === month.value);
          return {
            month: month.label.slice(0, 3),
            income: found?.income || 0,
            expense: found?.expense || 0,
            profit: (found?.income || 0) - (found?.expense || 0),
          };
        });
        setMonthlyStats(formattedData);
      }
    } catch (error) {
      console.error('Monthly stats error:', error);
    }
  };

  const loadProjectBreakdown = async () => {
    try {
      const projectId =
        typeof selectedProject === 'string' ? parseInt(selectedProject, 10) : selectedProject;
      const data = await window.electronAPI.analytics.getProjectCategoryBreakdown(projectId);
      // Sort by total descending and take top 8, group rest as "Diger"
      const sorted = [...data].sort(
        (a: CategoryBreakdown, b: CategoryBreakdown) => b.total - a.total
      );
      if (sorted.length > 8) {
        const top7 = sorted.slice(0, 7);
        const others = sorted.slice(7);
        const otherTotal = others.reduce(
          (sum: number, item: CategoryBreakdown) => sum + item.total,
          0
        );
        top7.push({ category: 'Diğer', total: otherTotal, color: '#94a3b8' });
        setProjectBreakdown(top7);
      } else {
        setProjectBreakdown(sorted);
      }
    } catch (error) {
      console.error('Project breakdown error:', error);
    }
  };

  const loadCompanyStats = async () => {
    try {
      const companyId =
        typeof selectedCompany === 'string' ? parseInt(selectedCompany, 10) : selectedCompany;
      const yearParam = selectedYear === 'all' ? new Date().getFullYear() : selectedYear;
      const data = await window.electronAPI.analytics.getCompanyMonthlyStats(companyId, yearParam);
      const formattedData = MONTHS.map((month) => {
        const found = data.find((d: MonthlyStats) => d.month === month.value);
        return {
          month: month.label.slice(0, 3),
          income: found?.income || 0,
          expense: found?.expense || 0,
        };
      });
      setCompanyStats(formattedData);
    } catch (error) {
      console.error('Company stats error:', error);
    }
  };

  const totalIncome = monthlyStats.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = monthlyStats.reduce((sum, m) => sum + m.expense, 0);

  const yearOptions = [
    { value: 'all', label: 'Tüm Zamanlar' },
    ...availableYears.map((y) => ({ value: y, label: y.toString() })),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center page-container">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analizler & Raporlar</h1>
          <p className="mt-1 text-sm text-gray-500">Finansal analiz ve grafikler</p>
        </div>
        <Select
          options={yearOptions}
          value={String(selectedYear)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
          }
          className="w-36"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
        <Card className="p-4 sm:p-6">
          <p className="mb-1 text-xs text-gray-500 sm:text-sm">
            {selectedYear === 'all' ? 'Toplam Gelir' : 'Yıllık Toplam Gelir'}
          </p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {formatCompactCurrency(totalIncome)}
          </p>
        </Card>
        <Card className="p-4 sm:p-6">
          <p className="mb-1 text-xs text-gray-500 sm:text-sm">
            {selectedYear === 'all' ? 'Toplam Gider' : 'Yıllık Toplam Gider'}
          </p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCompactCurrency(totalExpense)}
          </p>
        </Card>
        <Card className="p-4 sm:p-6">
          <p className="mb-1 text-xs text-gray-500 sm:text-sm">
            {selectedYear === 'all' ? 'Net Kâr/Zarar' : 'Yıllık Net Kâr/Zarar'}
          </p>
          <p
            className={`text-xl sm:text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCompactCurrency(totalIncome - totalExpense)}
          </p>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 mb-6 xl:grid-cols-2">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold sm:text-base">Aylık Gelir-Gider Trendi</h3>
          </CardHeader>
          <CardBody className="p-2 sm:p-6">
            {monthlyStats.every((m) => m.income === 0 && m.expense === 0) ? (
              <EmptyState icon={FiBarChart2} title="Veri bulunamadı" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyStats} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => formatCompactCurrency(v, true)}
                    width={60}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Gelir"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Gider"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Monthly Bar Chart */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold sm:text-base">Aylık Kar/Zarar</h3>
          </CardHeader>
          <CardBody className="p-2 sm:p-6">
            {monthlyStats.every((m) => m.profit === 0) ? (
              <EmptyState icon={FiBarChart2} title="Veri bulunamadı" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyStats} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => formatCompactCurrency(v, true)}
                    width={60}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="profit" name="Kar/Zarar" radius={[4, 4, 0, 0]}>
                    {monthlyStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Project Analysis */}
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold sm:text-base">Proje Gider Dağılımı</h3>
            <Select
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={selectedProject}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedProject(e.target.value)
              }
              placeholder="Proje seçin"
              className="w-full sm:w-48"
            />
          </CardHeader>
          <CardBody className="p-2 sm:p-6">
            {!selectedProject ? (
              <EmptyState
                icon={FiBarChart2}
                title="Proje seçin"
                description="Analiz için bir proje seçin"
              />
            ) : projectBreakdown.length === 0 ? (
              <EmptyState icon={FiBarChart2} title="Gider bulunamadı" />
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={projectBreakdown}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {projectBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="flex flex-wrap justify-center px-2 mt-2 gap-x-3 gap-y-1">
                  {projectBreakdown.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-600 truncate max-w-[100px]" title={entry.category}>
                        {entry.category}
                      </span>
                      <span className="text-gray-400">
                        {(
                          (entry.total / projectBreakdown.reduce((s, e) => s + e.total, 0)) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Company Analysis */}
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold sm:text-base">Cari Hareket Analizi</h3>
            <Select
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              value={selectedCompany}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedCompany(e.target.value)
              }
              placeholder="Cari seçin"
              className="w-full sm:w-48"
            />
          </CardHeader>
          <CardBody className="p-2 sm:p-6">
            {!selectedCompany ? (
              <EmptyState
                icon={FiBarChart2}
                title="Cari seçin"
                description="Analiz için bir cari hesap seçin"
              />
            ) : selectedYear === 'all' ? (
              <EmptyState
                icon={FiBarChart2}
                title="Yıl seçin"
                description="Cari analizi için bir yıl seçin"
              />
            ) : companyStats.every((m) => m.income === 0 && m.expense === 0) ? (
              <EmptyState icon={FiBarChart2} title="Hareket bulunamadı" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={companyStats} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => formatCompactCurrency(v, true)}
                    width={60}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="income" name="Gelir" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default Analytics;
