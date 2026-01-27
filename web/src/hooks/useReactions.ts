import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../context/WebSocketContext';
import { usersApi } from '../api/users';
import {
  reactionsApi,
  groupReactions,
  type ReactionTarget,
  type Reaction,
  type ReactionSummary,
} from '../api/reactions';

// ============================================
// useReactions Hook
// Manages reactions for any entity type with real-time updates
// ============================================

interface UseReactionsOptions {
  /** Entity target for reactions */
  target: ReactionTarget;
  /** Enable the query */
  enabled?: boolean;
}

interface UseReactionsReturn {
  /** Grouped reaction summaries */
  reactions: ReactionSummary[];
  /** Raw reactions list */
  rawReactions: Reaction[];
  /** Is loading reactions */
  isLoading: boolean;
  /** Is toggling a reaction */
  isToggling: boolean;
  /** Toggle a reaction (add/remove) */
  toggle: (emoji: string) => void;
  /** Error if any */
  error: Error | null;
}

/**
 * Hook to manage reactions for any entity
 * 
 * @example
 * // For an issue
 * const { reactions, toggle } = useReactions({ 
 *   target: { type: 'issue', id: issueId } 
 * });
 * 
 * // For an issue comment
 * const { reactions, toggle } = useReactions({
 *   target: { type: 'issue_comment', issueId, commentId }
 * });
 */
export function useReactions({
  target,
  enabled = true,
}: UseReactionsOptions): UseReactionsReturn {
  const queryClient = useQueryClient();
  const { lastEvent } = useWebSocket();

  // Build query key based on target
  const queryKey = React.useMemo(() => {
    switch (target.type) {
      case 'issue':
        return ['reactions', 'issue', target.id];
      case 'doc':
        return ['reactions', 'doc', target.id];
      case 'release':
        return ['reactions', 'release', target.id];
      case 'issue_comment':
        return ['reactions', 'issue_comment', target.issueId, target.commentId];
      case 'doc_comment':
        return ['reactions', 'doc_comment', target.docId, target.commentId];
      case 'release_comment':
        return ['reactions', 'release_comment', target.releaseId, target.commentId];
    }
  }, [target]);

  // Fetch current user for determining "reacted" status
  const { data: currentUser } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.me(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch reactions
  const {
    data: rawReactions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => reactionsApi.list(target),
    enabled: enabled && isValidTarget(target),
  });

  // Group reactions into summaries
  const reactions = React.useMemo(
    () => groupReactions(rawReactions, currentUser?.id),
    [rawReactions, currentUser?.id]
  );

  // Toggle mutation with optimistic update
  const toggleMutation = useMutation({
    mutationFn: (emoji: string) => reactionsApi.toggle(target, emoji),
    onMutate: async (emoji) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousReactions = queryClient.getQueryData<Reaction[]>(queryKey);

      // Optimistically update
      if (previousReactions && currentUser) {
        const existingIndex = previousReactions.findIndex(
          r => r.userId === currentUser.id && r.emoji === emoji
        );

        let newReactions: Reaction[];
        if (existingIndex >= 0) {
          // Remove reaction
          newReactions = [
            ...previousReactions.slice(0, existingIndex),
            ...previousReactions.slice(existingIndex + 1),
          ];
        } else {
          // Add reaction
          newReactions = [
            ...previousReactions,
            {
              id: -Date.now(), // Temporary ID
              userId: currentUser.id,
              user: currentUser,
              emoji,
              createdAt: new Date().toISOString(),
              ...getTargetFields(target),
            } as Reaction,
          ];
        }

        queryClient.setQueryData(queryKey, newReactions);
      }

      return { previousReactions };
    },
    onError: (_err, _emoji, context) => {
      // Rollback on error
      if (context?.previousReactions) {
        queryClient.setQueryData(queryKey, context.previousReactions);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Listen for WebSocket events
  const lastEventRef = React.useRef(lastEvent);
  React.useEffect(() => {
    if (lastEvent === lastEventRef.current) return;
    lastEventRef.current = lastEvent;

    if (!lastEvent) return;

    if (lastEvent.type === 'reaction_added' || lastEvent.type === 'reaction_removed') {
      const data = lastEvent.data as Record<string, unknown> | undefined;
      
      // Check if event matches this target
      if (matchesTarget(target, data)) {
        queryClient.invalidateQueries({ queryKey });
      }
    }
  }, [lastEvent, target, queryClient, queryKey]);

  return {
    reactions,
    rawReactions,
    isLoading,
    isToggling: toggleMutation.isPending,
    toggle: toggleMutation.mutate,
    error: error as Error | null,
  };
}

// ============================================
// Helper functions
// ============================================

function isValidTarget(target: ReactionTarget): boolean {
  switch (target.type) {
    case 'issue':
    case 'doc':
    case 'release':
      return target.id > 0;
    case 'issue_comment':
      return target.issueId > 0 && target.commentId > 0;
    case 'doc_comment':
      return target.docId > 0 && target.commentId > 0;
    case 'release_comment':
      return target.releaseId > 0 && target.commentId > 0;
  }
}

function getTargetFields(target: ReactionTarget): Partial<Reaction> {
  switch (target.type) {
    case 'issue':
      return { issueId: target.id };
    case 'doc':
      return { docId: target.id };
    case 'release':
      return { releaseId: target.id };
    case 'issue_comment':
      return { issueCommentId: target.commentId };
    case 'doc_comment':
      return { docCommentId: target.commentId };
    case 'release_comment':
      return { releaseCommentId: target.commentId };
  }
}

function matchesTarget(target: ReactionTarget, data?: Record<string, unknown>): boolean {
  if (!data) return false;

  switch (target.type) {
    case 'issue':
      return data.issueId === target.id && !data.issueCommentId;
    case 'doc':
      return data.docId === target.id && !data.docCommentId;
    case 'release':
      return data.releaseId === target.id && !data.releaseCommentId;
    case 'issue_comment':
      return data.issueId === target.issueId && data.issueCommentId === target.commentId;
    case 'doc_comment':
      return data.docId === target.docId && data.docCommentId === target.commentId;
    case 'release_comment':
      return data.releaseId === target.releaseId && data.releaseCommentId === target.commentId;
  }
}

export default useReactions;
