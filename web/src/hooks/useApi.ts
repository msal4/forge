// ============================================
// React Query Hooks for API Data Fetching
// ============================================

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { issuesApi, type Issue, type CreateIssueRequest, type UpdateIssueRequest, type IssueStatusType } from '../api/issues';
import { docsApi, type Doc, type CreateDocRequest, type UpdateDocRequest } from '../api/docs';
import { releasesApi, type Release, type CreateReleaseRequest } from '../api/releases';
import { usersApi } from '../api/users';
import { workspacesApi, type CreateWorkspaceRequest } from '../api/workspaces';
import { invitesApi, type CreateInviteRequest } from '../api/invites';
import { activityApi } from '../api/activity';
import { useWorkspace } from '../context/WorkspaceContext';

// ============================================
// Query Keys
// ============================================

export const queryKeys = {
  workspaces: {
    all: ['workspaces'] as const,
    members: (workspaceId: number) => ['workspaces', workspaceId, 'members'] as const,
  },
  invites: {
    all: ['invites'] as const,
  },
  issues: {
    all: ['issues'] as const,
    list: (workspaceId: number) => [...queryKeys.issues.all, workspaceId, 'list'] as const,
    detail: (workspaceId: number, id: number) => [...queryKeys.issues.all, workspaceId, 'detail', id] as const,
    activity: (workspaceId: number, id: number) => [...queryKeys.issues.all, workspaceId, 'activity', id] as const,
  },
  docs: {
    all: ['docs'] as const,
    list: (workspaceId: number) => [...queryKeys.docs.all, workspaceId, 'list'] as const,
    detail: (workspaceId: number, id: number) => [...queryKeys.docs.all, workspaceId, 'detail', id] as const,
    activity: (workspaceId: number, id: number) => [...queryKeys.docs.all, workspaceId, 'activity', id] as const,
  },
  releases: {
    all: ['releases'] as const,
    list: (workspaceId: number) => [...queryKeys.releases.all, workspaceId, 'list'] as const,
    detail: (workspaceId: number, id: number) => [...queryKeys.releases.all, workspaceId, 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: (workspaceId: number) => [...queryKeys.users.all, workspaceId, 'list'] as const,
    allUsers: () => [...queryKeys.users.all, 'all'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
  },
};

function useWorkspaceId() {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id;
}

// ============================================
// Workspace Hooks
// ============================================

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.all,
    queryFn: () => workspacesApi.list(),
    staleTime: 60 * 1000,
  });
}

export function useWorkspaceMembers(workspaceId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId!),
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => workspacesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}

export function useSetWorkspaceMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userIds }: { workspaceId: number; userIds: number[] }) =>
      workspacesApi.setMembers(workspaceId, userIds),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list(workspaceId) });
    },
  });
}

export function useAddWorkspaceMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userIds }: { workspaceId: number; userIds: number[] }) =>
      workspacesApi.addMembers(workspaceId, userIds),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list(workspaceId) });
    },
  });
}

export function useInvites() {
  return useQuery({
    queryKey: queryKeys.invites.all,
    queryFn: () => invitesApi.list(),
    staleTime: 30 * 1000,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInviteRequest) => invitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.all });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invitesApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.all });
    },
  });
}

// ============================================
// Issues Hooks
// ============================================

export function useIssues() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.issues.list(workspaceId!),
    queryFn: () => issuesApi.list(),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useIssue(id: number | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.issues.detail(workspaceId!, id!),
    queryFn: () => issuesApi.get(id!),
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: (data: CreateIssueRequest) => issuesApi.create(data),
    onSuccess: (newIssue) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(workspaceId), (old) =>
        old ? [newIssue, ...old] : [newIssue]
      );
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIssueRequest }) =>
      issuesApi.update(id, data),
    onSuccess: (updatedIssue) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(workspaceId), (old) =>
        old?.map((i) => (i.id === updatedIssue.id ? updatedIssue : i))
      );
      queryClient.setQueryData(queryKeys.issues.detail(workspaceId, updatedIssue.id), updatedIssue);
    },
  });
}

export function useUpdateIssueStatus() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: IssueStatusType }) =>
      issuesApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      if (!workspaceId) return {};
      const listKey = queryKeys.issues.list(workspaceId);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousIssues = queryClient.getQueryData<Issue[]>(listKey);
      queryClient.setQueryData<Issue[]>(listKey, (old) =>
        old?.map((i) => (i.id === id ? { ...i, status } : i))
      );
      return { previousIssues, workspaceId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousIssues && context.workspaceId) {
        queryClient.setQueryData(queryKeys.issues.list(context.workspaceId), context.previousIssues);
      }
    },
    onSettled: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(workspaceId) });
      }
    },
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: (id: number) => issuesApi.delete(id),
    onSuccess: (_, id) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(workspaceId), (old) =>
        old?.filter((i) => i.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.issues.detail(workspaceId, id) });
    },
  });
}

// ============================================
// Docs Hooks
// ============================================

export function useDocs() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.docs.list(workspaceId!),
    queryFn: () => docsApi.list(),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useDoc(id: number | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.docs.detail(workspaceId!, id!),
    queryFn: () => docsApi.get(id!),
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateDoc() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: (data: CreateDocRequest) => docsApi.create(data),
    onSuccess: (newDoc) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Doc[]>(queryKeys.docs.list(workspaceId), (old) =>
        old ? [...old, newDoc] : [newDoc]
      );
    },
  });
}

export function useUpdateDoc() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDocRequest }) =>
      docsApi.update(id, data),
    onSuccess: (updatedDoc) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Doc[]>(queryKeys.docs.list(workspaceId), (old) =>
        old?.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
      );
      queryClient.setQueryData(queryKeys.docs.detail(workspaceId, updatedDoc.id), updatedDoc);
    },
  });
}

export function useDeleteDoc() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: (id: number) => docsApi.delete(id),
    onSuccess: (_, id) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Doc[]>(queryKeys.docs.list(workspaceId), (old) =>
        old?.filter((d) => d.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.docs.detail(workspaceId, id) });
    },
  });
}

// ============================================
// Releases Hooks
// ============================================

export function useReleases() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.releases.list(workspaceId!),
    queryFn: () => releasesApi.list(),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useRelease(id: number | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.releases.detail(workspaceId!, id!),
    queryFn: () => releasesApi.get(id!),
    enabled: !!workspaceId && !!id,
  });
}

export function useCreateRelease() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: (data: CreateReleaseRequest) => releasesApi.create(data),
    onSuccess: (newRelease) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Release[]>(queryKeys.releases.list(workspaceId), (old) =>
        old ? [newRelease, ...old] : [newRelease]
      );
    },
  });
}

export function useDeleteRelease() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: (id: number) => releasesApi.delete(id),
    onSuccess: (_, id) => {
      if (!workspaceId) return;
      queryClient.setQueryData<Release[]>(queryKeys.releases.list(workspaceId), (old) =>
        old?.filter((r) => r.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.releases.detail(workspaceId, id) });
    },
  });
}

export function useUploadReleaseFile() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ releaseId, file }: { releaseId: number; file: File }) =>
      releasesApi.uploadFile(releaseId, file),
    onSuccess: (_, { releaseId }) => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(workspaceId, releaseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.list(workspaceId) });
    },
  });
}

// ============================================
// Users Hooks
// ============================================

export function useUsers() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.users.list(workspaceId!),
    queryFn: () => usersApi.list(),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.users.allUsers(),
    queryFn: () => usersApi.listAll(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => usersApi.me(),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Activity Hooks
// ============================================

export function useIssueActivity(issueId: number | undefined) {
  const workspaceId = useWorkspaceId();
  return useInfiniteQuery({
    queryKey: queryKeys.issues.activity(workspaceId!, issueId!),
    queryFn: ({ pageParam = 0 }) =>
      activityApi.getIssueActivity(issueId!, { limit: 10, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, page) => sum + page.activities.length, 0);
    },
    enabled: !!workspaceId && !!issueId,
    staleTime: 30 * 1000,
  });
}

export function useDocActivity(docId: number | undefined) {
  const workspaceId = useWorkspaceId();
  return useInfiniteQuery({
    queryKey: queryKeys.docs.activity(workspaceId!, docId!),
    queryFn: ({ pageParam = 0 }) =>
      activityApi.getDocActivity(docId!, { limit: 10, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, page) => sum + page.activities.length, 0);
    },
    enabled: !!workspaceId && !!docId,
    staleTime: 30 * 1000,
  });
}
