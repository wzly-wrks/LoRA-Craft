import { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, PlusIcon, Settings, Rocket, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import type { Workspace, Dataset } from "@shared/schema";

interface SidebarProps {
  workspaces: Workspace[];
  datasets: Map<string, Dataset[]>;
  selectedWorkspaceId: string | undefined;
  selectedDatasetId: string | undefined;
  onSelectWorkspace: (id: string) => void;
  onSelectDataset: (workspaceId: string, datasetId: string) => void;
  onNewConcept: () => void;
  onDeleteWorkspace?: (id: string) => void;
  onDeleteDataset?: (id: string) => void;
  isLoading?: boolean;
  width?: number;
  isDeletingWorkspace?: boolean;
  isDeletingDataset?: boolean;
}

export function Sidebar({
  workspaces,
  datasets,
  selectedWorkspaceId,
  selectedDatasetId,
  onSelectWorkspace,
  onSelectDataset,
  onNewConcept,
  onDeleteWorkspace,
  onDeleteDataset,
  isLoading,
  width = 202,
  isDeletingWorkspace,
  isDeletingDataset,
}: SidebarProps) {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "workspace" | "dataset";
    id: string;
    name: string;
  } | null>(null);

  const toggleWorkspace = (id: string) => {
    const newExpanded = new Set(expandedWorkspaces);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedWorkspaces(newExpanded);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "workspace" && onDeleteWorkspace) {
      onDeleteWorkspace(deleteConfirm.id);
    } else if (deleteConfirm.type === "dataset" && onDeleteDataset) {
      onDeleteDataset(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  return (
    <aside
      className="h-full flex flex-col sidebar-glass transition-smooth overflow-hidden"
      style={{ width, minWidth: 180 }}
      data-testid="sidebar"
    >
      <div className="p-5 flex justify-center">
        <img
          className="w-40 h-40 object-cover transition-smooth"
          alt="Lora craft"
          src="/figmaAssets/lora-craft-1.png"
        />
      </div>

      <div className="px-5 mt-5">
        <Button
          onClick={onNewConcept}
          className="w-full h-auto rounded-[100px] px-4 py-2.5 gap-2 transition-smooth"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
          data-testid="button-new-concept"
        >
          <PlusIcon className="w-5 h-5 text-primary-emphasis" />
          <span className="text-primary-emphasis text-sm font-medium">
            New Concept
          </span>
        </Button>
      </div>

      <div className="flex-1 mt-7 overflow-y-auto min-h-0">
        <nav className="px-3.5 flex flex-col gap-1" data-testid="workspace-list">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
            </div>
          ) : workspaces.length === 0 ? (
            <p className="text-tertiary text-sm text-center py-4">
              No concepts yet
            </p>
          ) : (
            workspaces.map((workspace) => {
              const workspaceDatasets = datasets.get(workspace.id) || [];
              const isExpanded = expandedWorkspaces.has(workspace.id);
              const isSelected = selectedWorkspaceId === workspace.id;

              return (
                <Collapsible
                  key={workspace.id}
                  open={isExpanded}
                  onOpenChange={() => toggleWorkspace(workspace.id)}
                >
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="relative transition-smooth group" data-testid={`workspace-item-${workspace.id}`}>
                        {isSelected && !selectedDatasetId && (
                          <div
                            className="absolute left-[-14px] top-0 w-1 h-full rounded-r transition-smooth"
                            style={{ backgroundColor: "hsl(330 85% 60%)" }}
                          />
                        )}
                        <div className="flex items-center gap-1">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 p-0 interactive transition-smooth"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-tertiary transition-smooth" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-tertiary transition-smooth" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <Button
                            variant="ghost"
                            onClick={() => onSelectWorkspace(workspace.id)}
                            className={`flex-1 h-auto justify-start px-2 py-2 rounded-md interactive transition-smooth ${
                              isSelected && !selectedDatasetId
                                ? "surface-3"
                                : "bg-transparent"
                            }`}
                            data-testid={`button-workspace-${workspace.id}`}
                          >
                            <FolderOpen className="w-4 h-4 mr-2 text-secondary transition-smooth" />
                            <span className="text-primary-emphasis text-sm font-medium truncate">
                              {workspace.name}
                            </span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-workspace-menu-${workspace.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4 text-tertiary" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={() => setDeleteConfirm({ type: "workspace", id: workspace.id, name: workspace.name })}
                                data-testid={`button-delete-workspace-${workspace.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => setDeleteConfirm({ type: "workspace", id: workspace.id, name: workspace.name })}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Concept
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <CollapsibleContent>
                    <div className="ml-7 mt-1 flex flex-col gap-1">
                      {workspaceDatasets.map((dataset) => {
                        const isDatasetSelected = selectedDatasetId === dataset.id;
                        return (
                          <ContextMenu key={dataset.id}>
                            <ContextMenuTrigger asChild>
                              <div className="relative transition-smooth group" data-testid={`dataset-item-${dataset.id}`}>
                                {isDatasetSelected && (
                                  <div
                                    className="absolute left-[-21px] top-0 w-1 h-full rounded-r transition-smooth"
                                    style={{ backgroundColor: "hsl(330 85% 60%)" }}
                                  />
                                )}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    onClick={() => onSelectDataset(workspace.id, dataset.id)}
                                    className={`flex-1 h-auto justify-start px-2 py-1.5 rounded-md interactive transition-smooth ${
                                      isDatasetSelected
                                        ? "surface-3"
                                        : "bg-transparent"
                                    }`}
                                    data-testid={`button-dataset-${dataset.id}`}
                                  >
                                    <span className="text-secondary text-xs truncate">
                                      {dataset.name}
                                    </span>
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        data-testid={`button-dataset-menu-${dataset.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreHorizontal className="w-3 h-3 text-tertiary" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive cursor-pointer"
                                        onClick={() => setDeleteConfirm({ type: "dataset", id: dataset.id, name: dataset.name })}
                                        data-testid={`button-delete-dataset-${dataset.id}`}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-40">
                              <ContextMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={() => setDeleteConfirm({ type: "dataset", id: dataset.id, name: dataset.name })}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Dataset
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </nav>
      </div>

      <div 
        className="p-3.5 flex flex-col gap-1 transition-smooth"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
      >
        <Link href="/training">
          <Button
            variant="ghost"
            className="w-full h-auto justify-start px-2 py-2 rounded-md interactive transition-smooth"
            data-testid="button-training"
          >
            <Rocket className="w-4 h-4 mr-2 text-secondary transition-smooth" />
            <span className="text-primary-emphasis text-sm font-medium">Training</span>
          </Button>
        </Link>
        <Link href="/settings">
          <Button
            variant="ghost"
            className="w-full h-auto justify-start px-2 py-2 rounded-md interactive transition-smooth"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4 mr-2 text-secondary transition-smooth" />
            <span className="text-primary-emphasis text-sm font-medium">Settings</span>
          </Button>
        </Link>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteConfirm?.type === "workspace" ? "Concept" : "Dataset"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"?
              {deleteConfirm?.type === "workspace" && (
                <span className="block mt-2 text-destructive">
                  This will also delete all datasets and images within this concept.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingWorkspace || isDeletingDataset}
              data-testid="button-confirm-delete"
            >
              {(isDeletingWorkspace || isDeletingDataset) ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
