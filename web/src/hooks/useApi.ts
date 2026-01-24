// ============================================
// React Query Hooks for API Data Fetching
// ============================================

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { issuesApi, type Issue, type CreateIssueRequest, type UpdateIssueRequest, type IssueStatusType } from '../api/issues';
import { docsApi, type Doc, type CreateDocRequest, type UpdateDocRequest } from '../api/docs';
import { releasesApi, type Release, type CreateReleaseRequest } from '../api/releases';
import { usersApi } from '../api/users';
import { activityApi } from '../api/activity';

// ============================================
// Query Keys
// ============================================

export const queryKeys = {
  issues: {
    all: ['issues'] as const,
    list: () => [...queryKeys.issues.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.issues.all, 'detail', id] as const,
    activity: (id: number) => [...queryKeys.issues.all, 'activity', id] as const,
  },
  docs: {
    all: ['docs'] as const,
    list: () => [...queryKeys.docs.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.docs.all, 'detail', id] as const,
    activity: (id: number) => [...queryKeys.docs.all, 'activity', id] as const,
  },
  releases: {
    all: ['releases'] as const,
    list: () => [...queryKeys.releases.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.releases.all, 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
  },
};

// ============================================
// Issues Hooks
// ============================================

export function useIssues() {
  return useQuery({
    queryKey: queryKeys.issues.list(),
    queryFn: () => issuesApi.list(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useIssue(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.detail(id!),
    queryFn: () => issuesApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateIssueRequest) => issuesApi.create(data),
    onSuccess: (newIssue) => {
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(), (old) => 
        old ? [newIssue, ...old] : [newIssue]
      );
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIssueRequest }) => 
      issuesApi.update(id, data),
    onSuccess: (updatedIssue) => {
      // Update in list
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(), (old) =>
        old?.map((i) => (i.id === updatedIssue.id ? updatedIssue : i))
      );
      // Update individual cache
      queryClient.setQueryData(queryKeys.issues.detail(updatedIssue.id), updatedIssue);
    },
  });
}

export function useUpdateIssueStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: IssueStatusType }) =>
      issuesApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: queryKeys.issues.list() });
      
      // Snapshot previous value
      const previousIssues = queryClient.getQueryData<Issue[]>(queryKeys.issues.list());
      
      // Optimistically update
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(), (old) =>
        old?.map((i) => (i.id === id ? { ...i, status } : i))
      );
      
      return { previousIssues };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousIssues) {
        queryClient.setQueryData(queryKeys.issues.list(), context.previousIssues);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list() });
    },
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => issuesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Issue[]>(queryKeys.issues.list(), (old) =>
        old?.filter((i) => i.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.issues.detail(id) });
    },
  });
}

// ============================================
// Docs Hooks
// ============================================

export function useDocs() {
  return useQuery({
    queryKey: queryKeys.docs.list(),
    queryFn: () => docsApi.list(),
    staleTime: 30 * 1000,
  });
}

export function useDoc(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.docs.detail(id!),
    queryFn: () => docsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateDoc() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateDocRequest) => docsApi.create(data),
    onSuccess: (newDoc) => {
      queryClient.setQueryData<Doc[]>(queryKeys.docs.list(), (old) =>
        old ? [...old, newDoc] : [newDoc]
      );
    },
  });
}

export function useUpdateDoc() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDocRequest }) =>
      docsApi.update(id, data),
    onSuccess: (updatedDoc) => {
      queryClient.setQueryData<Doc[]>(queryKeys.docs.list(), (old) =>
        old?.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
      );
      queryClient.setQueryData(queryKeys.docs.detail(updatedDoc.id), updatedDoc);
    },
  });
}

export function useDeleteDoc() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => docsApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Doc[]>(queryKeys.docs.list(), (old) =>
        old?.filter((d) => d.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.docs.detail(id) });
    },
  });
}

// ============================================
// Releases Hooks
// ============================================

export function useReleases() {
  return useQuery({
    queryKey: queryKeys.releases.list(),
    queryFn: () => releasesApi.list(),
    staleTime: 30 * 1000,
  });
}

export function useRelease(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.releases.detail(id!),
    queryFn: () => releasesApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateRelease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateReleaseRequest) => releasesApi.create(data),
    onSuccess: (newRelease) => {
      queryClient.setQueryData<Release[]>(queryKeys.releases.list(), (old) =>
        old ? [newRelease, ...old] : [newRelease]
      );
    },
  });
}

export function useDeleteRelease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => releasesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Release[]>(queryKeys.releases.list(), (old) =>
        old?.filter((r) => r.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.releases.detail(id) });
    },
  });
}

export function useUploadReleaseFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ releaseId, file }: { releaseId: number; file: File }) =>
      releasesApi.uploadFile(releaseId, file),
    onSuccess: (_, { releaseId }) => {
      // Invalidate the release detail to refresh file list
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(releaseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.list() });
    },
  });
}

// ============================================
// Users Hooks
// ============================================

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => usersApi.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes - users don't change often
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
  return useInfiniteQuery({
    queryKey: queryKeys.issues.activity(issueId!),
    queryFn: ({ pageParam = 0 }) => 
      activityApi.getIssueActivity(issueId!, { limit: 10, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      // Calculate total items loaded so far
      const totalLoaded = allPages.reduce((sum, page) => sum + page.activities.length, 0);
      return totalLoaded;
    },
    enabled: !!issueId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useDocActivity(docId: number | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.docs.activity(docId!),
    queryFn: ({ pageParam = 0 }) => 
      activityApi.getDocActivity(docId!, { limit: 10, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const totalLoaded = allPages.reduce((sum, page) => sum + page.activities.length, 0);
      return totalLoaded;
    },
    enabled: !!docId,
    staleTime: 30 * 1000,
  });
}
