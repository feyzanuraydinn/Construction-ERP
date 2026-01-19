import React, { useEffect, ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
}

interface ModalHeaderProps {
  children: ReactNode;
  onClose?: () => void;
}

interface ModalSectionProps {
  children: ReactNode;
  className?: string;
}

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={`
          relative bg-white rounded-xl shadow-2xl w-full ${sizes[size]}
          max-h-[90vh] flex flex-col fade-in overflow-hidden
        `}
      >
        {/* Header - if title provided */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
        )}

        {/* Children - compound components or plain content */}
        {children}

        {/* Footer - if provided as prop */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function ModalHeader({ children, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FiX size={20} />
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = '' }: ModalSectionProps) {
  return <div className={`flex-1 min-h-0 overflow-y-auto px-6 py-5 ${className}`}>{children}</div>;
}

export function ModalFooter({ children, className = '' }: ModalSectionProps) {
  return (
    <div
      className={`px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3 flex-shrink-0 ${className}`}
    >
      {children}
    </div>
  );
}
