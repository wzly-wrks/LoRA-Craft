import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import type { InsertDataset } from "@shared/schema";

export function useDatasets(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["/api/workspaces", workspaceId, "datasets"],
    queryFn: () => api.datasets.getAll(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useDataset(id: string | undefined) {
  return useQuery({
    queryKey: ["/api/datasets", id],
    queryFn: () => api.datasets.get(id!),
    enabled: !!id,
  });
}

export function useCreateDataset() {
  return useMutation({
    mutationFn: ({ workspaceId, data }: { workspaceId: string; data: Omit<InsertDataset, "workspaceId"> }) =>
      api.datasets.create(workspaceId, data),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "datasets"] });
    },
  });
}

export function useUpdateDataset() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertDataset> }) =>
      api.datasets.update(id, data),
    onSuccess: (dataset) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", dataset.workspaceId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets", dataset.id] });
    },
  });
}

export function useDeleteDataset() {
  return useMutation({
    mutationFn: (id: string) => api.datasets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
    },
  });
}
