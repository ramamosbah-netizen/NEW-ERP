import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TanstackDataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: TData) => void;
  searchPlaceholder?: string;
  searchColumnId?: string;
  initialPageSize?: number;
  stickyFirstColumn?: boolean;
}

export function TanstackDataTable<TData>({
  columns,
  data,
  loading = false,
  emptyText = 'No records found',
  onRowClick,
  searchPlaceholder = 'Filter records...',
  searchColumnId,
  initialPageSize = 10,
  stickyFirstColumn = false,
}: TanstackDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
  });

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Table Toolbar */}
      {searchColumnId && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all duration-100 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--primary-glow)]"
            />
          </div>
          <div className="text-xs text-[var(--text-secondary)] font-medium">
            Showing {table.getFilteredRowModel().rows.length} records
          </div>
        </div>
      )}

      {/* Table Body Container */}
      <div className="w-full overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm relative">
        <table className="w-full border-collapse text-left text-sm text-[var(--text-secondary)]">
          {/* Header */}
          <thead className="bg-[var(--bg-dark)] sticky top-0 z-20 border-b border-[var(--border-color)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isSticky = stickyFirstColumn && index === 0;
                  const isSortable = header.column.getCanSort();
                  const sortedState = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-4 py-3 font-semibold text-[var(--text-secondary)] font-heading select-none ${
                        isSortable ? 'cursor-pointer hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]' : ''
                      } ${isSticky ? 'sticky left-0 bg-[var(--bg-dark)] z-10' : ''}`}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {isSortable && (
                          <span className="text-[var(--text-muted)]">
                            {sortedState === 'asc' ? (
                              <ArrowUp size={12} />
                            ) : sortedState === 'desc' ? (
                              <ArrowDown size={12} />
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
            ))}
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-[var(--border-color)]">
            {loading ? (
              // Loading Skeleton
              Array.from({ length: table.getState().pagination.pageSize }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-4 py-3">
                      <div className="h-4 bg-[var(--border-color)] rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty State
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
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={`transition-colors duration-100 ${
                    onRowClick ? 'cursor-pointer hover:bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card-hover)]/40'
                  }`}
                >
                  {row.getVisibleCells().map((cell, cIdx) => {
                    const isSticky = stickyFirstColumn && cIdx === 0;

                    return (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 whitespace-nowrap ${
                          isSticky ? 'sticky left-0 bg-[var(--bg-card)] font-medium text-[var(--text-primary)] border-r border-[var(--border-color)] shadow-[2px_0_5px_rgba(0,0,0,0.05)]' : ''
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!loading && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--border-color)] pt-3 mt-1">
          <div className="text-xs text-[var(--text-secondary)]">
            Page{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {table.getState().pagination.pageIndex + 1}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {table.getPageCount()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              icon={ChevronLeft}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              icon={ChevronRight}
              iconPosition="right"
            />
          </div>
        </div>
      )}
    </div>
  );
}
