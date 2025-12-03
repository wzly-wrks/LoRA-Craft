import { ImageIcon, Copy, MessageSquare } from "lucide-react";
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
      className={`w-[180px] h-[180px] border-0 rounded-lg shadow-[0px_2px_6px_#000000] cursor-pointer transition-all hover-elevate ${
        isSelected
          ? "ring-2 ring-offset-2 ring-offset-[#0f0f0f]"
          : ""
      }`}
      style={{
        backgroundColor: "#1d1d1d",
        ["--tw-ring-color" as string]: "#ff58a5",
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
            />
            {image.flaggedDuplicate && (
              <Badge
                className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5"
                style={{ backgroundColor: "#ff5858" }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Dupe
              </Badge>
            )}
            {hasCaptionComplete && (
              <div
                className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#22c55e" }}
                title="Caption complete"
              >
                <MessageSquare className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-full border border-solid flex items-center justify-center rounded"
            style={{
              backgroundColor: "#2a2a2a",
              borderColor: "#3a3a3a",
            }}
          >
            <ImageIcon className="w-12 h-12 text-neutral-500" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
