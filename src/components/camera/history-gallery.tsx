"use client";

import { useState } from "react";
import { Trash2, Download, History, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

interface Props {
  history: GeneratedItem[];
  onSelect: (item: GeneratedItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  activeId?: string;
}

export function HistoryGallery({
  history,
  onSelect,
  onRemove,
  onClear,
  activeId,
}: Props) {
  const [zoomItem, setZoomItem] = useState<GeneratedItem | null>(null);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">
            History
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({history.length})
            </span>
          </h3>
        </div>
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
              <AlertDialogTitle>Clear all history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {history.length} generated views. This action cannot be undone.
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
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 max-h-[420px] overflow-y-auto pr-1 -mr-1">
        {history.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-lg border bg-black/40",
              "transition-all hover:scale-[1.02]",
              activeId === item.id
                ? "border-primary ring-2 ring-primary/30"
                : "border-white/10 hover:border-primary/50"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="absolute inset-0 w-full h-full"
              aria-label={`View ${describeCameraShort(item.params)}`}
            >
              <img
                src={item.image}
                alt={`Generated view ${describeCameraShort(item.params)}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="font-mono text-[9px] text-white/90 leading-tight">
                {describeCameraShort(item.params)}
              </p>
            </div>

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
              className="absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white/90 backdrop-blur opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/90"
              aria-label="Zoom"
            >
              <History className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

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
