import React from 'react';
import { FiAlertTriangle, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Modal } from './Modal';
import { Button } from './Button';

type ConfirmDialogType = 'danger' | 'warning' | 'success';
type ButtonVariant = 'danger' | 'warning' | 'success';

interface ConfirmDialogConfig {
  icon: IconType;
  iconBg: string;
  iconColor: string;
  confirmVariant: ButtonVariant;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: ConfirmDialogType;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

const types: Record<ConfirmDialogType, ConfirmDialogConfig> = {
  danger: {
    icon: FiAlertTriangle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmVariant: 'danger',
  },
  warning: {
    icon: FiAlertCircle,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    confirmVariant: 'warning',
  },
  success: {
    icon: FiCheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    confirmVariant: 'success',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'danger',
  confirmText = 'Onayla',
  cancelText = 'İptal',
  loading = false,
}: ConfirmDialogProps) {
  const config = types[type];
  const Icon = config.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center p-6">
        <div
          className={`mx-auto w-14 h-14 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}
        >
          <Icon className={`w-7 h-7 ${config.iconColor}`} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={config.confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
