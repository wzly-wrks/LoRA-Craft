import { useState, useEffect } from "react";
import { XIcon, ImageIcon, Trash2, Plus, Wand2, Loader2, Maximize2, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useUpdateImage, useDeleteImage, useResizeImage, useRemoveBackground, useTrainingPresets } from "@/hooks/useImages";
import { useToast } from "@/hooks/use-toast";
import { api, type ImageWithUrl } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DetailPanelProps {
  image: ImageWithUrl | null;
  onClose: () => void;
  onDeleted?: () => void;
  isOpen?: boolean;
}

export function DetailPanel({ image, onClose, onDeleted, isOpen = true }: DetailPanelProps) {
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const { toast } = useToast();

  const updateImage = useUpdateImage();
  const deleteImage = useDeleteImage();
  const resizeImage = useResizeImage();
  const removeBackground = useRemoveBackground();
  const { data: trainingPresets } = useTrainingPresets();
  const queryClient = useQueryClient();

  const generateCaption = useMutation({
    mutationFn: (imageId: string) => api.operations.generateCaption(imageId),
    onSuccess: (data) => {
      setCaption(data.caption);
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast({ title: "Caption generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate caption", variant: "destructive" });
    },
  });

  const generateTags = useMutation({
    mutationFn: (imageId: string) => api.operations.generateTags(imageId),
    onSuccess: (data) => {
      setTags(data.tags);
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast({ title: "Tags generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate tags", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (image) {
      setCaption(image.caption || "");
      setTags(image.tags || []);
    }
  }, [image]);

  if (!isOpen || !image) {
    return null;
  }

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatMime = (mime: string | null | undefined) => {
    if (!mime) return "Unknown";
    return mime.split("/")[1]?.toUpperCase() || mime;
  };

  const handleSave = async () => {
    try {
      await updateImage.mutateAsync({
        id: image.id,
        data: { caption, tags },
      });
      toast({ title: "Image updated successfully" });
    } catch {
      toast({ title: "Failed to update image", variant: "destructive" });
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await deleteImage.mutateAsync(image.id);
      toast({ title: "Image deleted successfully" });
      onDeleted?.();
    } catch {
      toast({ title: "Failed to delete image", variant: "destructive" });
    }
  };

  const handleResize = async () => {
    if (!selectedPreset && (!customWidth || !customHeight)) {
      toast({ title: "Please select a preset or enter custom dimensions", variant: "destructive" });
      return;
    }

    try {
      let options: { targetWidth?: number; targetHeight?: number } = {};
      
      if (selectedPreset && selectedPreset !== "custom") {
        const preset = trainingPresets?.find(p => p.name === selectedPreset);
        if (preset) {
          options = { targetWidth: preset.width, targetHeight: preset.height };
        }
      } else if (customWidth && customHeight) {
        options = { 
          targetWidth: parseInt(customWidth), 
          targetHeight: parseInt(customHeight) 
        };
      }

      await resizeImage.mutateAsync({ imageId: image.id, options });
      setShowResizeDialog(false);
      toast({ title: "Image resized successfully" });
    } catch {
      toast({ title: "Failed to resize image", variant: "destructive" });
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await removeBackground.mutateAsync(image.id);
      toast({ title: "Background removed successfully" });
    } catch {
      toast({ title: "Failed to remove background", variant: "destructive" });
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const imageInfo = [
    { label: "Resolution", value: image.width && image.height ? `${image.width} × ${image.height}` : "Unknown" },
    { label: "Format", value: formatMime(image.mime) },
    { label: "Size", value: formatSize(image.sizeBytes) },
    { label: "Source", value: image.sourceType || "Unknown" },
  ];

  return (
    <aside
      className="absolute right-0 top-0 w-[322px] h-full border-l border-solid flex flex-col z-20"
      style={{
        backgroundColor: "#121212",
        borderColor: "#2c2c2c33",
        boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.5), -2px 0 8px rgba(0, 0, 0, 0.3)",
        animation: "slideInRight 0.25s ease-out",
      }}
      data-testid="detail-panel"
    >
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <header className="h-[60px] flex items-center justify-center relative px-6">
        <h2 className="text-[#e8e8e8] text-base font-medium text-center">
          Image Details
        </h2>
        <Button
          variant="ghost"
          onClick={onClose}
          className="absolute right-6 top-1/2 -translate-y-1/2 h-auto w-auto p-0"
          data-testid="button-close-panel"
        >
          <XIcon className="w-5 h-5 text-white" />
        </Button>
      </header>

      <div className="flex-1 px-6 py-6 flex flex-col gap-6 overflow-auto">
        <Card
          className="w-full h-[244px] border border-solid shadow-[0px_4px_4px_#00000040] rounded-lg"
          style={{
            backgroundColor: "#1e1e1e",
            borderColor: "#2a2a2a",
          }}
        >
          <CardContent className="h-full flex items-center justify-center p-0">
            {image.url ? (
              <img
                src={image.url}
                alt={image.originalFilename || "Image"}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-12 h-12 text-neutral-500" />
            )}
          </CardContent>
        </Card>

        <section>
          <h3 className="text-white text-base font-medium mb-3">Info</h3>
          <div className="flex flex-col gap-1.5">
            {imageInfo.map((info, index) => (
              <p
                key={index}
                className="text-[#bfbfbf] text-[13px]"
                data-testid={`info-${info.label.toLowerCase()}`}
              >
                {info.label}: {info.value}
              </p>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-white text-base font-medium mb-3">Image Tools</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowResizeDialog(true)}
              disabled={resizeImage.isPending}
              className="flex-1 h-8 text-xs"
              style={{ backgroundColor: "#2a2a2a" }}
              data-testid="button-resize"
            >
              {resizeImage.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Resize
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRemoveBackground}
              disabled={removeBackground.isPending}
              className="flex-1 h-8 text-xs"
              style={{ backgroundColor: "#2a2a2a" }}
              data-testid="button-remove-bg"
            >
              {removeBackground.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Eraser className="w-3.5 h-3.5 mr-1.5" />
              )}
              Remove BG
            </Button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-base font-medium">Tags</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => generateTags.mutate(image.id)}
              disabled={generateTags.isPending}
              className="h-7 px-2 text-xs"
              style={{ backgroundColor: "#2a2a2a" }}
              data-testid="button-generate-tags"
            >
              {generateTags.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3 mr-1" />
              )}
              AI Tags
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="rounded-xl px-3 py-1 h-auto text-sm cursor-pointer"
                style={{ backgroundColor: "#2a2a2a" }}
                onClick={() => removeTag(tag)}
                data-testid={`tag-${tag}`}
              >
                {tag}
                <XIcon className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add tag..."
              className="flex-1 h-8 border-0 rounded-lg"
              style={{ backgroundColor: "#2a2a2a" }}
              data-testid="input-new-tag"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={addTag}
              style={{ backgroundColor: "#2a2a2a" }}
              data-testid="button-add-tag"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-base font-medium">Caption</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => generateCaption.mutate(image.id)}
              disabled={generateCaption.isPending}
              className="h-7 px-2 text-xs"
              style={{ backgroundColor: "#2a2a2a" }}
              data-testid="button-generate-caption"
            >
              {generateCaption.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3 mr-1" />
              )}
              AI Caption
            </Button>
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="w-full h-[100px] border border-solid rounded-lg shadow-[0px_4px_4px_#0000001a] resize-none text-sm"
            style={{ backgroundColor: "#2a2a2a" }}
            data-testid="textarea-caption"
          />
        </section>

        <div className="flex gap-2 mt-auto">
          <Button
            onClick={handleSave}
            disabled={updateImage.isPending}
            className="flex-1 h-[41px] rounded-lg shadow-[0px_2px_6px_#00000026] text-white text-base font-semibold"
            style={{ backgroundColor: "#3a3a3a" }}
            data-testid="button-save"
          >
            {updateImage.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteClick}
            disabled={deleteImage.isPending}
            className="h-[41px] w-[41px]"
            style={{ backgroundColor: "#2a2a2a" }}
            data-testid="button-delete"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
          </Button>
        </div>
      </div>

      <Dialog open={showResizeDialog} onOpenChange={setShowResizeDialog}>
        <DialogContent style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Resize Image</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Choose a training preset or enter custom dimensions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-neutral-300 text-sm mb-2 block">Training Presets</Label>
              <Select value={selectedPreset} onValueChange={(v) => {
                setSelectedPreset(v);
                if (v !== "custom") {
                  setCustomWidth("");
                  setCustomHeight("");
                }
              }}>
                <SelectTrigger 
                  className="w-full border-0" 
                  style={{ backgroundColor: "#2a2a2a" }}
                  data-testid="select-resize-preset"
                >
                  <SelectValue placeholder="Select a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {trainingPresets?.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name} ({preset.width}x{preset.height})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom dimensions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {selectedPreset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-neutral-400 text-xs mb-1 block">Width (px)</Label>
                  <Input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="1024"
                    className="border-0"
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-resize-width"
                  />
                </div>
                <div>
                  <Label className="text-neutral-400 text-xs mb-1 block">Height (px)</Label>
                  <Input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="1024"
                    className="border-0"
                    style={{ backgroundColor: "#2a2a2a" }}
                    data-testid="input-resize-height"
                  />
                </div>
              </div>
            )}

            {selectedPreset && selectedPreset !== "custom" && (
              <div className="text-sm text-neutral-400">
                {trainingPresets?.find(p => p.name === selectedPreset)?.description}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowResizeDialog(false)}
              data-testid="button-resize-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResize}
              disabled={resizeImage.isPending || (!selectedPreset && (!customWidth || !customHeight))}
              data-testid="button-resize-confirm"
            >
              {resizeImage.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resizing...
                </>
              ) : (
                "Resize"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Image?"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={deleteImage.isPending}
        variant="destructive"
      />
    </aside>
  );
}
