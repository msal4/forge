// ============================================
// Reactions API
// ============================================

import { api, type RequestOptions } from './client';
import type { User } from './users';

// Allowed emoji set (GitHub-style)
export const REACTION_EMOJIS = ['👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

// Reaction type
export interface Reaction {
  id: number;
  userId: number;
  user?: User;
  emoji: string;
  issueId?: number;
  docId?: number;
  releaseId?: number;
  issueCommentId?: number;
  docCommentId?: number;
  releaseCommentId?: number;
  createdAt: string;
}

// Toggle reaction response
export interface ToggleReactionResponse {
  added: boolean;
  reaction?: Reaction;
}

// Reaction summary for UI display
export interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: number[];
  users: User[];
  reacted: boolean; // Did current user react?
}

// Target types for reactions
export type ReactionTarget =
  | { type: 'issue'; id: number }
  | { type: 'doc'; id: number }
  | { type: 'release'; id: number }
  | { type: 'issue_comment'; issueId: number; commentId: number }
  | { type: 'doc_comment'; docId: number; commentId: number }
  | { type: 'release_comment'; releaseId: number; commentId: number };

// Helper to build endpoint from target
function getEndpoint(target: ReactionTarget): string {
  switch (target.type) {
    case 'issue':
      return `/issues/${target.id}/reactions`;
    case 'doc':
      return `/docs/${target.id}/reactions`;
    case 'release':
      return `/releases/${target.id}/reactions`;
    case 'issue_comment':
      return `/issues/${target.issueId}/comments/${target.commentId}/reactions`;
    case 'doc_comment':
      return `/docs/${target.docId}/comments/${target.commentId}/reactions`;
    case 'release_comment':
      return `/releases/${target.releaseId}/comments/${target.commentId}/reactions`;
  }
}

// API functions
export const reactionsApi = {
  // List all reactions for a target
  list: (target: ReactionTarget, options?: RequestOptions) =>
    api.get<Reaction[]>(getEndpoint(target), options),

  // Toggle a reaction (add if not exists, remove if exists)
  toggle: (target: ReactionTarget, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(getEndpoint(target), { emoji }, options),

  // ============================================
  // Direct methods for each entity type
  // (Alternative to using target objects)
  // ============================================

  // Issue reactions
  listForIssue: (issueId: number, options?: RequestOptions) =>
    api.get<Reaction[]>(`/issues/${issueId}/reactions`, options),

  toggleForIssue: (issueId: number, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(`/issues/${issueId}/reactions`, { emoji }, options),

  // Doc reactions
  listForDoc: (docId: number, options?: RequestOptions) =>
    api.get<Reaction[]>(`/docs/${docId}/reactions`, options),

  toggleForDoc: (docId: number, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(`/docs/${docId}/reactions`, { emoji }, options),

  // Release reactions
  listForRelease: (releaseId: number, options?: RequestOptions) =>
    api.get<Reaction[]>(`/releases/${releaseId}/reactions`, options),

  toggleForRelease: (releaseId: number, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(`/releases/${releaseId}/reactions`, { emoji }, options),

  // Issue comment reactions
  listForIssueComment: (issueId: number, commentId: number, options?: RequestOptions) =>
    api.get<Reaction[]>(`/issues/${issueId}/comments/${commentId}/reactions`, options),

  toggleForIssueComment: (issueId: number, commentId: number, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(`/issues/${issueId}/comments/${commentId}/reactions`, { emoji }, options),

  // Doc comment reactions
  listForDocComment: (docId: number, commentId: number, options?: RequestOptions) =>
    api.get<Reaction[]>(`/docs/${docId}/comments/${commentId}/reactions`, options),

  toggleForDocComment: (docId: number, commentId: number, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(`/docs/${docId}/comments/${commentId}/reactions`, { emoji }, options),

  // Release comment reactions
  listForReleaseComment: (releaseId: number, commentId: number, options?: RequestOptions) =>
    api.get<Reaction[]>(`/releases/${releaseId}/comments/${commentId}/reactions`, options),

  toggleForReleaseComment: (releaseId: number, commentId: number, emoji: string, options?: RequestOptions) =>
    api.post<ToggleReactionResponse>(`/releases/${releaseId}/comments/${commentId}/reactions`, { emoji }, options),
};

// ============================================
// Helper functions for UI
// ============================================

/**
 * Group reactions into summaries for UI display
 * @param reactions - Array of reactions from API
 * @param currentUserId - Current user's ID to determine "reacted" status
 * @returns Array of reaction summaries grouped by emoji
 */
export function groupReactions(reactions: Reaction[], currentUserId?: number): ReactionSummary[] {
  const groups = new Map<string, { users: User[]; userIds: number[] }>();

  for (const reaction of reactions) {
    const existing = groups.get(reaction.emoji);
    if (existing) {
      existing.userIds.push(reaction.userId);
      if (reaction.user) {
        existing.users.push(reaction.user);
      }
    } else {
      groups.set(reaction.emoji, {
        userIds: [reaction.userId],
        users: reaction.user ? [reaction.user] : [],
      });
    }
  }

  const summaries: ReactionSummary[] = [];
  for (const [emoji, { users, userIds }] of groups) {
    summaries.push({
      emoji,
      count: userIds.length,
      userIds,
      users,
      reacted: currentUserId ? userIds.includes(currentUserId) : false,
    });
  }

  // Sort by count descending, then by emoji order
  summaries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return REACTION_EMOJIS.indexOf(a.emoji as ReactionEmoji) - REACTION_EMOJIS.indexOf(b.emoji as ReactionEmoji);
  });

  return summaries;
}
