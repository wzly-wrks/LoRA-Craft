import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, Loader2, Download, Check, AlertCircle, Image as ImageIcon, ChevronDown } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SearchResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  width?: number;
  height?: number;
  source: string;
}

interface Settings {
  search: {
    defaultEngine: string;
    brave: { apiKey: string };
    bing: { apiKey: string };
    google: { apiKey: string; searchEngineId: string };
    pinterest: { accessToken: string };
    reddit: { clientId: string; clientSecret: string };
  };
}

interface WebSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string | undefined;
  workspaceId: string | undefined;
  onImagesAdded: () => void;
}

const ALL_SEARCH_ENGINES = [
  { id: "brave", label: "Brave Search" },
  { id: "bing", label: "Bing Images" },
  { id: "google", label: "Google Images" },
  { id: "pinterest", label: "Pinterest" },
  { id: "reddit", label: "Reddit" },
] as const;

const SIZE_PRESETS = [
  { id: "any", label: "Any Size", minWidth: undefined, minHeight: undefined },
  { id: "small", label: "Small (< 500px)", maxWidth: 500 },
  { id: "medium", label: "Medium (500-1500px)", minWidth: 500, maxWidth: 1500 },
  { id: "large", label: "Large (> 1500px)", minWidth: 1500 },
  { id: "custom", label: "Custom Size" },
] as const;

// Different engines have different limits
const getResultsPerPage = (engineId: string) => {
  switch (engineId) {
    case 'google': return 10; // Google Custom Search API max is 10
    case 'reddit': return 25; // Reddit default
    default: return 30; // Brave, Bing, Pinterest
  }
};

export function WebSearchModal({
  isOpen,
  onClose,
  datasetId,
  workspaceId,
  onImagesAdded,
}: WebSearchModalProps) {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  
  // Size filter state
  const [sizePreset, setSizePreset] = useState("any");
  const [customMinWidth, setCustomMinWidth] = useState("");
  const [customMinHeight, setCustomMinHeight] = useState("");
  const [customMaxWidth, setCustomMaxWidth] = useState("");
  const [customMaxHeight, setCustomMaxHeight] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const { toast } = useToast();

  // Fetch settings to get configured engines
  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: isOpen,
    staleTime: 0, // Always refetch when modal opens
  });

  // Determine which engines are configured
  const configuredEngines = useMemo(() => {
    if (!settings?.search) return [];
    
    const engines: typeof ALL_SEARCH_ENGINES[number][] = [];
    const search = settings.search;
    
    // Check each engine - API returns '***configured***' for keys that are set
    if (search.brave?.apiKey && search.brave.apiKey !== '') {
      engines.push(ALL_SEARCH_ENGINES.find(e => e.id === "brave")!);
    }
    if (search.bing?.apiKey && search.bing.apiKey !== '') {
      engines.push(ALL_SEARCH_ENGINES.find(e => e.id === "bing")!);
    }
    if (search.google?.apiKey && search.google.apiKey !== '' && search.google?.searchEngineId && search.google.searchEngineId !== '') {
      engines.push(ALL_SEARCH_ENGINES.find(e => e.id === "google")!);
    }
    if (search.pinterest?.accessToken && search.pinterest.accessToken !== '') {
      engines.push(ALL_SEARCH_ENGINES.find(e => e.id === "pinterest")!);
    }
    if (search.reddit?.clientId && search.reddit.clientId !== '' && search.reddit?.clientSecret && search.reddit.clientSecret !== '') {
      engines.push(ALL_SEARCH_ENGINES.find(e => e.id === "reddit")!);
    }
    
    return engines;
  }, [settings]);

  // Set default engine when settings load or modal opens
  useEffect(() => {
    if (settings?.search && configuredEngines.length > 0 && !engine) {
      // Use default engine if it's configured, otherwise use first configured engine
      const defaultEngine = settings.search.defaultEngine;
      if (configuredEngines.find(e => e.id === defaultEngine)) {
        setEngine(defaultEngine);
      } else {
        setEngine(configuredEngines[0].id);
      }
    }
  }, [settings, configuredEngines, engine]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedUrls(new Set());
      setError(null);
      setEngine("");
      setOffset(0);
      setHasMore(false);
      setLastQuery("");
      setSizePreset("any");
      setCustomMinWidth("");
      setCustomMinHeight("");
      setCustomMaxWidth("");
      setCustomMaxHeight("");
      setShowFilters(false);
    }
  }, [isOpen]);

  // Get size filter values
  const getSizeFilter = useCallback(() => {
    if (sizePreset === "custom") {
      return {
        minWidth: customMinWidth ? parseInt(customMinWidth) : undefined,
        minHeight: customMinHeight ? parseInt(customMinHeight) : undefined,
        maxWidth: customMaxWidth ? parseInt(customMaxWidth) : undefined,
        maxHeight: customMaxHeight ? parseInt(customMaxHeight) : undefined,
      };
    }
    const preset = SIZE_PRESETS.find(p => p.id === sizePreset);
    if (!preset || preset.id === "any") return {};
    return {
      minWidth: (preset as any).minWidth,
      minHeight: (preset as any).minHeight,
      maxWidth: (preset as any).maxWidth,
      maxHeight: (preset as any).maxHeight,
    };
  }, [sizePreset, customMinWidth, customMinHeight, customMaxWidth, customMaxHeight]);

  // Filter results by size
  const filteredResults = useMemo(() => {
    const filter = getSizeFilter();
    if (!filter.minWidth && !filter.minHeight && !filter.maxWidth && !filter.maxHeight) {
      return results;
    }
    return results.filter(r => {
      if (!r.width || !r.height) return true; // Include if no dimensions
      if (filter.minWidth && r.width < filter.minWidth) return false;
      if (filter.minHeight && r.height < filter.minHeight) return false;
      if (filter.maxWidth && r.width > filter.maxWidth) return false;
      if (filter.maxHeight && r.height > filter.maxHeight) return false;
      return true;
    });
  }, [results, getSizeFilter]);

  const handleSearch = async (loadMore = false) => {
    if (!query.trim()) {
      toast({ title: "Please enter a search query", variant: "destructive" });
      return;
    }

    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setError(null);
      setResults([]);
      setSelectedUrls(new Set());
      setOffset(0);
      setLastQuery(query.trim());
    }

    const currentOffset = loadMore ? offset : 0;
    const resultsPerPage = getResultsPerPage(engine);

    try {
      const res = await apiRequest("POST", "/api/search/images", {
        query: loadMore ? lastQuery : query.trim(),
        engine,
        count: resultsPerPage,
        offset: currentOffset,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Search failed");
      }
      
      const data = await res.json() as SearchResult[];
      
      if (loadMore) {
        // Deduplicate by URL when loading more
        setResults(prev => {
          const existingUrls = new Set(prev.map(r => r.url));
          const newResults = data.filter(r => !existingUrls.has(r.url));
          
          // If API returned results but all were duplicates, show a message
          if (data.length > 0 && newResults.length === 0) {
            toast({ 
              title: "No new images found", 
              description: "The search API returned duplicate results. Try a different search term.",
            });
            setHasMore(false);
          } else if (newResults.length < data.length) {
            // Some duplicates filtered
            toast({ 
              title: `Added ${newResults.length} new images`, 
              description: `${data.length - newResults.length} duplicates filtered out`,
            });
            // Still might have more if we got full page
            setHasMore(data.length >= resultsPerPage);
          } else {
            setHasMore(data.length >= resultsPerPage);
          }
          
          return [...prev, ...newResults];
        });
      } else {
        setResults(data);
        setHasMore(data.length >= resultsPerPage);
      }
      
      setOffset(currentOffset + data.length);
      
      if (data.length === 0 && !loadMore) {
        setError("No results found. Try a different search term or engine.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      // Check for rate limit error and provide a better message
      if (message.includes("429") || message.includes("RATE_LIMITED") || message.includes("rate limit")) {
        setError("Rate limit exceeded. Please wait a few seconds before searching again. Free API plans have strict limits.");
      } else {
        setError(message);
      }
      toast({ title: "Search failed", description: message.includes("429") ? "Rate limited - wait a moment" : message, variant: "destructive" });
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
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
    if (selectedUrls.size === filteredResults.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(filteredResults.map((r) => r.url)));
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
        {/* Loading settings */}
        {settingsLoading && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading search engine settings...</span>
          </div>
        )}

        {/* No engines configured warning */}
        {!settingsLoading && configuredEngines.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 text-amber-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              No search engines configured. Go to Settings to add API keys for Brave, Bing, Google, Pinterest, or Reddit.
            </span>
          </div>
        )}

        {/* Search Controls */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for images..."
              className="surface-3 border-0"
              autoComplete="off"
              disabled={isSearching || isDownloading || settingsLoading || configuredEngines.length === 0}
              data-testid="web-search-input"
            />
          </div>
          <Select 
            value={engine} 
            onValueChange={setEngine} 
            disabled={isSearching || isDownloading || settingsLoading || configuredEngines.length === 0}
          >
            <SelectTrigger className="w-[180px] surface-3 border-0" data-testid="web-search-engine">
              <SelectValue placeholder={settingsLoading ? "Loading..." : "Select engine"} />
            </SelectTrigger>
            <SelectContent className="z-[100001]">
              {configuredEngines.map((eng) => (
                <SelectItem key={eng.id} value={eng.id}>
                  {eng.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => handleSearch(false)}
            disabled={isSearching || isLoadingMore || isDownloading || settingsLoading || !query.trim() || !engine || configuredEngines.length === 0}
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

        {/* Size Filters */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-secondary">
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              Filter by Size
              {sizePreset !== "any" && <span className="text-pink-500">•</span>}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="p-3 rounded-md surface-2 space-y-3">
              <div className="flex gap-2 items-center">
                <Label className="text-xs text-secondary w-20">Size:</Label>
                <Select value={sizePreset} onValueChange={setSizePreset}>
                  <SelectTrigger className="flex-1 h-8 surface-3 border-0 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100001]">
                    {SIZE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {sizePreset === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-tertiary">Min Width</Label>
                    <Input
                      type="number"
                      value={customMinWidth}
                      onChange={(e) => setCustomMinWidth(e.target.value)}
                      placeholder="px"
                      className="h-7 text-xs surface-3 border-0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-tertiary">Min Height</Label>
                    <Input
                      type="number"
                      value={customMinHeight}
                      onChange={(e) => setCustomMinHeight(e.target.value)}
                      placeholder="px"
                      className="h-7 text-xs surface-3 border-0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-tertiary">Max Width</Label>
                    <Input
                      type="number"
                      value={customMaxWidth}
                      onChange={(e) => setCustomMaxWidth(e.target.value)}
                      placeholder="px"
                      className="h-7 text-xs surface-3 border-0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-tertiary">Max Height</Label>
                    <Input
                      type="number"
                      value={customMaxHeight}
                      onChange={(e) => setCustomMaxHeight(e.target.value)}
                      placeholder="px"
                      className="h-7 text-xs surface-3 border-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

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
                {filteredResults.length} of {results.length} results
                {sizePreset !== "any" && ` (filtered)`}
                {" "}• {selectedUrls.size} selected
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={isDownloading}
              >
                {selectedUrls.size === filteredResults.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div 
              className="grid grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1"
              data-testid="web-search-results"
            >
              {filteredResults.map((result, index) => (
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

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleSearch(true)}
                  disabled={isLoadingMore || isDownloading}
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    <>
                      Load More Results
                    </>
                  )}
                </Button>
              </div>
            )}
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
