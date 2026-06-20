"use client";

import { useState, useCallback } from "react";
import {
  Trash2,
  Download,
  History,
  Clock,
  CheckSquare,
  Square,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { GeneratedItem } from "@/store/app-store";
import { describeCameraShort } from "@/lib/camera";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  history: GeneratedItem[];
  onSelect: (item: GeneratedItem) => void;
  onRemove: (id: string) => void;
  onRemoveMany: (ids: string[]) => void;
  onClear: () => void;
  activeId?: string;
}

export function HistoryGallery({
  history,
  onSelect,
  onRemove,
  onRemoveMany,
  onClear,
  activeId,
}: Props) {
  const [zoomItem, setZoomItem] = useState<GeneratedItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(history.map((h) => h.id)));
  }, [history]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    onRemoveMany(Array.from(selectedIds));
    toast.success(`Deleted ${count} ${count === 1 ? "image" : "images"}`);
    exitSelectMode();
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-10 text-center">
        <History className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No history yet</p>
        <p className="text-xs text-muted-foreground/70">
          Generated views will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">
            History
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({history.length}
              {selectMode && selectedIds.size > 0 && (
                <span className="text-primary">
                  {" · "}
                  {selectedIds.size} selected
                </span>
              )}
              )
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Select mode toggle / actions */}
          {!selectMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectMode(true)}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Clear all history?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {history.length} generated views.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onClear}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              {/* Select mode toolbar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={selectedIds.size === history.length}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectNone}
                disabled={selectedIds.size === 0}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Square className="h-3.5 w-3.5" />
                None
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedIds.size === 0}
                    className="h-7 gap-1 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                    {selectedIds.size > 0 && (
                      <span className="ml-0.5 rounded bg-destructive-foreground/20 px-1">
                        {selectedIds.size}
                      </span>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedIds.size}{" "}
                      {selectedIds.size === 1 ? "image" : "images"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the{" "}
                      {selectedIds.size === 1 ? "image" : "selected images"}{" "}
                      from your history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteSelected}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete {selectedIds.size}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="ghost"
                size="sm"
                onClick={exitSelectMode}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Exit select mode"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 max-h-[420px] overflow-y-auto pr-1 -mr-1">
        {history.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const isActive = activeId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border bg-black/40",
                "transition-all",
                selectMode
                  ? "cursor-pointer"
                  : "hover:scale-[1.02] cursor-pointer",
                isSelected
                  ? "border-primary ring-2 ring-primary/60"
                  : isActive
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-white/10 hover:border-primary/50"
              )}
              onClick={
                selectMode
                  ? () => toggleSelect(item.id)
                  : () => onSelect(item)
              }
            >
              <img
                src={item.image}
                alt={`Generated view ${describeCameraShort(item.params)}`}
                className="w-full h-full object-cover pointer-events-none"
                loading="lazy"
              />

              {/* Caption on hover (non-select mode) */}
              {!selectMode && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="font-mono text-[9px] text-white/90 leading-tight">
                    {describeCameraShort(item.params)}
                  </p>
                </div>
              )}

              {/* Selection checkbox (select mode) */}
              {selectMode && (
                <div className="absolute top-1 left-1">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md backdrop-blur border-2 transition-colors",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-black/70 border-white/40 text-transparent"
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                </div>
              )}

              {/* Active indicator (non-select mode) */}
              {!selectMode && isActive && (
                <div className="absolute top-1 left-1 flex h-2 w-2 rounded-full bg-primary shadow-glow" />
              )}

              {/* Hover action buttons (only in non-select mode) */}
              {!selectMode && (
                <>
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <a
                      href={item.image}
                      download={`multi-angle-${item.id}.png`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white/90 backdrop-blur hover:bg-black/90"
                      aria-label="Download"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white/90 backdrop-blur hover:bg-destructive/80"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomItem(item);
                    }}
                    className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white/90 backdrop-blur opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/90"
                    aria-label="Zoom"
                  >
                    <History className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Hint when in select mode */}
      {selectMode && (
        <p className="text-[11px] text-muted-foreground text-center">
          Tap images to select. {selectedIds.size > 0 && `${selectedIds.size} selected.`}{" "}
          Long-press also works on touch devices.
        </p>
      )}

      {/* Zoom dialog */}
      <Dialog open={!!zoomItem} onOpenChange={(o) => !o && setZoomItem(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 border-white/10 bg-black/80">
          <DialogTitle className="sr-only">History view</DialogTitle>
          <DialogDescription className="sr-only">
            {zoomItem ? describeCameraShort(zoomItem.params) : ""}
          </DialogDescription>
          {zoomItem && (
            <img
              src={zoomItem.image}
              alt={`Generated view ${describeCameraShort(zoomItem.params)}`}
              className="w-full h-full max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
