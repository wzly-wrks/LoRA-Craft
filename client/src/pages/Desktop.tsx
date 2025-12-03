import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { ImageGrid } from "@/components/ImageGrid";
import { DetailPanel } from "@/components/DetailPanel";
import { DatasetToolbar } from "@/components/DatasetToolbar";
import { useWorkspaces, useCreateWorkspace } from "@/hooks/useWorkspaces";
import { useDatasets, useCreateDataset } from "@/hooks/useDatasets";
import { useImages, useImage } from "@/hooks/useImages";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dataset } from "@shared/schema";

type ModalType = "workspace" | "dataset" | null;

export const Desktop = (): JSX.Element => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>();
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(180, e.clientX), 400);
      setSidebarWidth(newWidth);
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const { data: workspaces = [], isLoading: workspacesLoading } = useWorkspaces();
  const { data: currentWorkspaceDatasets = [] } = useDatasets(selectedWorkspaceId);
  const { data: images = [], isLoading: imagesLoading, refetch: refetchImages } = useImages(selectedDatasetId);
  const { data: selectedImage } = useImage(selectedImageId);

  const createWorkspace = useCreateWorkspace();
  const createDataset = useCreateDataset();

  const datasetsMap = useMemo(() => {
    const map = new Map<string, Dataset[]>();
    if (selectedWorkspaceId && currentWorkspaceDatasets.length > 0) {
      map.set(selectedWorkspaceId, currentWorkspaceDatasets);
    }
    return map;
  }, [selectedWorkspaceId, currentWorkspaceDatasets]);

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (currentWorkspaceDatasets.length > 0 && !selectedDatasetId) {
      setSelectedDatasetId(currentWorkspaceDatasets[0].id);
    }
  }, [currentWorkspaceDatasets, selectedDatasetId]);

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter((img) => {
      if (img.originalFilename?.toLowerCase().includes(query)) return true;
      if (img.caption?.toLowerCase().includes(query)) return true;
      if (img.tags?.some((tag) => tag.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [images, searchQuery]);

  const handleSelectWorkspace = (id: string) => {
    setSelectedWorkspaceId(id);
    setSelectedDatasetId(undefined);
    setSelectedImageId(undefined);
  };

  const handleSelectDataset = (workspaceId: string, datasetId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedDatasetId(datasetId);
    setSelectedImageId(undefined);
  };

  const handleSelectImage = (id: string) => {
    setSelectedImageId(id);
  };

  const handleNewConcept = () => {
    setModalType("workspace");
    setFormName("");
    setFormDescription("");
  };

  const handleCloseModal = () => {
    setModalType(null);
    setFormName("");
    setFormDescription("");
  };

  const handleCreateWorkspace = async () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      const workspace = await createWorkspace.mutateAsync({
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
      setSelectedWorkspaceId(workspace.id);
      handleCloseModal();
      setModalType("dataset");
      setFormName("");
      setFormDescription("");
      toast({ title: "Concept created successfully" });
    } catch {
      toast({ title: "Failed to create concept", variant: "destructive" });
    }
  };

  const handleCreateDataset = async () => {
    if (!formName.trim() || !selectedWorkspaceId) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      const dataset = await createDataset.mutateAsync({
        workspaceId: selectedWorkspaceId,
        data: {
          name: formName.trim(),
          description: formDescription.trim() || null,
        },
      });
      setSelectedDatasetId(dataset.id);
      handleCloseModal();
      toast({ title: "Dataset created successfully" });
    } catch {
      toast({ title: "Failed to create dataset", variant: "destructive" });
    }
  };

  const handleCloseDetailPanel = () => {
    setSelectedImageId(undefined);
  };

  const handleImageDeleted = () => {
    setSelectedImageId(undefined);
    refetchImages();
  };

  return (
    <div className="w-full min-h-screen flex flex-col surface-0">
      <TitleBar />
      
      <div className="flex flex-1 overflow-hidden relative">
        <div 
          className="relative flex-shrink-0"
          style={{ width: sidebarWidth }}
        >
          <Sidebar
            workspaces={workspaces}
            datasets={datasetsMap}
            selectedWorkspaceId={selectedWorkspaceId}
            selectedDatasetId={selectedDatasetId}
            onSelectWorkspace={handleSelectWorkspace}
            onSelectDataset={handleSelectDataset}
            onNewConcept={handleNewConcept}
            isLoading={workspacesLoading}
            width={sidebarWidth}
          />
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 group"
            data-testid="sidebar-resize-handle"
          >
            <div 
              className="w-full h-full transition-colors"
              style={{ 
                backgroundColor: isResizing ? "hsl(330 85% 60%)" : "transparent" 
              }}
            />
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: "hsl(330 85% 60% / 0.5)" }}
            />
          </div>
        </div>

        <main className="flex-1 flex flex-col surface-1 overflow-hidden">
          <DatasetToolbar
            datasets={currentWorkspaceDatasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <ImageGrid
            images={filteredImages}
            selectedImageId={selectedImageId}
            onSelectImage={handleSelectImage}
            datasetId={selectedDatasetId}
            isLoading={imagesLoading}
            onUploadComplete={() => refetchImages()}
          />
        </main>

        <DetailPanel
          image={selectedImage || null}
          onClose={handleCloseDetailPanel}
          onDeleted={handleImageDeleted}
          isOpen={!!selectedImageId}
        />
      </div>

      <Dialog open={modalType === "workspace"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="glass border-glow animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-primary-emphasis text-lg">Create New Concept</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name" className="text-secondary text-sm">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Concept"
                className="surface-3 border-0 focus:ring-1 input-glow transition-smooth"
                data-testid="input-workspace-name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description" className="text-secondary text-sm">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                className="surface-3 border-0 resize-none focus:ring-1 input-glow transition-smooth"
                data-testid="input-workspace-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={handleCloseModal}
              className="transition-smooth"
              data-testid="button-cancel-workspace"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={createWorkspace.isPending}
              className="accent-pink transition-smooth"
              data-testid="button-create-workspace"
            >
              {createWorkspace.isPending ? "Creating..." : "Create Concept"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalType === "dataset"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="glass border-glow animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-primary-emphasis text-lg">Create First Dataset</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dataset-name" className="text-secondary text-sm">Dataset Name</Label>
              <Input
                id="dataset-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Training Set"
                className="surface-3 border-0 focus:ring-1 input-glow transition-smooth"
                data-testid="input-dataset-name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dataset-description" className="text-secondary text-sm">Description</Label>
              <Textarea
                id="dataset-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                className="surface-3 border-0 resize-none focus:ring-1 input-glow transition-smooth"
                data-testid="input-dataset-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={handleCloseModal}
              className="transition-smooth"
              data-testid="button-cancel-dataset"
            >
              Skip for now
            </Button>
            <Button
              onClick={handleCreateDataset}
              disabled={createDataset.isPending}
              className="accent-pink transition-smooth"
              data-testid="button-create-dataset"
            >
              {createDataset.isPending ? "Creating..." : "Create Dataset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
