"use client";

import {
  BoxIcon,
  BrainIcon,
  CpuIcon,
  DatabaseIcon,
  GlobeIcon,
  NetworkIcon,
  PaletteIcon,
  RadioTowerIcon,
  SparklesIcon,
  UserIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { type ConfigPage } from "@/components/workspace/settings/config-settings-page";
import { useI18n } from "@/core/i18n/hooks";

export type SettingsSection =
  | "account"
  | "appearance"
  | "qiongqi-models"
  | "qiongqi-context"
  | "qiongqi-storage"
  | "qiongqi-observability"
  | "qiongqi-mcp"
  | "qiongqi-web"
  | "qiongqi-skills"
  | "work-modes"
  | "qiongqi-subagents";

export type QiongqiSettingsSection = Extract<
  SettingsSection,
  `qiongqi-${string}`
>;

export type SettingsSectionItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
};

type SettingsLayoutState = {
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  sections: SettingsSectionItem[];
};

const SettingsLayoutContext = createContext<SettingsLayoutState | null>(null);

const KNOWN_SECTIONS: SettingsSection[] = [
  "account",
  "appearance",
  "qiongqi-models",
  "qiongqi-context",
  "qiongqi-storage",
  "qiongqi-observability",
  "qiongqi-mcp",
  "qiongqi-web",
  "qiongqi-skills",
  "work-modes",
  "qiongqi-subagents",
];

export const QIONGQI_SECTION_PAGE: Record<QiongqiSettingsSection, ConfigPage> =
  {
    "qiongqi-models": "models",
    "qiongqi-context": "contextCompaction",
    "qiongqi-storage": "storage",
    "qiongqi-observability": "observability",
    "qiongqi-mcp": "mcp",
    "qiongqi-web": "web",
    "qiongqi-skills": "skills",
    "qiongqi-subagents": "subagents",
  };

export const SETTINGS_SECTION_COLORS: Record<
  SettingsSection,
  { iconActive: string; bar: string; bg: string }
> = {
  account: {
    iconActive: "text-sky-400",
    bar: "from-sky-400 to-blue-500",
    bg: "bg-sky-500/10",
  },
  appearance: {
    iconActive: "text-violet-400",
    bar: "from-violet-400 to-purple-500",
    bg: "bg-violet-500/10",
  },
  "qiongqi-models": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "qiongqi-context": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "qiongqi-storage": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "qiongqi-observability": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "qiongqi-mcp": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "qiongqi-web": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "qiongqi-skills": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
  "work-modes": {
    iconActive: "text-amber-400",
    bar: "from-amber-400 to-orange-500",
    bg: "bg-amber-500/10",
  },
  "qiongqi-subagents": {
    iconActive: "text-cyan-400",
    bar: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-500/10",
  },
};

export function isQiongqiSection(
  section: SettingsSection,
): section is QiongqiSettingsSection {
  return section.startsWith("qiongqi-");
}

export function parseSettingsSection(
  value: string | null | undefined,
): SettingsSection | null {
  if (!value) return null;
  const normalized = value.replace(/^#/, "");
  return KNOWN_SECTIONS.includes(normalized as SettingsSection)
    ? (normalized as SettingsSection)
    : null;
}

function useSettingsSections(): SettingsSectionItem[] {
  const { t } = useI18n();

  return useMemo(() => {
    const base: SettingsSectionItem[] = [
      {
        id: "account",
        label: t.settings.sections.account,
        icon: UserIcon,
      },
      {
        id: "appearance",
        label: t.settings.sections.appearance,
        icon: PaletteIcon,
      },
      { id: "qiongqi-models", label: "模型 Profiles", icon: CpuIcon },
      { id: "qiongqi-context", label: "上下文压缩", icon: BrainIcon },
      { id: "qiongqi-storage", label: "存储", icon: DatabaseIcon },
      { id: "qiongqi-observability", label: "观测", icon: RadioTowerIcon },
      { id: "qiongqi-mcp", label: "MCP", icon: NetworkIcon },
      { id: "qiongqi-web", label: "Web 能力", icon: GlobeIcon },
      { id: "qiongqi-skills", label: "技能", icon: SparklesIcon },
      { id: "work-modes", label: "工作模式", icon: WorkflowIcon },
      { id: "qiongqi-subagents", label: "智能体协作", icon: BoxIcon },
    ];
    return base;
  }, [
    t.settings.sections.account,
    t.settings.sections.appearance,
  ]);
}

export function SettingsLayoutProvider({
  children,
  defaultSection = "account",
  syncHash = false,
}: {
  children: ReactNode;
  defaultSection?: SettingsSection;
  syncHash?: boolean;
}) {
  const sections = useSettingsSections();
  const [activeSection, setActiveSectionState] =
    useState<SettingsSection>(defaultSection);

  useEffect(() => {
    const sectionFromHash =
      syncHash && typeof window !== "undefined"
        ? parseSettingsSection(window.location.hash)
        : null;
    setActiveSectionState(sectionFromHash ?? defaultSection);
  }, [defaultSection, syncHash]);

  const setActiveSection = useCallback((section: SettingsSection) => {
    setActiveSectionState(section);
    if (syncHash && typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${section}`);
    }
  }, [syncHash]);

  const value = useMemo(
    () => ({ activeSection, setActiveSection, sections }),
    [activeSection, sections, setActiveSection],
  );

  return (
    <SettingsLayoutContext.Provider value={value}>
      {children}
    </SettingsLayoutContext.Provider>
  );
}

export function useSettingsLayout() {
  const context = useContext(SettingsLayoutContext);
  if (!context) {
    throw new Error(
      "useSettingsLayout must be used within a SettingsLayoutProvider.",
    );
  }
  return context;
}
