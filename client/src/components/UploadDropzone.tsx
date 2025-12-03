import { useCallback, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { useUploadImages } from "@/hooks/useImages";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface UploadDropzoneProps {
  datasetId: string;
  onUploadComplete?: () => void;
  compact?: boolean;
}

export function UploadDropzone({ datasetId, onUploadComplete, compact }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadImages = useUploadImages();
  const { toast } = useToast();

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      toast({ title: "No valid image files selected", variant: "destructive" });
      return;
    }

    try {
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await uploadImages.mutateAsync({ datasetId, files: imageFiles });

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({ title: `${imageFiles.length} image(s) uploaded successfully` });
      onUploadComplete?.();

      setTimeout(() => setUploadProgress(0), 1000);
    } catch {
      toast({ title: "Failed to upload images", variant: "destructive" });
      setUploadProgress(0);
    }
  }, [datasetId, uploadImages, toast, onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) handleFiles(files);
    };
    input.click();
  }, [handleFiles]);

  if (compact) {
    return (
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-dropzone
        className={`w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging ? "bg-[#2a2a2a]" : ""
        }`}
        data-testid="upload-dropzone-compact"
      >
        {uploadImages.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
            <span className="text-xs text-[#9a9a9a]">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-[#9a9a9a] mb-2" />
            <span className="text-xs text-[#9a9a9a] text-center">
              Drop or click
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-dropzone
      className={`w-full max-w-md p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
        isDragging
          ? "border-[#ff58a5] bg-[#ff58a5]/10"
          : "border-[#3a3a3a] hover:border-[#5a5a5a]"
      }`}
      style={{ backgroundColor: isDragging ? "rgba(255, 88, 165, 0.05)" : "#1a1a1a" }}
      data-testid="upload-dropzone"
    >
      <div className="flex flex-col items-center gap-4">
        {uploadImages.isPending ? (
          <>
            <div className="w-full max-w-xs">
              <Progress value={uploadProgress} className="h-2" />
            </div>
            <p className="text-[#9a9a9a] text-sm">
              Uploading... {uploadProgress}%
            </p>
          </>
        ) : (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#2a2a2a" }}
            >
              <ImageIcon className="w-8 h-8 text-[#9a9a9a]" />
            </div>
            <div className="text-center">
              <p className="text-white text-lg font-medium mb-1">
                Drop images here
              </p>
              <p className="text-[#9a9a9a] text-sm">
                or click to browse your files
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#ff58a5]" />
              <span className="text-[#ff58a5] text-sm font-medium">
                Upload images
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
