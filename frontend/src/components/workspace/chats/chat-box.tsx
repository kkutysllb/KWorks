import { FilesIcon, PanelRightCloseIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";

import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { env } from "@/env";
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
  const pathname = usePathname();
  const threadIdRef = useRef(threadId);
  const layoutRef = useRef<GroupImperativeHandle>(null);

  const {
    artifacts,
    open: artifactsOpen,
    setOpen: setArtifactsOpen,
    setArtifacts,
    select: selectArtifact,
    deselect,
    selectedArtifact,
  } = useArtifacts();

  const [autoSelectFirstArtifact, setAutoSelectFirstArtifact] = useState(true);
  useEffect(() => {
    if (threadIdRef.current !== threadId) {
      threadIdRef.current = threadId;
      deselect();
    }

    // Update artifacts from the current thread
    setArtifacts(thread.values.artifacts ?? []);

    // DO NOT automatically deselect the artifact when switching threads, because the artifacts auto discovering is not work now.
    // if (
    //   selectedArtifact &&
    //   !thread.values.artifacts?.includes(selectedArtifact)
    // ) {
    //   deselect();
    // }

    if (
      env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" &&
      autoSelectFirstArtifact
    ) {
      if (thread?.values?.artifacts?.length > 0) {
        setAutoSelectFirstArtifact(false);
        selectArtifact(thread.values.artifacts[0]!);
      }
    }
  }, [
    threadId,
    autoSelectFirstArtifact,
    deselect,
    selectArtifact,
    selectedArtifact,
    setArtifacts,
    thread.values.artifacts,
  ]);

  const artifactPanelOpen = useMemo(() => {
    if (env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true") {
      return artifactsOpen && artifacts?.length > 0;
    }
    return artifactsOpen;
  }, [artifactsOpen, artifacts]);

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
          !artifactPanelOpen && "pointer-events-none opacity-0",
        )}
      />
      <ResizablePanel
        className={cn(
          "transition-all duration-300 ease-in-out",
          !artifactsOpen && "opacity-0",
        )}
        id="artifacts"
      >
        <div
          className={cn(
            "h-full p-4 transition-transform duration-300 ease-in-out",
            artifactPanelOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex size-full flex-col overflow-hidden rounded-lg border bg-background/80 shadow-sm">
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
