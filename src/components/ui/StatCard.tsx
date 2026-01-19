import React, { ReactNode, memo } from 'react';
import type { IconType } from 'react-icons';

type StatCardColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange';

interface StatCardProps {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: IconType;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: StatCardColor;
  className?: string;
  highlighted?: boolean;
}

interface ColorSet {
  bg: string;
  icon: string;
  text: string;
}

const colors: Record<StatCardColor, ColorSet> = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-100 text-red-600',
    text: 'text-red-600',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'bg-yellow-100 text-yellow-600',
    text: 'text-yellow-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-600',
  },
  gray: {
    bg: 'bg-gray-50',
    icon: 'bg-gray-100 text-gray-600',
    text: 'text-gray-600',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-600',
  },
};

const highlightedColors: Record<
  StatCardColor,
  { bg: string; border: string; title: string; value: string; subtitle: string }
> = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    title: 'text-green-700',
    value: 'text-green-700',
    subtitle: 'text-green-600',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'text-red-700',
    value: 'text-red-700',
    subtitle: 'text-red-600',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    title: 'text-blue-700',
    value: 'text-blue-700',
    subtitle: 'text-blue-600',
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    title: 'text-yellow-700',
    value: 'text-yellow-700',
    subtitle: 'text-yellow-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    title: 'text-purple-700',
    value: 'text-purple-700',
    subtitle: 'text-purple-600',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    title: 'text-gray-700',
    value: 'text-gray-700',
    subtitle: 'text-gray-600',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    title: 'text-orange-700',
    value: 'text-orange-700',
    subtitle: 'text-orange-600',
  },
};

export const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  className = '',
  highlighted = false,
}: StatCardProps) {
  const colorSet = colors[color] || colors.blue;
  const highlightSet = highlightedColors[color] || highlightedColors.blue;

  const cardBg = highlighted
    ? `${highlightSet.bg} ${highlightSet.border}`
    : 'bg-white border-gray-100';
  const titleColor = highlighted ? highlightSet.title : 'text-gray-500';
  const valueColor = highlighted ? highlightSet.value : 'text-gray-900';
  const subtitleColor = highlighted ? highlightSet.subtitle : 'text-gray-500';

  return (
    <div
      className={`rounded-xl shadow-sm border p-4 sm:p-6 overflow-hidden ${cardBg} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-medium truncate ${titleColor}`}>{title}</p>
          <p
            className={`mt-1 sm:mt-2 text-base sm:text-xl lg:text-2xl font-bold break-words leading-tight ${valueColor}`}
          >
            {value}
          </p>
          {subtitle && (
            <p className={`mt-1 text-xs sm:text-sm truncate ${subtitleColor}`}>{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-xs sm:text-sm font-medium ${
                  trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend === 'up' ? '↑' : '↓'} {trendValue}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${colorSet.icon}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
    </div>
  );
});
