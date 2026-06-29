"use client";

import { AlertTriangleIcon, PlusIcon, TerminalIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/core/i18n/hooks";
import {
  addMCPServer,
  deleteMCPServer,
  loadMCPConfig,
  loadMCPRuntimeDiagnostics,
  updateMCPConfig,
} from "@/core/mcp/api";
import type { MCPServerConfig, MCPServerRuntimeStatus } from "@/core/mcp/types";

import { McpCard } from "./mcp-card";
import { McpDialog } from "./mcp-dialog";

export function McpGallery() {
  const { t } = useI18n();
  const [servers, setServers] = useState<Record<string, MCPServerConfig>>({});
  const [runtimeStatuses, setRuntimeStatuses] = useState<Record<string, MCPServerRuntimeStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<MCPServerConfig | null>(
    null,
  );

  // Delete state
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, diagnostics] = await Promise.all([
        loadMCPConfig(),
        loadMCPRuntimeDiagnostics().catch(() => ({ mcpServers: [] })),
      ]);
      setServers(data.mcp_servers);
      setRuntimeStatuses(Object.fromEntries(diagnostics.mcpServers.map((status) => [status.id, status])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load MCP config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = () => {
    setEditingName(null);
    setEditingConfig(null);
    setDialogOpen(true);
  };

  const handleEdit = (name: string) => {
    setEditingName(name);
    setEditingConfig(servers[name] ?? null);
    setDialogOpen(true);
  };

  const handleSave = async (
    name: string,
    isNew: boolean,
    config: MCPServerConfig,
  ) => {
    if (isNew) {
      await addMCPServer(name, config);
      toast.success(t.mcp.createSuccess);
    } else {
      // Update via full config PUT
      const current = await loadMCPConfig();
      const updated = {
        mcp_servers: {
          ...current.mcp_servers,
          [name]: config,
        },
      };
      await updateMCPConfig(updated);
      toast.success(t.mcp.updateSuccess);
    }
    await refresh();
  };

  const handleDelete = async () => {
    if (!deletingName) return;
    setDeleting(true);
    try {
      await deleteMCPServer(deletingName);
      toast.success(t.mcp.deleteSuccess);
      setDeletingName(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const serverEntries = Object.entries(servers);

  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="shrink-0 border-b bg-muted/20">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <TerminalIcon className="w-6 h-6 text-rose-500" />
              <span>{t.mcp.title}</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              {t.mcp.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {serverEntries.length > 0 && !loading && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex size-2 rounded-full bg-amber-400" />
                {serverEntries.length} 个服务器
              </div>
            )}
            <Button
              onClick={handleAdd}
            >
              <PlusIcon className="mr-1.5 h-4 w-4" />
              {t.mcp.addServer}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg border bg-muted/30"
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="size-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <TerminalIcon className="size-7 text-red-400" />
            </div>
            <p className="text-destructive text-sm font-medium">{error}</p>
            <Button variant="outline" onClick={refresh}>
              Retry
            </Button>
          </div>
        ) : serverEntries.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl" />
              <div className="relative bg-amber-500/10 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-amber-500/20">
                <TerminalIcon className="text-amber-500 h-8 w-8" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-lg">{t.mcp.emptyTitle}</p>
              <p className="text-muted-foreground mt-1 text-sm max-w-sm">
                {t.mcp.emptyDescription}
              </p>
            </div>
            <Button
              onClick={handleAdd}
              className="mt-2"
            >
              <PlusIcon className="mr-1.5 h-4 w-4" />
              {t.mcp.addServer}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {serverEntries.map(([name, config]) => (
              <McpCard
                key={name}
                name={name}
                config={config}
                runtimeStatus={runtimeStatuses[name]}
                onEdit={handleEdit}
                onDelete={setDeletingName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <McpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        name={editingName}
        config={editingConfig}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deletingName}
        onOpenChange={(open) => {
          if (!open) setDeletingName(null);
        }}
      >
        <DialogContent className="p-0">
          <div className="h-1.5 w-full rounded-t-lg bg-gradient-to-r from-red-400 to-rose-400" />
          <DialogHeader className="px-6 pt-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <AlertTriangleIcon className="h-4 w-4" />
              </span>
              {t.mcp.deleteServer}
            </DialogTitle>
            <DialogDescription className="pl-10">
              {t.mcp.deleteConfirm.replace(
                "{name}",
                deletingName ?? "",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-5">
            <Button
              variant="outline"
              onClick={() => setDeletingName(null)}
              disabled={deleting}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="shadow-sm"
            >
              {deleting ? t.common.loading : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
