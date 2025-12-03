import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, Key, Search, Cpu, Settings2, ArrowLeft, XIcon } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Settings {
  openai: { apiKey: string };
  replicate: { apiKey: string };
  search: {
    defaultEngine: "brave" | "bing" | "google" | "pinterest" | "reddit";
    brave: { apiKey: string };
    bing: { apiKey: string };
    google: { apiKey: string; searchEngineId: string };
    pinterest: { accessToken: string };
    reddit: { clientId: string; clientSecret: string };
  };
  app: {
    defaultExportPath: string;
    thumbnailSize: number;
    autoCaption: boolean;
    defaultAspectRatio: string;
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const [validating, setValidating] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, boolean | null>>({});

  const { data: settings, isLoading, refetch } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved successfully" });
      refetch();
      setLocalSettings({});
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const validateApiKey = async (service: string, apiKey?: string) => {
    setValidating(service);
    setValidationResults((prev) => ({ ...prev, [service]: null }));

    try {
      const res = await apiRequest("POST", `/api/settings/validate-${service}`, { apiKey });
      const result = await res.json();
      setValidationResults((prev) => ({ ...prev, [service]: result.valid }));
      
      if (result.valid) {
        toast({ title: `${service.charAt(0).toUpperCase() + service.slice(1)} API key is valid` });
      } else {
        toast({ title: `Invalid ${service} API key`, variant: "destructive" });
      }
    } catch {
      setValidationResults((prev) => ({ ...prev, [service]: false }));
      toast({ title: "Validation failed", variant: "destructive" });
    } finally {
      setValidating(null);
    }
  };

  const handleSave = () => {
    if (Object.keys(localSettings).length > 0) {
      updateSettings.mutate(localSettings);
    }
  };

  const updateLocalSetting = (path: string, value: unknown) => {
    const keys = path.split(".");
    setLocalSettings((prev) => {
      const updated = { ...prev };
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const getLocalValue = (path: string, defaultValue: unknown) => {
    const keys = path.split(".");
    let current: any = localSettings;

    for (const key of keys) {
      if (current === undefined || current === null) {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== undefined ? current : defaultValue;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: "#0f0f0f" }}>
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-neutral-400">Configure API keys, search engines, and app preferences</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-close-settings">
              <XIcon className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="api" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3" style={{ backgroundColor: "#1a1a1a" }}>
            <TabsTrigger value="api" data-testid="tab-api">
              <Key className="w-4 h-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-search">
              <Search className="w-4 h-4 mr-2" />
              Search Engines
            </TabsTrigger>
            <TabsTrigger value="preferences" data-testid="tab-preferences">
              <Settings2 className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">OpenAI</CardTitle>
                  {settings?.openai.apiKey && (
                    <Badge variant="secondary" className="text-xs">
                      {validationResults.openai === true ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : validationResults.openai === false ? (
                        <X className="w-3 h-3 mr-1" />
                      ) : null}
                      Configured
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Used for AI-powered image captioning and tagging
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={getLocalValue("openai.apiKey", "") as string}
                      onChange={(e) => updateLocalSetting("openai.apiKey", e.target.value)}
                      className="flex-1"
                      style={{ backgroundColor: "#2a2a2a" }}
                      data-testid="input-openai-key"
                    />
                    <Button
                      variant="outline"
                      onClick={() => validateApiKey("openai", getLocalValue("openai.apiKey", "") as string)}
                      disabled={validating === "openai"}
                      data-testid="button-validate-openai"
                    >
                      {validating === "openai" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">Replicate</CardTitle>
                  {settings?.replicate.apiKey && (
                    <Badge variant="secondary" className="text-xs">
                      {validationResults.replicate === true ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : validationResults.replicate === false ? (
                        <X className="w-3 h-3 mr-1" />
                      ) : null}
                      Configured
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Used for submitting LoRA training jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">API Token</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="r8_..."
                      value={getLocalValue("replicate.apiKey", "") as string}
                      onChange={(e) => updateLocalSetting("replicate.apiKey", e.target.value)}
                      className="flex-1"
                      style={{ backgroundColor: "#2a2a2a" }}
                      data-testid="input-replicate-key"
                    />
                    <Button
                      variant="outline"
                      onClick={() => validateApiKey("replicate", getLocalValue("replicate.apiKey", "") as string)}
                      disabled={validating === "replicate"}
                      data-testid="button-validate-replicate"
                    >
                      {validating === "replicate" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <CardTitle className="text-white">Default Search Engine</CardTitle>
                <CardDescription className="text-neutral-400">
                  Choose which search engine to use for image searches
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={getLocalValue("search.defaultEngine", settings?.search.defaultEngine || "brave") as string}
                  onValueChange={(value) => updateLocalSetting("search.defaultEngine", value)}
                >
                  <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-search-engine">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brave">Brave Search</SelectItem>
                    <SelectItem value="bing">Bing Image Search</SelectItem>
                    <SelectItem value="google">Google Custom Search</SelectItem>
                    <SelectItem value="pinterest">Pinterest</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">Brave Search</CardTitle>
                  {settings?.search.brave.apiKey && (
                    <Badge variant="secondary" className="text-xs">Configured</Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Get your API key from search.brave.com/api
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-neutral-200">API Key</Label>
                <Input
                  type="password"
                  placeholder="BSA..."
                  value={getLocalValue("search.brave.apiKey", "") as string}
                  onChange={(e) => updateLocalSetting("search.brave.apiKey", e.target.value)}
                  style={{ backgroundColor: "#2a2a2a" }}
                  data-testid="input-brave-key"
                />
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">Bing Image Search</CardTitle>
                  {settings?.search.bing.apiKey && (
                    <Badge variant="secondary" className="text-xs">Configured</Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Get your API key from Azure Cognitive Services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-neutral-200">API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter Bing API key"
                  value={getLocalValue("search.bing.apiKey", "") as string}
                  onChange={(e) => updateLocalSetting("search.bing.apiKey", e.target.value)}
                  style={{ backgroundColor: "#2a2a2a" }}
                  data-testid="input-bing-key"
                />
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">Google Custom Search</CardTitle>
                  {settings?.search.google.apiKey && (
                    <Badge variant="secondary" className="text-xs">Configured</Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Requires both an API key and Custom Search Engine ID
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">API Key</Label>
                  <Input
                    type="password"
                    placeholder="AIza..."
                    value={getLocalValue("search.google.apiKey", "") as string}
                    onChange={(e) => updateLocalSetting("search.google.apiKey", e.target.value)}
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-google-key"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-200">Search Engine ID</Label>
                  <Input
                    type="text"
                    placeholder="Enter your CSE ID"
                    value={getLocalValue("search.google.searchEngineId", settings?.search.google.searchEngineId || "") as string}
                    onChange={(e) => updateLocalSetting("search.google.searchEngineId", e.target.value)}
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-google-cse-id"
                  />
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">Pinterest</CardTitle>
                  {settings?.search.pinterest?.accessToken && (
                    <Badge variant="secondary" className="text-xs">Configured</Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Get your access token from developers.pinterest.com
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-neutral-200">Access Token</Label>
                <Input
                  type="password"
                  placeholder="pina_..."
                  value={getLocalValue("search.pinterest.accessToken", "") as string}
                  onChange={(e) => updateLocalSetting("search.pinterest.accessToken", e.target.value)}
                  style={{ backgroundColor: "#2a2a2a" }}
                  data-testid="input-pinterest-token"
                />
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-white">Reddit</CardTitle>
                  {settings?.search.reddit?.clientId && (
                    <Badge variant="secondary" className="text-xs">Configured</Badge>
                  )}
                </div>
                <CardDescription className="text-neutral-400">
                  Create an app at reddit.com/prefs/apps to get your credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">Client ID</Label>
                  <Input
                    type="password"
                    placeholder="Enter Reddit Client ID"
                    value={getLocalValue("search.reddit.clientId", "") as string}
                    onChange={(e) => updateLocalSetting("search.reddit.clientId", e.target.value)}
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-reddit-client-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-200">Client Secret</Label>
                  <Input
                    type="password"
                    placeholder="Enter Reddit Client Secret"
                    value={getLocalValue("search.reddit.clientSecret", "") as string}
                    onChange={(e) => updateLocalSetting("search.reddit.clientSecret", e.target.value)}
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-reddit-client-secret"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <CardTitle className="text-white">Image Processing</CardTitle>
                <CardDescription className="text-neutral-400">
                  Configure default settings for image processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-neutral-200">Auto-Caption on Upload</Label>
                    <p className="text-sm text-neutral-500">
                      Automatically generate captions when images are uploaded
                    </p>
                  </div>
                  <Switch
                    checked={getLocalValue("app.autoCaption", settings?.app.autoCaption || false) as boolean}
                    onCheckedChange={(checked) => updateLocalSetting("app.autoCaption", checked)}
                    data-testid="switch-auto-caption"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-200">Default Aspect Ratio</Label>
                  <Select
                    value={getLocalValue("app.defaultAspectRatio", settings?.app.defaultAspectRatio || "1:1") as string}
                    onValueChange={(value) => updateLocalSetting("app.defaultAspectRatio", value)}
                  >
                    <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                      <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                      <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                      <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-200">Thumbnail Size</Label>
                  <Select
                    value={String(getLocalValue("app.thumbnailSize", settings?.app.thumbnailSize || 256))}
                    onValueChange={(value) => updateLocalSetting("app.thumbnailSize", parseInt(value))}
                  >
                    <SelectTrigger style={{ backgroundColor: "#2a2a2a" }} data-testid="select-thumbnail-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="128">128px</SelectItem>
                      <SelectItem value="256">256px</SelectItem>
                      <SelectItem value="512">512px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <CardHeader>
                <CardTitle className="text-white">Export Settings</CardTitle>
                <CardDescription className="text-neutral-400">
                  Configure default export behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">Default Export Path</Label>
                  <Input
                    type="text"
                    placeholder="Leave empty for default downloads folder"
                    value={getLocalValue("app.defaultExportPath", settings?.app.defaultExportPath || "") as string}
                    onChange={(e) => updateLocalSetting("app.defaultExportPath", e.target.value)}
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-export-path"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            variant="outline"
            onClick={() => setLocalSettings({})}
            disabled={Object.keys(localSettings).length === 0}
            data-testid="button-reset"
          >
            Reset Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={Object.keys(localSettings).length === 0 || updateSettings.isPending}
            style={{ backgroundColor: "#ff58a5" }}
            data-testid="button-save-settings"
          >
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
