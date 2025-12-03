import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import type { UpdateImage } from "@shared/schema";

export function useImages(datasetId: string | undefined) {
  return useQuery({
    queryKey: ["/api/datasets", datasetId, "images"],
    queryFn: () => api.images.getAll(datasetId!),
    enabled: !!datasetId,
  });
}

export function useImage(id: string | undefined) {
  return useQuery({
    queryKey: ["/api/images", id],
    queryFn: () => api.images.get(id!),
    enabled: !!id,
  });
}

export function useUploadImages() {
  return useMutation({
    mutationFn: ({ datasetId, files }: { datasetId: string; files: File[] }) =>
      api.images.upload(datasetId, files),
    onSuccess: (_, { datasetId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets", datasetId, "images"] });
    },
  });
}

export function useUpdateImage() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateImage }) =>
      api.images.update(id, data),
    onSuccess: (image) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets", image.datasetId, "images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images", image.id] });
    },
  });
}

export function useDeleteImage() {
  return useMutation({
    mutationFn: (id: string) => api.images.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
    },
  });
}

export function useRunDedupe() {
  return useMutation({
    mutationFn: (datasetId: string) => api.operations.runDedupe(datasetId),
    onSuccess: (_, datasetId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets", datasetId, "images"] });
    },
  });
}

export function useCreateExport() {
  return useMutation({
    mutationFn: (datasetId: string) => api.exports.create(datasetId),
  });
}

export function useExport(id: string | undefined) {
  return useQuery({
    queryKey: ["/api/exports", id],
    queryFn: () => api.exports.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "processing") return 2000;
      return false;
    },
  });
}

export function useResizeImage() {
  return useMutation({
    mutationFn: ({ 
      imageId, 
      options 
    }: { 
      imageId: string; 
      options: { targetWidth?: number; targetHeight?: number; aspectRatio?: string } 
    }) => api.operations.resizeImage(imageId, options),
    onSuccess: (image) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets", image.datasetId, "images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images", image.id] });
    },
  });
}

export function useRemoveBackground() {
  return useMutation({
    mutationFn: (imageId: string) => api.operations.removeBackground(imageId),
    onSuccess: (image) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets", image.datasetId, "images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images", image.id] });
    },
  });
}

export function useTrainingPresets() {
  return useQuery({
    queryKey: ["/api/training-presets"],
    queryFn: () => api.operations.getTrainingPresets(),
  });
}
