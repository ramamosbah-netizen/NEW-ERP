import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  isNumeric?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  initialPageSize?: number;
  stickyFirstColumn?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyText = 'No records found',
  onRowClick,
  searchPlaceholder = 'Filter records...',
  searchKeys = [],
  initialPageSize = 10,
  stickyFirstColumn = false,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Sorting handler
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter & Search data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Filter by search term
    if (searchTerm.trim() !== '' && searchKeys.length > 0) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((key) => {
          const val = row[key];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(lowerSearch);
        })
      );
    }

    // Sort data
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        const aValue = a[key];
        const bValue = b[key];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (aStr < bStr) return direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, searchKeys, sortConfig]);

  // Paginated data
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Table Toolbar */}
      {searchKeys.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // reset to first page
              }}
              className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all duration-100 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--primary-glow)]"
            />
          </div>
          <div className="text-xs text-[var(--text-secondary)] font-medium">
            Showing {filteredData.length} records
          </div>
        </div>
      )}

      {/* Table body */}
      <div className="w-full overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm relative">
        <table className="w-full border-collapse text-left text-sm text-[var(--text-secondary)]">
          {/* Header */}
          <thead className="bg-[var(--bg-dark)] sticky top-0 z-20 border-b border-[var(--border-color)]">
            <tr>
              {columns.map((col, index) => {
                const isSticky = stickyFirstColumn && index === 0;
                const alignment = col.align || (col.isNumeric ? 'right' : 'left');

                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-4 py-3 font-semibold text-[var(--text-secondary)] font-heading select-none ${
                      col.sortable ? 'cursor-pointer hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]' : ''
                    } ${isSticky ? 'sticky left-0 bg-[var(--bg-dark)] z-10' : ''}`}
                    style={{ textAlign: alignment }}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        alignment === 'right' ? 'justify-end w-full' : ''
                      } ${alignment === 'center' ? 'justify-center w-full' : ''}`}
                    >
                      {col.header}
                      {col.sortable && (
                        <span className="text-[var(--text-muted)]">
                          {sortConfig?.key === col.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-[var(--border-color)]">
            {loading ? (
              // Loading Skeleton State
              Array.from({ length: pageSize }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="px-4 py-3">
                      <div className="h-4 bg-[var(--border-color)] rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                    <Inbox size={32} strokeWidth={1.5} />
                    <span className="text-sm font-semibold">{emptyText}</span>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              paginatedData.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors duration-100 ${
                    onRowClick ? 'cursor-pointer hover:bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card-hover)]/40'
                  }`}
                >
                  {columns.map((col, cIdx) => {
                    const isSticky = stickyFirstColumn && cIdx === 0;
                    const alignment = col.align || (col.isNumeric ? 'right' : 'left');

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 whitespace-nowrap ${
                          isSticky ? 'sticky left-0 bg-[var(--bg-card)] font-medium text-[var(--text-primary)] border-r border-[var(--border-color)] shadow-[2px_0_5px_rgba(0,0,0,0.05)]' : ''
                        } ${col.isNumeric ? 'font-mono' : ''}`}
                        style={{ textAlign: alignment }}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--border-color)] pt-3 mt-1">
          <div className="text-xs text-[var(--text-secondary)]">
            Page <span className="font-semibold text-[var(--text-primary)]">{currentPage}</span> of{' '}
            <span className="font-semibold text-[var(--text-primary)]">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              icon={ChevronLeft}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              icon={ChevronRight}
              iconPosition="right"
            />
          </div>
        </div>
      )}
    </div>
  );
}
