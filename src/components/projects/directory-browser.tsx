import { useState, useEffect, useCallback } from 'react';
import { Folder, ArrowUp, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { browseDirectory } from '@/lib/api';
import type { DirectoryListing, DirectoryBrowserProps } from '@/lib/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENTER_KEY = 'Enter';

// ─── Directory Browser ─────────────────────────────────────────────────────

export function DirectoryBrowser({ open, onClose, onSelect }: DirectoryBrowserProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');

  const hasListing = listing !== null;
  const hasEntries = listing?.entries && listing.entries.length > 0;

  /** Fetch directory contents for the given path. */
  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseDirectory(dirPath);
      setListing(result);
      setPathInput(result.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Browse the root directory when the dialog opens
  useEffect(() => {
    if (open) {
      browse();
    }
  }, [open, browse]);

  const handleNavigate = useCallback((dirPath: string) => {
    browse(dirPath);
  }, [browse]);

  const handleGoUp = useCallback(() => {
    if (listing) {
      browse(listing.parent);
    }
  }, [listing, browse]);

  const handlePathSubmit = useCallback(() => {
    if (pathInput) {
      browse(pathInput);
    }
  }, [pathInput, browse]);

  const handlePathKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ENTER_KEY) {
      handlePathSubmit();
    }
  }, [handlePathSubmit]);

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPathInput(e.target.value);
  }, []);

  const handleSelect = useCallback(() => {
    if (listing) {
      onSelect(listing.current);
    }
  }, [listing, onSelect]);

  const handleDialogChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Runs Directory</DialogTitle>
        </DialogHeader>

        {/* Path input with navigate-up button */}
        <div className="flex gap-2">
          <Input
            value={pathInput}
            onChange={handlePathChange}
            onKeyDown={handlePathKeyDown}
            placeholder="/path/to/runs"
            className="flex-1 font-mono text-xs"
          />
          <Button variant="outline" size="icon" onClick={handleGoUp} disabled={!hasListing}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Directory listing */}
        <ScrollArea className="h-72 rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ) : (
            <div className="p-1">
              {listing?.entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleNavigate(entry.path)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
              {!hasEntries && (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No subdirectories
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!hasListing}>
            <Check className="h-4 w-4 mr-2" />
            Select This Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
