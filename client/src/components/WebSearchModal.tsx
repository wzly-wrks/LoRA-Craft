import { useState, useCallback } from "react";
import { Search, Loader2, Download, Check, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SearchResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  width?: number;
  height?: number;
  source: string;
}

interface WebSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string | undefined;
  workspaceId: string | undefined;
  onImagesAdded: () => void;
}

const SEARCH_ENGINES = [
  { id: "brave", label: "Brave Search" },
  { id: "bing", label: "Bing Images" },
  { id: "google", label: "Google Images" },
  { id: "pinterest", label: "Pinterest" },
  { id: "reddit", label: "Reddit" },
] as const;

export function WebSearchModal({
  isOpen,
  onClose,
  datasetId,
  workspaceId,
  onImagesAdded,
}: WebSearchModalProps) {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<string>("brave");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({ title: "Please enter a search query", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    setSelectedUrls(new Set());

    try {
      const res = await apiRequest("POST", "/api/search/images", {
        query: query.trim(),
        engine,
        count: 30,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Search failed");
      }
      
      const data = await res.json();
      setResults(data);
      
      if (data.length === 0) {
        setError("No results found. Try a different search term or engine.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      handleSearch();
    }
  };

  const toggleSelect = (url: string) => {
    setSelectedUrls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedUrls.size === results.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(results.map((r) => r.url)));
    }
  };

  const handleDownloadSelected = async () => {
    if (!datasetId || !workspaceId || selectedUrls.size === 0) {
      toast({ title: "Please select images to download", variant: "destructive" });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: selectedUrls.size });

    const urls = Array.from(selectedUrls);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const imageUrl = urls[i];
      setDownloadProgress({ current: i + 1, total: urls.length });

      try {
        // First download the image to server storage
        const downloadRes = await apiRequest("POST", "/api/search/download", {
          imageUrl,
          datasetId,
          workspaceId,
        });

        if (!downloadRes.ok) {
          failCount++;
          continue;
        }

        const downloadData = await downloadRes.json();

        // Now create the image record in the database
        const createRes = await apiRequest("POST", `/api/datasets/${datasetId}/images/from-search`, {
          ...downloadData,
          datasetId,
          workspaceId,
          sourceType: "search",
          sourceUrl: imageUrl,
        });

        if (createRes.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
        console.error("Failed to download image:", imageUrl, err);
      }
    }

    setIsDownloading(false);

    if (successCount > 0) {
      toast({
        title: `Downloaded ${successCount} image${successCount > 1 ? "s" : ""}`,
        description: failCount > 0 ? `${failCount} failed to download` : undefined,
      });
      onImagesAdded();
      setSelectedUrls(new Set());
    } else {
      toast({ title: "Failed to download images", variant: "destructive" });
    }
  };

  const handleClose = useCallback(() => {
    if (!isDownloading) {
      setQuery("");
      setResults([]);
      setSelectedUrls(new Set());
      setError(null);
      onClose();
    }
  }, [isDownloading, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Web Image Search"
      className="max-w-4xl w-full"
    >
      <div className="space-y-4">
        {/* Search Controls */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for images..."
              className="surface-3 border-0"
              disabled={isSearching || isDownloading}
              data-testid="web-search-input"
            />
          </div>
          <Select value={engine} onValueChange={setEngine} disabled={isSearching || isDownloading}>
            <SelectTrigger className="w-[180px] surface-3 border-0" data-testid="web-search-engine">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_ENGINES.map((eng) => (
                <SelectItem key={eng.id} value={eng.id}>
                  {eng.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSearch}
            disabled={isSearching || isDownloading || !query.trim()}
            className="accent-pink"
            data-testid="web-search-button"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Results Grid */}
        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-secondary text-sm">
                {results.length} results found • {selectedUrls.size} selected
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={isDownloading}
              >
                {selectedUrls.size === results.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div 
              className="grid grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1"
              data-testid="web-search-results"
            >
              {results.map((result, index) => (
                <button
                  key={`${result.url}-${index}`}
                  onClick={() => toggleSelect(result.url)}
                  disabled={isDownloading}
                  className={`relative aspect-square rounded-md overflow-hidden group transition-all ${
                    selectedUrls.has(result.url)
                      ? "ring-2 ring-offset-2 ring-offset-background ring-pink-500"
                      : "hover:ring-1 hover:ring-white/20"
                  }`}
                  data-testid={`search-result-${index}`}
                >
                  <img
                    src={result.thumbnailUrl}
                    alt={result.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext fill='%23666' x='50%' y='50%' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  
                  {/* Selection indicator */}
                  <div
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      selectedUrls.has(result.url)
                        ? "bg-pink-500 opacity-100"
                        : "bg-black/50 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {selectedUrls.has(result.url) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Source badge */}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white/80">
                    {result.source}
                  </div>

                  {/* Dimensions */}
                  {result.width && result.height && (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white/80">
                      {result.width}×{result.height}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!isSearching && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full surface-3 flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-tertiary" />
            </div>
            <p className="text-secondary text-sm">
              Search for images to add to your dataset
            </p>
            <p className="text-tertiary text-xs mt-1">
              Configure API keys in Settings to enable search engines
            </p>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary mb-4" />
            <p className="text-secondary text-sm">Searching...</p>
          </div>
        )}
      </div>

      <ModalFooter>
        {isDownloading && (
          <div className="flex-1 flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" />
            Downloading {downloadProgress.current} of {downloadProgress.total}...
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleClose}
          disabled={isDownloading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDownloadSelected}
          disabled={selectedUrls.size === 0 || isDownloading || !datasetId}
          className="accent-pink"
          data-testid="download-selected-button"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Add {selectedUrls.size} Image{selectedUrls.size !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
