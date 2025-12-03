import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, XIcon, Rocket, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Workspace {
  id: string;
  name: string;
}

interface Dataset {
  id: string;
  name: string;
  workspaceId: string;
  imageCount?: number;
}

interface TrainingJob {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: {
    version: string;
    weights: string;
  };
}

interface ExportRecord {
  id: string;
  status: string;
  downloadUrl?: string;
  zipKey?: string;
}

export default function TrainingPage() {
  const { toast } = useToast();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [triggerWord, setTriggerWord] = useState<string>("");
  const [modelType, setModelType] = useState<"flux" | "sdxl">("flux");
  const [steps, setSteps] = useState<number>(1000);
  const [loraRank, setLoraRank] = useState<number>(16);
  const [learningRate, setLearningRate] = useState<number>(0.0004);
  const [resolution, setResolution] = useState<string>("512,768,1024");
  const [exportingDataset, setExportingDataset] = useState<boolean>(false);
  const [showTrainingConfirm, setShowTrainingConfirm] = useState<boolean>(false);

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: datasets, isLoading: loadingDatasets } = useQuery<Dataset[]>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "datasets"],
    enabled: !!selectedWorkspaceId,
  });

  const { data: trainingsData, isLoading: loadingTrainings, refetch: refetchTrainings } = useQuery<{ trainings: TrainingJob[] }>({
    queryKey: ["/api/replicate/trainings"],
    refetchInterval: 10000,
  });

  const startTrainingMutation = useMutation({
    mutationFn: async (data: {
      zipUrl: string;
      triggerWord: string;
      modelType: string;
      steps: number;
      loraRank: number;
      learningRate: number;
      resolution: string;
    }) => {
      const res = await apiRequest("POST", "/api/replicate/train", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training job started successfully" });
      refetchTrainings();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start training", description: error.message, variant: "destructive" });
    },
  });

  const cancelTrainingMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      const res = await apiRequest("POST", `/api/replicate/training/${trainingId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training job canceled" });
      refetchTrainings();
    },
    onError: () => {
      toast({ title: "Failed to cancel training", variant: "destructive" });
    },
  });

  const handleTrainingClick = () => {
    if (!selectedDatasetId) {
      toast({ title: "Please select a dataset", variant: "destructive" });
      return;
    }

    if (!triggerWord.trim()) {
      toast({ title: "Please enter a trigger word", variant: "destructive" });
      return;
    }

    setShowTrainingConfirm(true);
  };

  const handleStartTraining = async () => {
    setShowTrainingConfirm(false);
    setExportingDataset(true);

    try {
      const exportRes = await apiRequest("POST", `/api/datasets/${selectedDatasetId}/exports`);
      const exportRecord: ExportRecord = await exportRes.json();

      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusRes = await apiRequest("GET", `/api/exports/${exportRecord.id}`);
        const status: ExportRecord = await statusRes.json();
        
        if (status.status === "completed" && status.downloadUrl) {
          setExportingDataset(false);
          
          startTrainingMutation.mutate({
            zipUrl: status.downloadUrl,
            triggerWord: triggerWord.trim(),
            modelType,
            steps,
            loraRank,
            learningRate,
            resolution,
          });
          return;
        } else if (status.status === "failed") {
          throw new Error("Dataset export failed");
        }
        
        attempts++;
      }

      throw new Error("Dataset export timed out");
    } catch (error) {
      setExportingDataset(false);
      toast({ 
        title: "Failed to export dataset", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  const getStatusBadge = (status: string, jobId: string) => {
    switch (status) {
      case 'starting':
        return <Badge variant="secondary" data-testid={`badge-status-${jobId}`}><Clock className="w-3 h-3 mr-1" />Starting</Badge>;
      case 'processing':
        return <Badge style={{ backgroundColor: "#3b82f6" }} data-testid={`badge-status-${jobId}`}><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'succeeded':
        return <Badge style={{ backgroundColor: "#22c55e" }} data-testid={`badge-status-${jobId}`}><CheckCircle2 className="w-3 h-3 mr-1" />Succeeded</Badge>;
      case 'failed':
        return <Badge variant="destructive" data-testid={`badge-status-${jobId}`}><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'canceled':
        return <Badge variant="outline" data-testid={`badge-status-${jobId}`}><AlertCircle className="w-3 h-3 mr-1" />Canceled</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`badge-status-${jobId}`}>{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const trainings = trainingsData?.trainings || [];

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-training">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">LoRA Training</h1>
              <p className="text-neutral-400">Submit datasets to Replicate.com for LoRA model training</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-close-training">
              <XIcon className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-6">
          <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Rocket className="w-5 h-5" />
                Start New Training
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Configure and submit a dataset for LoRA training on Replicate.com
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">Workspace</Label>
                  <Select
                    value={selectedWorkspaceId}
                    onValueChange={(value) => {
                      setSelectedWorkspaceId(value);
                      setSelectedDatasetId("");
                    }}
                    disabled={loadingWorkspaces}
                  >
                    <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-workspace">
                      <SelectValue placeholder="Select workspace..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces?.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-200">Dataset</Label>
                  <Select
                    value={selectedDatasetId}
                    onValueChange={setSelectedDatasetId}
                    disabled={!selectedWorkspaceId || loadingDatasets}
                  >
                    <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-dataset">
                      <SelectValue placeholder="Select dataset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets?.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">Trigger Word</Label>
                  <Input
                    placeholder="e.g., TOK, sks, ohwx"
                    value={triggerWord}
                    onChange={(e) => setTriggerWord(e.target.value)}
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-trigger-word"
                  />
                  <p className="text-xs text-neutral-500">
                    A unique word that will trigger your trained style/subject
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-200">Model Type</Label>
                  <Select value={modelType} onValueChange={(v) => setModelType(v as "flux" | "sdxl")}>
                    <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-model-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flux">Flux (Recommended)</SelectItem>
                      <SelectItem value="sdxl">SDXL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-neutral-200">Training Steps</Label>
                    <span className="text-sm text-neutral-400" data-testid="text-steps-value">{steps}</span>
                  </div>
                  <Slider
                    value={[steps]}
                    onValueChange={(v) => setSteps(v[0])}
                    min={500}
                    max={4000}
                    step={100}
                    className="w-full"
                    data-testid="slider-steps"
                  />
                  <p className="text-xs text-neutral-500">
                    More steps = longer training time but potentially better results
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-neutral-200">LoRA Rank</Label>
                    <span className="text-sm text-neutral-400" data-testid="text-lora-rank-value">{loraRank}</span>
                  </div>
                  <Slider
                    value={[loraRank]}
                    onValueChange={(v) => setLoraRank(v[0])}
                    min={4}
                    max={64}
                    step={4}
                    className="w-full"
                    data-testid="slider-lora-rank"
                  />
                  <p className="text-xs text-neutral-500">
                    Higher rank = more capacity but larger file size
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-neutral-200">Learning Rate</Label>
                    <Select 
                      value={String(learningRate)} 
                      onValueChange={(v) => setLearningRate(parseFloat(v))}
                    >
                      <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-learning-rate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.0001">0.0001 (Conservative)</SelectItem>
                        <SelectItem value="0.0002">0.0002</SelectItem>
                        <SelectItem value="0.0004">0.0004 (Default)</SelectItem>
                        <SelectItem value="0.0008">0.0008</SelectItem>
                        <SelectItem value="0.001">0.001 (Aggressive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-neutral-200">Resolution</Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512px</SelectItem>
                        <SelectItem value="512,768">512, 768px</SelectItem>
                        <SelectItem value="512,768,1024">512, 768, 1024px</SelectItem>
                        <SelectItem value="1024">1024px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleTrainingClick}
                disabled={!selectedDatasetId || !triggerWord.trim() || exportingDataset || startTrainingMutation.isPending}
                className="w-full"
                style={{ backgroundColor: "#ff58a5" }}
                data-testid="button-start-training"
              >
                {exportingDataset ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting Dataset...
                  </>
                ) : startTrainingMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Training...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Start Training on Replicate
                  </>
                )}
              </Button>

              <p className="text-xs text-neutral-500 text-center">
                Training costs will be charged to your Replicate.com account
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-white">Training Jobs</CardTitle>
                <CardDescription className="text-neutral-400">
                  View and manage your LoRA training jobs
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetchTrainings()}
                disabled={loadingTrainings}
                data-testid="button-refresh-trainings"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTrainings ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTrainings && trainings.length === 0 ? (
                <div className="flex items-center justify-center py-8" data-testid="loading-trainings">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
              ) : trainings.length === 0 ? (
                <div className="text-center py-8 text-neutral-500" data-testid="empty-trainings">
                  No training jobs yet. Start a training above to see it here.
                </div>
              ) : (
                <div className="space-y-4" data-testid="trainings-list">
                  {trainings.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-4 p-4 rounded-md"
                      style={{ backgroundColor: "#2a2a2a" }}
                      data-testid={`training-job-${job.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(job.status, job.id)}
                          <span className="text-sm text-neutral-400 truncate" data-testid={`text-job-id-${job.id}`}>
                            {job.id}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500" data-testid={`text-job-dates-${job.id}`}>
                          Started: {formatDate(job.createdAt)}
                          {job.completedAt && ` | Completed: ${formatDate(job.completedAt)}`}
                        </div>
                        {job.error && (
                          <p className="text-xs text-red-400 mt-1 truncate" data-testid={`text-job-error-${job.id}`}>{job.error}</p>
                        )}
                        {job.output?.weights && (
                          <p className="text-xs text-green-400 mt-1" data-testid={`text-job-weights-${job.id}`}>
                            Weights: {job.output.weights}
                          </p>
                        )}
                      </div>
                      {(job.status === 'starting' || job.status === 'processing') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelTrainingMutation.mutate(job.id)}
                          disabled={cancelTrainingMutation.isPending}
                          data-testid={`button-cancel-${job.id}`}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <CardHeader>
              <CardTitle className="text-white">Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-neutral-300">
              <div className="space-y-2">
                <h3 className="font-medium">1. Get a Replicate API Token</h3>
                <p className="text-sm text-neutral-400">
                  Visit replicate.com and create an account. Go to your account settings to get your API token.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">2. Configure your API Token</h3>
                <p className="text-sm text-neutral-400">
                  Go to <Link href="/settings" className="text-blue-400 hover:underline">Settings</Link> and enter your Replicate API token in the API Keys tab.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">3. Prepare your Dataset</h3>
                <p className="text-sm text-neutral-400">
                  Upload images to a dataset and add captions. Aim for 10-50 high-quality images of your subject.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">4. Start Training</h3>
                <p className="text-sm text-neutral-400">
                  Select your dataset, enter a trigger word, configure settings, and click "Start Training".
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={showTrainingConfirm}
        title="Start Training?"
        message="Your selected images will be packaged and sent to Replicate.com to begin training. Training costs will be charged to your Replicate account."
        confirmLabel="Start Training"
        cancelLabel="Cancel"
        onConfirm={handleStartTraining}
        onCancel={() => setShowTrainingConfirm(false)}
        isLoading={exportingDataset || startTrainingMutation.isPending}
      />
    </div>
  );
}
