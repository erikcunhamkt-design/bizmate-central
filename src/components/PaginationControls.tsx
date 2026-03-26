import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ currentPage, totalItems, pageSize, onPageChange }: PaginationControlsProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
      <span className="text-xs text-muted-foreground">
        {start}–{end} de {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) {
            page = i + 1;
          } else if (currentPage <= 3) {
            page = i + 1;
          } else if (currentPage >= totalPages - 2) {
            page = totalPages - 4 + i;
          } else {
            page = currentPage - 2 + i;
          }
          return (
            <Button key={page} variant={page === currentPage ? "default" : "ghost"} size="icon"
              className={`h-8 w-8 text-xs ${page === currentPage ? "gradient-primary" : ""}`}
              onClick={() => onPageChange(page)}>
              {page}
            </Button>
          );
        })}
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
