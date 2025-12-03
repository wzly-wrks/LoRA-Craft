import { useState } from "react";
import { SearchIcon, FilterIcon, Copy, Download, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

export function DatasetToolbar({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  searchQuery,
  onSearchChange,
}: DatasetToolbarProps) {
  const [exportId, setExportId] = useState<string | null>(null);
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

  const handleExport = async () => {
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

  const handleDownload = () => {
    if (exportData?.downloadUrl) {
      window.open(exportData.downloadUrl, "_blank");
    }
  };

  const isExporting = exportData?.status === "processing" || createExport.isPending;

  return (
    <header
      className="h-[60px] flex items-center gap-4 px-[41px]"
      style={{ backgroundColor: "#1a1a1a" }}
      data-testid="dataset-toolbar"
    >
      <Select
        value={selectedDatasetId || ""}
        onValueChange={onSelectDataset}
      >
        <SelectTrigger
          className="w-auto min-w-[150px] h-8 border-0 rounded-lg shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] gap-1.5 px-3"
          style={{ backgroundColor: "#2a2a2a" }}
          data-testid="select-dataset"
        >
          <SelectValue placeholder="Select dataset" />
        </SelectTrigger>
        <SelectContent>
          {datasets.length === 0 ? (
            <SelectItem value="none" disabled>
              No datasets
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

      <div className="relative flex-1 max-w-[297px]">
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search images..."
          className="h-8 border-0 rounded-lg pr-10 text-neutral-200"
          style={{ backgroundColor: "#2a2a2a" }}
          data-testid="input-search"
        />
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-200" />
      </div>

      <Button
        variant="ghost"
        className="h-8 w-[35px] p-0 rounded-lg"
        style={{ backgroundColor: "#2a2a2a" }}
        data-testid="button-filter"
      >
        <FilterIcon className="w-5 h-5 text-neutral-200" />
      </Button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 px-3 rounded-lg gap-2"
            style={{ backgroundColor: "#2a2a2a" }}
            disabled={!selectedDatasetId}
            data-testid="button-actions"
          >
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleDedupe}
            disabled={runDedupe.isPending || !selectedDatasetId}
            data-testid="action-dedupe"
          >
            <Copy className="w-4 h-4 mr-2" />
            {runDedupe.isPending ? "Running..." : "Find Duplicates"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => selectedDatasetId && captionAll.mutate(selectedDatasetId)}
            disabled={captionAll.isPending || !selectedDatasetId}
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
            onClick={handleExport}
            disabled={isExporting || !selectedDatasetId}
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
            <DropdownMenuItem onClick={handleDownload} data-testid="action-download">
              <Download className="w-4 h-4 mr-2" />
              Download Export
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
