import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import type { InsertWorkspace } from "@shared/schema";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["/api/workspaces"],
    queryFn: api.workspaces.getAll,
  });
}

export function useWorkspace(id: string | undefined) {
  return useQuery({
    queryKey: ["/api/workspaces", id],
    queryFn: () => api.workspaces.get(id!),
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  return useMutation({
    mutationFn: (data: InsertWorkspace) => api.workspaces.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
    },
  });
}

export function useUpdateWorkspace() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertWorkspace> }) =>
      api.workspaces.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", id] });
    },
  });
}

export function useDeleteWorkspace() {
  return useMutation({
    mutationFn: (id: string) => api.workspaces.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
    },
  });
}
