import { FilesIcon, PanelRightCloseIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";

import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspacePathname } from "@/core/navigation/workspace-route";
import { collectResultFiles } from "@/core/tools/result-files";
import { cn } from "@/lib/utils";

import {
  ArtifactFileDetail,
  ArtifactFileList,
  useArtifacts,
} from "../artifacts";
import { useThread } from "../messages/context";

const CLOSE_MODE = { chat: 100, artifacts: 0 };
const OPEN_MODE = { chat: 60, artifacts: 40 };

interface ChatBoxProps {
  children: React.ReactNode;
  threadId: string;
  artifactsMode?: "side-panel" | "disabled";
}

const ChatBox: React.FC<ChatBoxProps> = ({
  children,
  threadId,
  artifactsMode = "side-panel",
}) => {
  const { thread } = useThread();
  const routerPathname = usePathname();
  const pathname = useWorkspacePathname(routerPathname) ?? "";
  const threadIdRef = useRef(threadId);
  const layoutRef = useRef<GroupImperativeHandle>(null);

  const {
    open: artifactsOpen,
    setOpen: setArtifactsOpen,
    setArtifacts,
    deselect,
    selectedArtifact,
  } = useArtifacts();

  // Track the previous loading state so we can refresh artifacts right after a
  // turn finishes (loading: true → false), not only on thread switch / mount.
  const prevLoadingRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (threadIdRef.current !== threadId) {
      threadIdRef.current = threadId;
      deselect();
      prevLoadingRef.current = undefined;
    }
    prevLoadingRef.current = thread.isLoading;

    // Derive the result-file list from the write/edit/str_replace tool calls
    // in the displayed messages. These are the files the model actually
    // produced in the workspace — unlike the thread outputs/ directory, which
    // write tools never target. Recomputed on every render-relevant change
    // (thread switch, new messages, turn completion).
    const resultFiles = collectResultFiles(thread.messages);
    setArtifacts(resultFiles);

  }, [
    threadId,
    thread.messages,
    thread.isLoading,
    thread.values.artifacts,
    deselect,
    setArtifacts,
  ]);

  const artifactPanelOpen = useMemo(() => {
    return artifactsOpen;
  }, [artifactsOpen]);

  const resizableIdBase = useMemo(() => {
    return pathname.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }, [pathname]);

  useEffect(() => {
    if (layoutRef.current) {
      if (artifactPanelOpen) {
        layoutRef.current.setLayout(OPEN_MODE);
      } else {
        layoutRef.current.setLayout(CLOSE_MODE);
      }
    }
  }, [artifactPanelOpen]);

  if (artifactsMode === "disabled") {
    return <>{children}</>;
  }

  return (
    <ResizablePanelGroup
      id={`${resizableIdBase}-panels`}
      orientation="horizontal"
      defaultLayout={{ chat: 100, artifacts: 0 }}
      groupRef={layoutRef}
    >
      <ResizablePanel className="relative" defaultSize={100} id="chat">
        {children}
      </ResizablePanel>
      <ResizableHandle
        id={`${resizableIdBase}-separator`}
        className={cn(
          "opacity-33 hover:opacity-100",
          !artifactPanelOpen && "pointer-events-none hidden opacity-0",
        )}
      />
      <ResizablePanel
        className={cn(
          "transition-all duration-300 ease-in-out",
          !artifactPanelOpen && "pointer-events-none hidden opacity-0",
        )}
        id="artifacts"
      >
        <div
          className={cn(
            "h-full p-4 transition-transform duration-300 ease-in-out",
            artifactPanelOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="bg-background/80 flex size-full flex-col overflow-hidden rounded-lg border shadow-sm">
            <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
              <FilesIcon className="size-4 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium">结果文件</h2>
              </div>
              <Button
                aria-label="关闭结果面板"
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setArtifactsOpen(false);
                }}
              >
                <PanelRightCloseIcon className="size-4" />
              </Button>
            </header>
            <main className="min-h-0 flex-1 overflow-hidden">
              {selectedArtifact ? (
                <ArtifactFileDetail
                  className="size-full border-0 shadow-none"
                  filepath={selectedArtifact}
                  threadId={threadId}
                />
              ) : thread.values.artifacts?.length === 0 ? (
                <ResultPanelEmptyState />
              ) : (
                <div className="flex size-full flex-col overflow-hidden p-3">
                  <ArtifactFileList
                    className="min-h-0 overflow-y-auto"
                    files={thread.values.artifacts ?? []}
                    threadId={threadId}
                  />
                </div>
              )}
            </main>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

function ResultPanelEmptyState() {
  return (
    <ConversationEmptyState
      icon={<XIcon />}
      title="No artifact selected"
      description="Select an artifact to view its details"
    />
  );
}

export { ChatBox };
