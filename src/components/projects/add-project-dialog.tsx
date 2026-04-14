import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen } from 'lucide-react';
import { DirectoryBrowser } from './directory-browser';
import type { AddProjectDialogProps } from '@/lib/types';

// ─── Path separator used to extract the last folder name ───────────────────

const PATH_SEPARATOR = '/';

export function AddProjectDialog({ open, onClose, onAdd }: AddProjectDialogProps) {
  const [name, setName] = useState('');
  const [runsPath, setRunsPath] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);

  const isFormValid = name.length > 0 && runsPath.length > 0;

  const resetState = useCallback(() => {
    setName('');
    setRunsPath('');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  /** Auto-fill the project name from the selected folder path. */
  const handleBrowseSelect = useCallback((path: string) => {
    setRunsPath(path);
    setBrowserOpen(false);
    if (!name) {
      const folderName = path.split(PATH_SEPARATOR).filter(Boolean).pop() ?? '';
      setName(folderName);
    }
  }, [name]);

  const handleAdd = useCallback(() => {
    if (!isFormValid) return;
    onAdd(name, runsPath);
    resetState();
    onClose();
  }, [isFormValid, name, runsPath, onAdd, resetState, onClose]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleRunsPathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRunsPath(e.target.value);
  }, []);

  const openBrowser = useCallback(() => {
    setBrowserOpen(true);
  }, []);

  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
  }, []);

  const handleDialogChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    }
  }, [handleClose]);

  return (
    <>
      {/* Main add-project form dialog */}
      <Dialog open={open && !browserOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Project name field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={name}
                onChange={handleNameChange}
                placeholder="My Project"
              />
            </div>

            {/* Runs directory field with browse button */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Runs Directory</label>
              <div className="flex gap-2">
                <Input
                  value={runsPath}
                  onChange={handleRunsPathChange}
                  placeholder="/path/to/project/agent-loop/runs"
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={openBrowser}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!isFormValid}>
              Add Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Directory browser sub-dialog */}
      <DirectoryBrowser
        open={browserOpen}
        onClose={closeBrowser}
        onSelect={handleBrowseSelect}
      />
    </>
  );
}
