import { ImageIcon, Upload } from "lucide-react";
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

function SkeletonCard() {
  return (
    <div 
      className="w-[180px] h-[180px] rounded-lg skeleton"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    />
  );
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
        className="flex-1 flex flex-col items-center justify-center surface-1 animate-fade-in"
        data-testid="image-grid-empty-state"
      >
        <div 
          className="w-20 h-20 rounded-full surface-3 flex items-center justify-center mb-6"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          <ImageIcon className="w-10 h-10 text-tertiary" />
        </div>
        <h3 className="text-primary-emphasis text-xl mb-2">No Dataset Selected</h3>
        <p className="text-secondary text-sm">Select a dataset from the sidebar to view images</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex-1 flex flex-col overflow-hidden surface-1"
        data-testid="image-grid-loading"
      >
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden surface-1"
      data-testid="image-grid"
    >
      {images.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
          <UploadDropzone datasetId={datasetId} onUploadComplete={onUploadComplete} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 animate-fade-in">
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
              className="image-card w-[180px] h-[180px] flex items-center justify-center rounded-lg border-2 border-dashed cursor-pointer surface-2 group"
              style={{
                borderColor: 'hsl(0 0% 20%)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-normal) var(--ease-out)',
              }}
              data-testid="upload-more-images"
            >
              <div className="image-card-overlay absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'hsl(var(--accent-pink) / 0.15)',
                    transition: 'all var(--transition-fast) var(--ease-out)',
                  }}
                >
                  <Upload className="w-6 h-6" style={{ color: 'hsl(var(--accent-pink))' }} />
                </div>
              </div>
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
