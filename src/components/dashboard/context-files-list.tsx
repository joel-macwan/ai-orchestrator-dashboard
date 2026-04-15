import { useCallback } from 'react';
import { FileText } from 'lucide-react';
import { formatKb } from '@/lib/format';
import type {
  ContextFileTileProps,
  ContextFilesListProps,
} from '@/lib/types';

function ContextFileTile({ file, onSelect }: ContextFileTileProps) {
  const handleClick = useCallback(() => {
    onSelect(file);
  }, [file, onSelect]);

  return (
    <button
      onClick={handleClick}
      title={file.relativePath}
      className="flex flex-col items-center justify-start gap-2 w-36 shrink-0 p-3 rounded-md border border-border bg-muted/30 hover:bg-accent/50 transition-colors"
    >
      <FileText className="h-8 w-8 text-muted-foreground" />
      <span className="font-mono text-xs text-center truncate w-full leading-tight">
        {file.name}
      </span>
      <span className="text-[10px] text-muted-foreground font-mono">
        {formatKb(file.sizeBytes)}
      </span>
    </button>
  );
}

export function ContextFilesList({ files, onSelect }: ContextFilesListProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {files.map((file) => (
        <ContextFileTile
          key={file.relativePath}
          file={file}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
