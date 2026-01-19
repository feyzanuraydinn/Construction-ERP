import React, { ReactNode, memo } from 'react';
import type { ProjectStatus, CompanyType, AccountType } from '../../types';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'purple' | 'default';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
  default: 'bg-gray-100 text-gray-800',
};

export const Badge = memo(function Badge({
  children,
  variant = 'gray',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
});

interface StatusBadgeProps {
  status: ProjectStatus;
}

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<ProjectStatus, { label: string; variant: BadgeVariant }> = {
    planned: { label: 'Planlanan', variant: 'warning' },
    active: { label: 'Devam Eden', variant: 'success' },
    completed: { label: 'Tamamlandı', variant: 'info' },
    cancelled: { label: 'İptal', variant: 'danger' },
  };

  const config = statusConfig[status] || { label: status, variant: 'gray' as BadgeVariant };

  return <Badge variant={config.variant}>{config.label}</Badge>;
});

interface TypeBadgeProps {
  type: CompanyType;
}

export const TypeBadge = memo(function TypeBadge({ type }: TypeBadgeProps) {
  const typeConfig: Record<CompanyType, { label: string; variant: BadgeVariant; icon: string }> = {
    person: { label: 'Şahıs', variant: 'info', icon: '👤' },
    company: { label: 'Kuruluş', variant: 'purple', icon: '🏢' },
  };

  const config = typeConfig[type] || { label: type, variant: 'gray' as BadgeVariant, icon: '' };

  return (
    <Badge variant={config.variant}>
      {config.icon} {config.label}
    </Badge>
  );
});

interface AccountTypeBadgeProps {
  accountType: AccountType;
}

export const AccountTypeBadge = memo(function AccountTypeBadge({
  accountType,
}: AccountTypeBadgeProps) {
  const typeConfig: Record<AccountType, { label: string; variant: BadgeVariant }> = {
    customer: { label: 'Müşteri', variant: 'success' },
    supplier: { label: 'Tedarikçi', variant: 'info' },
    subcontractor: { label: 'Taşeron', variant: 'purple' },
    investor: { label: 'Yatırımcı', variant: 'warning' },
  };

  const config = typeConfig[accountType] || { label: accountType, variant: 'gray' as BadgeVariant };

  return <Badge variant={config.variant}>{config.label}</Badge>;
});

interface BalanceBadgeProps {
  amount: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BalanceBadge = memo(function BalanceBadge({
  amount,
  showIcon = true,
  size = 'md',
}: BalanceBadgeProps) {
  const isPositive = amount > 0;
  const isNegative = amount < 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base font-semibold',
  };

  const bgClasses = isPositive
    ? 'bg-green-100 text-green-800 border border-green-200'
    : isNegative
      ? 'bg-red-100 text-red-800 border border-red-200'
      : 'bg-gray-100 text-gray-800 border border-gray-200';

  const icon = isPositive ? '↑' : isNegative ? '↓' : '•';

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-lg font-medium whitespace-nowrap
        ${sizeClasses[size]}
        ${bgClasses}
      `}
    >
      {showIcon && <span>{icon}</span>}
      {isNegative ? '-' : isPositive ? '+' : ''}
      {formatCurrency(amount)}
    </span>
  );
});
