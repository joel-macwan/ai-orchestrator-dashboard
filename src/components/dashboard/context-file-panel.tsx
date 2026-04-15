import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import { isMarkdownFile } from '@/lib/format';
import type { ContextFilePanelProps } from '@/lib/types';

export function ContextFilePanel({ file, content, loading, onClose }: ContextFilePanelProps) {
  const renderMarkdown = isMarkdownFile(file.name);

  return (
    <div className="flex h-full flex-col border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{file.name}</h3>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {file.relativePath}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        {loading && content === null ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">Loading file...</span>
          </div>
        ) : content === null ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">File not available</span>
          </div>
        ) : renderMarkdown ? (
          <div className="px-4 py-3">
            <MarkdownViewer content={content} />
          </div>
        ) : (
          <pre className="px-4 py-3 text-xs font-mono whitespace-pre-wrap wrap-break-word">
            {content}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}
