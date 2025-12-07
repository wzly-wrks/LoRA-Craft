import { useState, useEffect, useCallback, useRef } from "react";
import { Star, Loader2, Search, Play, X, Check, AlertCircle, Globe, Image as ImageIcon, Settings, ChevronDown } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DiscoveredSite {
  url: string;
  name: string;
  type: string;
  estimatedImages?: number;
}

interface CrawlJob {
  id: string;
  status: "pending" | "searching" | "crawling" | "downloading" | "completed" | "failed" | "cancelled";
  imagesFound: number;
  duplicatesRemoved: number;
  currentSite?: string | null;
  pagesScanned?: number;
  imagesDownloaded?: number;
  discoveredSites?: Array<{ url: string; type: string; confidence: number }>;
  error?: string | null;
}

interface CelebritySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string | undefined;
  workspaceId: string | undefined;
  onImagesAdded: () => void;
}

type Step = "discover" | "configure" | "progress";

const STATUS_LABELS: Record<string, string> = {
  pending: "Preparing...",
  searching: "Searching for sites...",
  crawling: "Crawling galleries...",
  downloading: "Downloading images...",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function CelebritySearchModal({
  isOpen,
  onClose,
  datasetId,
  workspaceId,
  onImagesAdded,
}: CelebritySearchModalProps) {
  const [celebrityName, setCelebrityName] = useState("");
  const [step, setStep] = useState<Step>("discover");
  const [discoveredSites, setDiscoveredSites] = useState<DiscoveredSite[]>([]);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [maxImages, setMaxImages] = useState("500");
  const [minResolution, setMinResolution] = useState("300");
  const [crawlDepth, setCrawlDepth] = useState("3");
  const [showOptions, setShowOptions] = useState(false);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setCelebrityName("");
    setStep("discover");
    setDiscoveredSites([]);
    setSelectedSites(new Set());
    setIsDiscovering(false);
    setIsCrawling(false);
    setJobId(null);
    setJob(null);
    setError(null);
    setMaxImages("500");
    setMinResolution("300");
    setCrawlDepth("3");
    setShowOptions(false);
    setIsImporting(false);
    setImportResult(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);

  const importCachedImages = useCallback(async (id: string) => {
    if (!datasetId) return { imported: 0, failed: 0 };
    
    setIsImporting(true);
    try {
      const res = await apiRequest("POST", `/api/crawl-jobs/${id}/import`, {
        datasetId,
      });
      const result = await res.json();
      setImportResult(result);
      return result;
    } catch (err) {
      console.error("Error importing cached images:", err);
      return { imported: 0, failed: 0 };
    } finally {
      setIsImporting(false);
    }
  }, [datasetId]);

  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/crawl-jobs/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch job status");
      const data = await res.json();
      setJob(data);

      if (["completed", "failed", "cancelled"].includes(data.status)) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsCrawling(false);
        
        if (data.status === "completed") {
          const importRes = await importCachedImages(id);
          toast({
            title: "Images imported",
            description: `Added ${importRes.imported} images to your dataset`,
          });
          onImagesAdded();
        } else if (data.status === "failed") {
          setError(data.error || "Crawl failed");
        }
      }
    } catch (err) {
      console.error("Error polling job status:", err);
    }
  }, [toast, onImagesAdded, importCachedImages]);

  const handleDiscover = async () => {
    if (!celebrityName.trim()) {
      toast({ title: "Please enter a celebrity name", variant: "destructive" });
      return;
    }

    setIsDiscovering(true);
    setError(null);
    setDiscoveredSites([]);

    try {
      const res = await apiRequest("POST", "/api/celebrity-search/discover", {
        celebrityName: celebrityName.trim(),
      });
      
      const data = await res.json();
      
      if (data.sites && data.sites.length > 0) {
        setDiscoveredSites(data.sites);
        setSelectedSites(new Set(data.sites.map((s: DiscoveredSite) => s.url)));
        setStep("configure");
      } else {
        setError("No fan sites found for this celebrity. Try a different name or spelling.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Discovery failed";
      setError(message);
      toast({ title: "Discovery failed", description: message, variant: "destructive" });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleStartCrawl = async () => {
    if (!datasetId || !workspaceId) {
      toast({ title: "Please select a dataset first", variant: "destructive" });
      return;
    }

    if (selectedSites.size === 0) {
      toast({ title: "Please select at least one site", variant: "destructive" });
      return;
    }

    setIsCrawling(true);
    setError(null);
    setStep("progress");

    try {
      const res = await apiRequest("POST", "/api/celebrity-search", {
        celebrityName: celebrityName.trim(),
        datasetId,
        workspaceId,
        sites: Array.from(selectedSites),
        options: {
          maxImages: parseInt(maxImages) || 500,
          minResolution: parseInt(minResolution) || 300,
          crawlDepth: parseInt(crawlDepth) || 3,
        },
      });
      
      const data = await res.json();
      setJobId(data.jobId);
      
      pollingRef.current = setInterval(() => {
        pollJobStatus(data.jobId);
      }, 2000);
      
      pollJobStatus(data.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start crawl";
      setError(message);
      setIsCrawling(false);
      setStep("configure");
      toast({ title: "Failed to start crawl", description: message, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;

    try {
      await apiRequest("POST", `/api/crawl-jobs/${jobId}/cancel`, {});
      toast({ title: "Crawl cancelled" });
    } catch (err) {
      toast({ title: "Failed to cancel crawl", variant: "destructive" });
    }
  };

  const handleClose = useCallback(() => {
    if (isCrawling && job?.status && !["completed", "failed", "cancelled"].includes(job.status)) {
      return;
    }
    onClose();
  }, [isCrawling, job, onClose]);

  const toggleSite = (url: string) => {
    setSelectedSites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const selectAllSites = () => {
    if (selectedSites.size === discoveredSites.length) {
      setSelectedSites(new Set());
    } else {
      setSelectedSites(new Set(discoveredSites.map(s => s.url)));
    }
  };

  const getProgressPercent = () => {
    if (!job) return 0;
    const maxImg = parseInt(maxImages) || 500;
    return Math.min(100, ((job.imagesDownloaded || job.imagesFound || 0) / maxImg) * 100);
  };

  const canClose = !isImporting && (!isCrawling || (job && ["completed", "failed", "cancelled"].includes(job.status)));

  return (
    <Modal
      isOpen={isOpen}
      onClose={canClose ? handleClose : () => {}}
      title="Celebrity Fan Site Search"
      className="max-w-2xl w-full"
    >
      <div className="space-y-4">
        {step === "discover" && (
          <>
            <div className="flex items-center gap-2 p-3 rounded-md surface-2">
              <Star className="w-5 h-5 text-pink-500" />
              <span className="text-sm text-secondary">
                Search for celebrity fan sites and galleries to automatically download images
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-secondary text-sm">Celebrity Name</Label>
              <div className="flex gap-2">
                <Input
                  value={celebrityName}
                  onChange={(e) => setCelebrityName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isDiscovering && handleDiscover()}
                  placeholder="Enter celebrity name..."
                  className="flex-1 surface-3 border-0"
                  autoComplete="off"
                  disabled={isDiscovering}
                  data-testid="celebrity-name-input"
                />
                <Button
                  onClick={handleDiscover}
                  disabled={isDiscovering || !celebrityName.trim()}
                  className="accent-pink"
                  data-testid="button-discover-sites"
                >
                  {isDiscovering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="ml-2">Discover Sites</span>
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </>
        )}

        {step === "configure" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-pink-500" />
                <span className="text-sm text-primary-emphasis">
                  Found {discoveredSites.length} site{discoveredSites.length !== 1 ? "s" : ""} for "{celebrityName}"
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("discover");
                  setDiscoveredSites([]);
                  setSelectedSites(new Set());
                }}
                data-testid="button-back-discover"
              >
                Change Name
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-secondary text-sm">Select Sites to Crawl</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllSites}
                  data-testid="button-select-all-sites"
                >
                  {selectedSites.size === discoveredSites.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded-md surface-2 p-2 space-y-1" data-testid="discovered-sites-list">
                {discoveredSites.map((site, index) => (
                  <button
                    key={site.url}
                    onClick={() => toggleSite(site.url)}
                    className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
                      selectedSites.has(site.url)
                        ? "surface-3 ring-1 ring-pink-500/50"
                        : "hover:surface-3"
                    }`}
                    data-testid={`site-option-${index}`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      selectedSites.has(site.url) ? "bg-pink-500" : "surface-3 border border-white/10"
                    }`}>
                      {selectedSites.has(site.url) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-primary-emphasis truncate">{site.name}</div>
                      <div className="text-xs text-tertiary truncate">{site.url}</div>
                    </div>
                    <span className="text-xs text-secondary px-2 py-0.5 rounded surface-3">
                      {site.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Collapsible open={showOptions} onOpenChange={setShowOptions}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-secondary" data-testid="button-toggle-options">
                  <Settings className="w-4 h-4" />
                  <span>Crawl Options</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-3 gap-3 p-3 rounded-md surface-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-tertiary">Max Images</Label>
                    <Input
                      type="number"
                      value={maxImages}
                      onChange={(e) => setMaxImages(e.target.value)}
                      className="h-8 text-sm surface-3 border-0"
                      data-testid="input-max-images"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-tertiary">Min Resolution (px)</Label>
                    <Input
                      type="number"
                      value={minResolution}
                      onChange={(e) => setMinResolution(e.target.value)}
                      className="h-8 text-sm surface-3 border-0"
                      data-testid="input-min-resolution"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-tertiary">Crawl Depth</Label>
                    <Input
                      type="number"
                      value={crawlDepth}
                      onChange={(e) => setCrawlDepth(e.target.value)}
                      className="h-8 text-sm surface-3 border-0"
                      data-testid="input-crawl-depth"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </>
        )}

        {step === "progress" && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {isImporting ? (
                  <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                ) : job?.status && ["completed", "failed", "cancelled"].includes(job.status) ? (
                  importResult ? (
                    <Check className="w-6 h-6 text-green-500" />
                  ) : job.status === "completed" ? (
                    <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  )
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                )}
                <div>
                  <div className="text-sm text-primary-emphasis font-medium">
                    {isImporting ? "Importing images to dataset..." : 
                     importResult ? `Imported ${importResult.imported} images` :
                     STATUS_LABELS[job?.status || "pending"]}
                  </div>
                  {job?.currentSite && !importResult && (
                    <div className="text-xs text-tertiary truncate max-w-[400px]">
                      {job.currentSite}
                    </div>
                  )}
                </div>
              </div>

              <Progress value={importResult ? 100 : getProgressPercent()} className="h-2" data-testid="crawl-progress" />

              <div className="grid grid-cols-3 gap-4 p-4 rounded-md surface-2">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-primary-emphasis" data-testid="stat-images-downloaded">
                    {importResult ? importResult.imported : (job?.imagesDownloaded || 0)}
                  </div>
                  <div className="text-xs text-secondary flex items-center justify-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {importResult ? "Images Imported" : "Images Downloaded"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-primary-emphasis" data-testid="stat-sites-crawled">
                    {job?.pagesScanned || 0}
                  </div>
                  <div className="text-xs text-secondary flex items-center justify-center gap-1">
                    <Globe className="w-3 h-3" />
                    Pages Scanned
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-primary-emphasis" data-testid="stat-duplicates-removed">
                    {job?.duplicatesRemoved || 0}
                  </div>
                  <div className="text-xs text-secondary flex items-center justify-center gap-1">
                    <X className="w-3 h-3" />
                    Duplicates Removed
                  </div>
                </div>
              </div>

              {job?.status === "failed" && job.error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{job.error}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ModalFooter className="gap-2">
        {step === "discover" && (
          <Button
            variant="ghost"
            onClick={handleClose}
            className="transition-smooth"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
        )}

        {step === "configure" && (
          <>
            <Button
              variant="ghost"
              onClick={handleClose}
              className="transition-smooth"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartCrawl}
              disabled={isCrawling || selectedSites.size === 0 || !datasetId}
              className="accent-pink transition-smooth"
              data-testid="button-start-crawl"
            >
              {isCrawling ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Crawl ({selectedSites.size} site{selectedSites.size !== 1 ? "s" : ""})
            </Button>
          </>
        )}

        {step === "progress" && (
          <>
            {isImporting ? (
              <Button
                disabled
                className="accent-pink transition-smooth"
                data-testid="button-importing"
              >
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Importing...
              </Button>
            ) : job?.status && !["completed", "failed", "cancelled"].includes(job.status) ? (
              <Button
                variant="destructive"
                onClick={handleCancel}
                className="transition-smooth"
                data-testid="button-cancel-crawl"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Crawl
              </Button>
            ) : (
              <Button
                onClick={handleClose}
                className="accent-pink transition-smooth"
                data-testid="button-done"
              >
                Done
              </Button>
            )}
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
