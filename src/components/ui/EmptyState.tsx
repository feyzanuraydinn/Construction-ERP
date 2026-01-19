import React from 'react';
import { FiInbox } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: IconType;
  title?: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
  actionIcon?: IconType;
}

export function EmptyState({
  icon: Icon = FiInbox,
  title = 'Veri bulunamadı',
  description,
  action,
  actionLabel,
  actionIcon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{description}</p>
      )}
      {action && actionLabel && (
        <Button onClick={action} icon={actionIcon}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
