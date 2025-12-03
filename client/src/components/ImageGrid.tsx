import { ImageIcon } from "lucide-react";
import { ImageCard } from "./ImageCard";
import { UploadDropzone } from "./UploadDropzone";
import type { ImageWithUrl } from "@/lib/api";

interface ImageGridProps {
  images: ImageWithUrl[];
  selectedImageId: string | undefined;
  onSelectImage: (id: string) => void;
  datasetId: string | undefined;
  isLoading?: boolean;
  onUploadComplete?: () => void;
}

export function ImageGrid({
  images,
  selectedImageId,
  onSelectImage,
  datasetId,
  isLoading,
  onUploadComplete,
}: ImageGridProps) {
  if (!datasetId) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <ImageIcon className="w-16 h-16 text-neutral-500 mb-4" />
        <p className="text-[#9a9a9a] text-lg">Select a dataset to view images</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <div className="animate-spin w-8 h-8 border-3 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: "#0f0f0f" }}
      data-testid="image-grid"
    >
      {images.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <UploadDropzone datasetId={datasetId} onUploadComplete={onUploadComplete} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-wrap gap-4">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                isSelected={selectedImageId === image.id}
                onClick={() => onSelectImage(image.id)}
              />
            ))}
            <div
              className="w-[180px] h-[180px] flex items-center justify-center rounded-lg border-2 border-dashed cursor-pointer transition-colors"
              style={{
                borderColor: "#3a3a3a",
                backgroundColor: "#1a1a1a",
              }}
              data-testid="upload-more-images"
            >
              <UploadDropzone
                datasetId={datasetId}
                onUploadComplete={onUploadComplete}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
