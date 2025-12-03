import { ImageIcon, Copy, MessageSquare, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ImageWithUrl } from "@/lib/api";

interface ImageCardProps {
  image: ImageWithUrl;
  isSelected: boolean;
  onClick: () => void;
}

export function ImageCard({ image, isSelected, onClick }: ImageCardProps) {
  const hasCaptionComplete = image.caption && image.caption.trim().length > 0;

  return (
    <Card
      onClick={onClick}
      className={`image-card w-[180px] h-[180px] border-0 rounded-lg cursor-pointer overflow-visible surface-2 ${
        isSelected
          ? "ring-2 ring-offset-2 ring-offset-[hsl(0_0%_6%)]"
          : ""
      }`}
      style={{
        boxShadow: isSelected ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        transition: 'all var(--transition-normal) var(--ease-out)',
        ["--tw-ring-color" as string]: "hsl(var(--accent-pink))",
      }}
      data-testid={`image-card-${image.id}`}
    >
      <CardContent className="p-3 h-full relative">
        {image.url ? (
          <div className="w-full h-full relative rounded overflow-hidden">
            <img
              src={image.url}
              alt={image.originalFilename || "Image"}
              className="w-full h-full object-cover"
              style={{ transition: 'transform var(--transition-normal) var(--ease-out)' }}
            />
            <div 
              className="image-card-overlay absolute inset-0 flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
              }}
            >
              <div 
                className="absolute bottom-2 left-2 right-2 flex items-center gap-1"
                style={{ transition: 'all var(--transition-fast) var(--ease-out)' }}
              >
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'hsl(var(--accent-pink) / 0.9)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <Pencil className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
            {image.flaggedDuplicate && (
              <Badge
                className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5"
                style={{ 
                  backgroundColor: "hsl(0 72% 51%)",
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Dupe
              </Badge>
            )}
            {hasCaptionComplete && (
              <div
                className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ 
                  backgroundColor: "hsl(142 76% 36%)",
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform var(--transition-fast) var(--ease-out)',
                }}
                title="Caption complete"
              >
                <MessageSquare className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-full border border-solid flex items-center justify-center rounded surface-3"
            style={{
              borderColor: "hsl(0 0% 18%)",
            }}
          >
            <ImageIcon className="w-12 h-12 text-tertiary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
