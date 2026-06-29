"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { SettingsLayoutProvider } from "@/components/workspace/settings/settings-layout-state";
import {
  SettingsPageShell,
  type SettingsSection,
} from "@/components/workspace/settings/settings-page-shell";

type SettingsDialogProps = React.ComponentProps<typeof Dialog> & {
  defaultSection?: SettingsSection;
};

export function SettingsDialog(props: SettingsDialogProps) {
  const { defaultSection = "account", ...dialogProps } = props;
  return (
    <Dialog
      {...dialogProps}
      onOpenChange={(open) => props.onOpenChange?.(open)}
    >
      <DialogContent
        className="flex h-[75vh] max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 sm:max-w-5xl md:max-w-6xl"
        aria-describedby={undefined}
      >
        <SettingsLayoutProvider defaultSection={defaultSection}>
          <SettingsPageShell mode="dialog" />
        </SettingsLayoutProvider>
      </DialogContent>
    </Dialog>
  );
}
