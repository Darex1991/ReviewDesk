import { useCallback, useRef, useState, type DragEvent } from "react";
import { FileArchive, FileCode2, Upload, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ACCEPTED_EXTENSIONS, formatBytes } from "../review.utils";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function UploadDropzone({
  files,
  onChange,
  disabled
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return;
      const next = [...files];
      let rejected: string | null = null;

      for (const file of Array.from(incoming)) {
        if (file.size > MAX_FILE_BYTES) {
          rejected = `${file.name} is larger than ${formatBytes(MAX_FILE_BYTES)}`;
          continue;
        }
        if (
          next.some(
            (existing) => existing.name === file.name && existing.size === file.size
          )
        ) {
          continue;
        }
        if (next.length >= MAX_FILES) {
          rejected = `You can upload at most ${MAX_FILES} files at once`;
          break;
        }
        next.push(file);
      }

      setError(rejected);
      onChange(next);
    },
    [files, onChange]
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    addFiles(event.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !disabled) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-muted/40",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Drop a ZIP of your repository or individual source files here
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse · up to {MAX_FILES} files, {formatBytes(MAX_FILE_BYTES)}{" "}
            each · node_modules, build output and binaries are skipped automatically
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {files.length} file{files.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(totalSize)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border">
            {files.map((file, index) => {
              const isZip = /\.zip$/i.test(file.name);
              const Icon = isZip ? FileArchive : FileCode2;
              return (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${file.name}`}
                    disabled={disabled}
                    onClick={() => removeFile(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
