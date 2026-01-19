import type { Currency } from '../types';

export function formatCurrency(
  amount: number | null | undefined,
  currency: Currency = 'TRY'
): string {
  if (amount === null || amount === undefined) return '-';

  const formatter = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
}

// Compact currency format for large numbers (e.g., 1.5M, 250K)
export function formatCompactCurrency(
  amount: number | null | undefined,
  shortOnly: boolean = false
): string {
  if (amount === null || amount === undefined) return '-';

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1000000000) {
    const value = (absAmount / 1000000000).toFixed(1);
    return shortOnly ? `${sign}${value}B` : `${sign}${value}B ₺`;
  }
  if (absAmount >= 1000000) {
    const value = (absAmount / 1000000).toFixed(1);
    return shortOnly ? `${sign}${value}M` : `${sign}${value}M ₺`;
  }
  if (absAmount >= 1000) {
    const value = (absAmount / 1000).toFixed(0);
    return shortOnly ? `${sign}${value}K` : `${sign}${value}K ₺`;
  }

  return shortOnly ? `${sign}${absAmount.toFixed(0)}` : formatCurrency(amount);
}

export function formatNumber(number: number | null | undefined, decimals: number = 0): string {
  if (number === null || number === undefined) return '-';

  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

export function formatPercentage(value: number, total: number | null | undefined): string {
  if (!total || total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(0)}%`;
}

export function getBalanceColor(balance: number): string {
  if (balance > 0) return 'text-green-600';
  if (balance < 0) return 'text-red-600';
  return 'text-gray-600';
}

export function getBalanceText(balance: number): string {
  if (balance > 0) return 'Alacak';
  if (balance < 0) return 'Borç';
  return 'Dengede';
}
