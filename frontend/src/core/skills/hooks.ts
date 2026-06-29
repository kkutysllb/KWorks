import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addSkillToWorkMode,
  createWorkMode,
  deleteWorkMode,
  deleteSkill,
  enableSkill,
  loadSkills,
  loadWorkModeSkills,
  loadWorkModes,
  registerSkill,
  removeSkillFromWorkMode,
  updateWorkMode,
  unregisterSkill,
} from "./api";
import type { WorkModeUpdateRequest, WorkModeWriteRequest } from "./type";

export function useSkills() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["skills"],
    queryFn: () => loadSkills(),
  });
  return { skills: data ?? [], isLoading, error };
}

export function useWorkModes() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["work-modes"],
    queryFn: () => loadWorkModes(),
  });
  return {
    defaultModeId: data?.defaultModeId ?? "task",
    lockedSkillIds: data?.lockedSkillIds ?? [],
    workModes: data?.workModes ?? [],
    isLoading,
    error,
  };
}

export function useWorkModeSkills(workModeId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["work-mode-skills", workModeId],
    queryFn: () => loadWorkModeSkills(workModeId ?? "task"),
    enabled: Boolean(workModeId),
  });
  return { skills: data ?? [], isLoading, error };
}

export function useEnableSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      skillName,
      enabled,
    }: {
      skillName: string;
      enabled: boolean;
    }) => {
      await enableSkill(skillName, enabled);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

function useSkillLifecycleMutation(
  action: (skillName: string) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

export function useRegisterSkill() {
  return useSkillLifecycleMutation(registerSkill);
}

export function useUnregisterSkill() {
  return useSkillLifecycleMutation(unregisterSkill);
}

export function useDeleteSkill() {
  return useSkillLifecycleMutation(deleteSkill);
}

type WorkModeSkillMutationInput = {
  workModeId: string;
  skillId: string;
};

function invalidateWorkModeSkillQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workModeId: string,
) {
  void queryClient.invalidateQueries({ queryKey: ["work-modes"] });
  void queryClient.invalidateQueries({
    queryKey: ["work-mode-skills", workModeId],
  });
  void queryClient.invalidateQueries({ queryKey: ["skills"] });
}

export function useAddSkillToWorkMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workModeId, skillId }: WorkModeSkillMutationInput) =>
      addSkillToWorkMode(workModeId, skillId),
    onSuccess: (_workMode, { workModeId }) => {
      invalidateWorkModeSkillQueries(queryClient, workModeId);
    },
  });
}

export function useRemoveSkillFromWorkMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workModeId, skillId }: WorkModeSkillMutationInput) =>
      removeSkillFromWorkMode(workModeId, skillId),
    onSuccess: (_workMode, { workModeId }) => {
      invalidateWorkModeSkillQueries(queryClient, workModeId);
    },
  });
}

export function useCreateWorkMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: WorkModeWriteRequest) => createWorkMode(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["work-modes"] });
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

export function useUpdateWorkMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workModeId,
      request,
    }: {
      workModeId: string;
      request: WorkModeUpdateRequest;
    }) => updateWorkMode(workModeId, request),
    onSuccess: (_workMode, { workModeId }) => {
      invalidateWorkModeSkillQueries(queryClient, workModeId);
    },
  });
}

export function useDeleteWorkMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workModeId: string) => deleteWorkMode(workModeId),
    onSuccess: (_result, workModeId) => {
      void queryClient.invalidateQueries({ queryKey: ["work-modes"] });
      void queryClient.invalidateQueries({
        queryKey: ["work-mode-skills", workModeId],
      });
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
