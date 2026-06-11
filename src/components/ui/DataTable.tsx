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
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
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
              className="w-full bg-black/20 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all duration-150 focus:border-[#00E5A0] focus:ring-2 focus:ring-[#00E5A0]/20"
            />
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Showing {filteredData.length} records
          </div>
        </div>
      )}

      {/* Table body */}
      <div className="w-full overflow-x-auto rounded-xl border border-white/8 bg-[#0a0e24]/30 shadow-lg shadow-black/25 relative">
        <table className="w-full border-collapse text-left text-sm text-slate-300">
          {/* Header */}
          <thead className="bg-[#0b0f2a]/90 backdrop-blur sticky top-0 z-20 border-b border-white/8">
            <tr>
              {columns.map((col, index) => {
                const isSticky = stickyFirstColumn && index === 0;
                const alignment = col.align || (col.isNumeric ? 'right' : 'left');

                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-4 py-3 font-semibold text-slate-400 font-heading select-none ${
                      col.sortable ? 'cursor-pointer hover:bg-white/5 hover:text-white' : ''
                    } ${isSticky ? 'sticky left-0 bg-[#0b0f2a] z-10' : ''}`}
                    style={{ textAlign: alignment }}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        alignment === 'right' ? 'justify-end w-full' : ''
                      } ${alignment === 'center' ? 'justify-center w-full' : ''}`}
                    >
                      {col.header}
                      {col.sortable && (
                        <span className="text-slate-500">
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
          <tbody className="divide-y divide-white/4">
            {loading ? (
              // Loading Skeleton State
              Array.from({ length: pageSize }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="px-4 py-3">
                      <div className="h-4 bg-white/6 rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
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
                  className={`transition-colors duration-150 ${
                    onRowClick ? 'cursor-pointer hover:bg-white/4' : 'hover:bg-white/1.5'
                  }`}
                >
                  {columns.map((col, cIdx) => {
                    const isSticky = stickyFirstColumn && cIdx === 0;
                    const alignment = col.align || (col.isNumeric ? 'right' : 'left');

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 whitespace-nowrap ${
                          isSticky ? 'sticky left-0 bg-[#0c102a] font-medium text-white shadow-[2px_0_5px_rgba(0,0,0,0.3)]' : ''
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
        <div className="flex items-center justify-between gap-4 border-t border-white/6 pt-3 mt-1">
          <div className="text-xs text-slate-400">
            Page <span className="font-semibold text-white">{currentPage}</span> of{' '}
            <span className="font-semibold text-white">{totalPages}</span>
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
