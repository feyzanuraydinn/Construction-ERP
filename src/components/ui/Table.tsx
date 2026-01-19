import React, { ReactNode, MouseEvent, memo } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLTableRowElement>) => void;
  hover?: boolean;
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLTableCellElement>) => void;
}

export const Table = memo(function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">{children}</table>
    </div>
  );
});

export const TableHeader = memo(function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>;
});

export const TableBody = memo(function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
});

export const TableRow = memo(function TableRow({
  children,
  className = '',
  onClick,
  hover = true,
}: TableRowProps) {
  return (
    <tr
      className={`
        ${hover ? 'hover:bg-gray-50 transition-colors' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </tr>
  );
});

export const TableHead = memo(function TableHead({ children, className = '' }: TableCellProps) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
});

export const TableCell = memo(function TableCell({
  children,
  className = '',
  onClick,
}: TableCellProps) {
  return (
    <td className={`px-4 py-3 text-sm text-gray-700 ${className}`} onClick={onClick}>
      {children}
    </td>
  );
});
