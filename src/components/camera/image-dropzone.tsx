"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, ImagePlus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  image: string | null;
  imageName: string;
  onImage: (dataUrl: string | null, name?: string) => void;
  disabled?: boolean;
}

export function ImageDropzone({ image, imageName, onImage, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError("Format harus JPG, PNG, atau WebP.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Ukuran gambar maksimal 8 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          onImage(result, file.name);
        }
      };
      reader.onerror = () => setError("Gagal membaca file.");
      reader.readAsDataURL(file);
    },
    [onImage]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset value so re-uploading same file works
          e.target.value = "";
        }}
      />

      {!image ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "group relative w-full rounded-xl border-2 border-dashed transition-all duration-200",
            "aspect-[4/3] flex flex-col items-center justify-center gap-3 p-6",
            "hover:border-primary/60 hover:bg-primary/5",
            dragOver
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-white/15 bg-white/[0.02]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
              "bg-primary/10 text-primary group-hover:bg-primary/20"
            )}
          >
            <ImagePlus className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Klik atau drag &amp; drop foto di sini
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG / PNG / WebP · maks 8 MB
            </p>
          </div>
        </button>
      ) : (
        <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <img
            src={image}
            alt={imageName || "Source image"}
            className="w-full max-h-[320px] object-contain"
          />
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[10px] text-white/90 truncate max-w-[70%]">
              <Upload className="h-3 w-3 shrink-0" />
              <span className="truncate">{imageName || "image"}</span>
            </span>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                onImage(null);
                setError(null);
              }}
              className="h-7 w-7 rounded-md bg-black/60 backdrop-blur hover:bg-black/80 border border-white/10"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
