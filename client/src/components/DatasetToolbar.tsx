import { useState } from "react";
import { SearchIcon, FilterIcon, Copy, Download, Loader2, Wand2, Globe, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useRunDedupe, useCreateExport, useExport } from "@/hooks/useImages";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import type { Dataset } from "@shared/schema";

interface DatasetToolbarProps {
  datasets: Dataset[];
  selectedDatasetId: string | undefined;
  onSelectDataset: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterChange?: (filters: ImageFilters) => void;
  onWebSearch?: () => void;
  onCreateDataset?: () => void;
}

export interface ImageFilters {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: string;
}

const ASPECT_RATIOS = [
  { id: "any", label: "Any" },
  { id: "1:1", label: "Square (1:1)" },
  { id: "4:3", label: "Landscape (4:3)" },
  { id: "3:4", label: "Portrait (3:4)" },
  { id: "16:9", label: "Widescreen (16:9)" },
  { id: "9:16", label: "Tall (9:16)" },
] as const;

const SIZE_PRESETS = [
  { id: "any", label: "Any Size", minWidth: undefined, minHeight: undefined },
  { id: "small", label: "Small (< 512px)", maxWidth: 512, maxHeight: 512 },
  { id: "medium", label: "Medium (512-1024px)", minWidth: 512, maxWidth: 1024 },
  { id: "large", label: "Large (> 1024px)", minWidth: 1024 },
  { id: "custom", label: "Custom..." },
] as const;

export function DatasetToolbar({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  searchQuery,
  onSearchChange,
  onFilterChange,
  onWebSearch,
  onCreateDataset,
}: DatasetToolbarProps) {
  const [exportId, setExportId] = useState<string | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [sizePreset, setSizePreset] = useState("any");
  const [aspectRatio, setAspectRatio] = useState("any");
  const [customMinWidth, setCustomMinWidth] = useState("");
  const [customMinHeight, setCustomMinHeight] = useState("");
  const [customMaxWidth, setCustomMaxWidth] = useState("");
  const [customMaxHeight, setCustomMaxHeight] = useState("");

  const runDedupe = useRunDedupe();
  const createExport = useCreateExport();
  const { data: exportData } = useExport(exportId || undefined);
  const { toast } = useToast();

  const captionAll = useMutation({
    mutationFn: (datasetId: string) => api.operations.captionAll(datasetId),
    onSuccess: (data) => {
      toast({
        title: "Auto-captioning started",
        description: `Processing ${data.totalImages} images in the background`,
      });
    },
    onError: () => {
      toast({ title: "Failed to start auto-captioning", variant: "destructive" });
    },
  });

  const handleDedupe = async () => {
    if (!selectedDatasetId) return;
    try {
      const result = await runDedupe.mutateAsync(selectedDatasetId);
      toast({
        title: "Deduplication complete",
        description: `Found ${result.duplicatesFound} duplicates in ${result.totalImages} images`,
      });
    } catch {
      toast({ title: "Failed to run deduplication", variant: "destructive" });
    }
  };

  const handleExportClick = () => {
    if (!selectedDatasetId) return;
    setShowExportConfirm(true);
  };

  const handleExport = async () => {
    setShowExportConfirm(false);
    if (!selectedDatasetId) return;
    try {
      const result = await createExport.mutateAsync(selectedDatasetId);
      setExportId(result.id);
      toast({
        title: "Export started",
        description: "Your export is being prepared...",
      });
    } catch {
      toast({ title: "Failed to create export", variant: "destructive" });
    }
  };

  const handleSizePresetChange = (preset: string) => {
    setSizePreset(preset);
    notifyFilterChange(preset, aspectRatio);
  };

  const handleAspectRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    notifyFilterChange(sizePreset, ratio);
  };

  const notifyFilterChange = (size: string, ratio: string) => {
    if (!onFilterChange) return;

    const preset = SIZE_PRESETS.find(p => p.id === size);
    const filters: ImageFilters = {
      aspectRatio: ratio !== "any" ? ratio : undefined,
    };

    if (size === "custom") {
      filters.minWidth = customMinWidth ? parseInt(customMinWidth) : undefined;
      filters.minHeight = customMinHeight ? parseInt(customMinHeight) : undefined;
      filters.maxWidth = customMaxWidth ? parseInt(customMaxWidth) : undefined;
      filters.maxHeight = customMaxHeight ? parseInt(customMaxHeight) : undefined;
    } else if (preset && preset.id !== "any") {
      if ('minWidth' in preset) filters.minWidth = preset.minWidth as number | undefined;
      if ('minHeight' in preset) filters.minHeight = preset.minHeight as number | undefined;
      if ('maxWidth' in preset) filters.maxWidth = preset.maxWidth as number | undefined;
      if ('maxHeight' in preset) filters.maxHeight = preset.maxHeight as number | undefined;
    }

    onFilterChange(filters);
  };

  const handleDownload = () => {
    if (exportData?.downloadUrl) {
      window.open(exportData.downloadUrl, "_blank");
    }
  };

  const isExporting = exportData?.status === "processing" || createExport.isPending;

  const hasActiveFilters = 
    sizePreset !== "any" || 
    aspectRatio !== "any";

  return (
    <header
      className="toolbar-glass h-[60px] flex items-center gap-4 px-10"
      data-testid="dataset-toolbar"
    >
      <div className="flex items-center gap-2">
        <Select
          value={selectedDatasetId || ""}
          onValueChange={onSelectDataset}
        >
          <SelectTrigger
            className="w-auto min-w-[150px] h-8 border-0 rounded-md surface-3 transition-smooth text-primary-emphasis gap-1.5 px-3 shadow-sm"
            data-testid="select-dataset"
          >
            <SelectValue placeholder="Select dataset" className="text-secondary" />
          </SelectTrigger>
          <SelectContent className="animate-slide-in-up">
            {datasets.length === 0 ? (
              <SelectItem value="none" disabled>
                No datasets - create one first
              </SelectItem>
            ) : (
              datasets.map((dataset) => (
                <SelectItem key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {onCreateDataset && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateDataset}
            className="w-8 h-8 surface-3 rounded-md interactive transition-smooth"
            title="Create new dataset"
            data-testid="button-create-dataset-toolbar"
          >
            <PlusIcon className="w-4 h-4 text-secondary" />
          </Button>
        )}
      </div>

      <div className="relative flex-1 max-w-[297px]">
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search images..."
          className="h-8 border-0 rounded-md surface-3 pr-10 text-secondary transition-smooth input-glow focus:text-primary-emphasis"
          data-testid="input-search"
        />
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary transition-smooth" />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="surface-3 rounded-md relative interactive transition-smooth"
            data-testid="button-filter"
          >
            <FilterIcon className="w-5 h-5 text-secondary" />
            {hasActiveFilters && (
              <span 
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full transition-smooth"
                style={{ backgroundColor: "hsl(330 85% 60%)" }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-0 glass rounded-md border border-white/[0.08] shadow-lg animate-scale-in"
        >
          <div className="p-3 border-b border-white/[0.06]">
            <h4 className="font-medium text-sm text-primary-emphasis">Filter Options</h4>
            <p className="text-xs text-tertiary mt-1">
              Filter images by size and search engines
            </p>
          </div>
          
          <div className="p-3 border-b border-white/[0.06]">
            <Label className="text-xs text-secondary mb-2 block">Image Size</Label>
            <Select value={sizePreset} onValueChange={handleSizePresetChange}>
              <SelectTrigger 
                className="w-full h-8 text-sm border-0 surface-3 rounded-md transition-smooth"
                data-testid="select-size-preset"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="animate-slide-in-up">
                {SIZE_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {sizePreset === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-2 animate-fade-in">
                <div>
                  <Label className="text-xs text-tertiary">Min Width</Label>
                  <Input
                    type="number"
                    value={customMinWidth}
                    onChange={(e) => {
                      setCustomMinWidth(e.target.value);
                      notifyFilterChange(sizePreset, aspectRatio);
                    }}
                    placeholder="px"
                    className="h-7 text-xs border-0 surface-3 rounded-md transition-smooth input-glow"
                    data-testid="input-min-width"
                  />
                </div>
                <div>
                  <Label className="text-xs text-tertiary">Min Height</Label>
                  <Input
                    type="number"
                    value={customMinHeight}
                    onChange={(e) => {
                      setCustomMinHeight(e.target.value);
                      notifyFilterChange(sizePreset, aspectRatio);
                    }}
                    placeholder="px"
                    className="h-7 text-xs border-0 surface-3 rounded-md transition-smooth input-glow"
                    data-testid="input-min-height"
                  />
                </div>
                <div>
                  <Label className="text-xs text-tertiary">Max Width</Label>
                  <Input
                    type="number"
                    value={customMaxWidth}
                    onChange={(e) => {
                      setCustomMaxWidth(e.target.value);
                      notifyFilterChange(sizePreset, aspectRatio);
                    }}
                    placeholder="px"
                    className="h-7 text-xs border-0 surface-3 rounded-md transition-smooth input-glow"
                    data-testid="input-max-width"
                  />
                </div>
                <div>
                  <Label className="text-xs text-tertiary">Max Height</Label>
                  <Input
                    type="number"
                    value={customMaxHeight}
                    onChange={(e) => {
                      setCustomMaxHeight(e.target.value);
                      notifyFilterChange(sizePreset, aspectRatio);
                    }}
                    placeholder="px"
                    className="h-7 text-xs border-0 surface-3 rounded-md transition-smooth input-glow"
                    data-testid="input-max-height"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-b border-white/[0.06]">
            <Label className="text-xs text-secondary mb-2 block">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={handleAspectRatioChange}>
              <SelectTrigger 
                className="w-full h-8 text-sm border-0 surface-3 rounded-md transition-smooth"
                data-testid="select-aspect-ratio"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="animate-slide-in-up">
                {ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio.id} value={ratio.id}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>

      {onWebSearch && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onWebSearch}
          className="surface-3 rounded-md interactive transition-smooth"
          disabled={!selectedDatasetId}
          data-testid="button-web-search"
          title="Search web for images"
        >
          <Globe className="w-5 h-5 text-secondary" />
        </Button>
      )}

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 px-3 rounded-md gap-2 surface-3 interactive transition-smooth text-secondary"
            disabled={!selectedDatasetId}
            data-testid="button-actions"
          >
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="animate-slide-in-up">
          <DropdownMenuItem
            onClick={handleDedupe}
            disabled={runDedupe.isPending || !selectedDatasetId}
            className="transition-smooth"
            data-testid="action-dedupe"
          >
            <Copy className="w-4 h-4 mr-2" />
            {runDedupe.isPending ? "Running..." : "Find Duplicates"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => selectedDatasetId && captionAll.mutate(selectedDatasetId)}
            disabled={captionAll.isPending || !selectedDatasetId}
            className="transition-smooth"
            data-testid="action-caption-all"
          >
            {captionAll.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            {captionAll.isPending ? "Starting..." : "Auto-Caption All"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExportClick}
            disabled={isExporting || !selectedDatasetId}
            className="transition-smooth"
            data-testid="action-export"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isExporting ? "Exporting..." : "Export Dataset"}
          </DropdownMenuItem>
          {exportData?.status === "completed" && exportData.downloadUrl && (
            <DropdownMenuItem onClick={handleDownload} className="transition-smooth" data-testid="action-download">
              <Download className="w-4 h-4 mr-2" />
              Download Export
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmModal
        isOpen={showExportConfirm}
        title="Export Dataset?"
        message="This will export your current dataset as a ZIP file containing all images and their captions."
        confirmLabel="Export"
        cancelLabel="Cancel"
        onConfirm={handleExport}
        onCancel={() => setShowExportConfirm(false)}
        isLoading={createExport.isPending}
      />
    </header>
  );
}
