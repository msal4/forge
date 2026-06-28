#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { initClient } from './client';

const workspaceSchema = z
  .string()
  .optional()
  .describe('Workspace key (e.g. FORGE, ALFA). Defaults to FORGE_WORKSPACE env.');

const createIssueSchema = z.object({
  workspace: workspaceSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.number().int().positive().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
});

const updateIssueSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['to_inscribe', 'carving', 'baked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
});

const moveIssueSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
  status: z.enum(['to_inscribe', 'carving', 'baked']).optional(),
  beforeId: z.number().int().positive().nullable().optional(),
  afterId: z.number().int().positive().nullable().optional(),
});

const setIssueStatusSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
  status: z.enum(['to_inscribe', 'carving', 'baked']),
});

const listIssueCommentsSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
});

const createIssueCommentSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
  content: z.string().min(1),
});

const getIssueActivitySchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

const listIssuesSchema = z.object({
  workspace: workspaceSchema,
  status: z.enum(['to_inscribe', 'carving', 'baked']).optional(),
  assigneeId: z.number().int().positive().optional(),
});

const getIssueSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
});

const deleteIssueSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
});

const searchSchema = z.object({
  workspace: workspaceSchema,
  query: z.string().min(1),
});

const listUsersSchema = z.object({
  workspace: workspaceSchema,
});

const listDocsSchema = z.object({
  workspace: workspaceSchema,
  parentId: z.union([z.number().int().positive(), z.literal('root')]).optional(),
});

const getDocSchema = z.object({
  workspace: workspaceSchema,
  id: z.union([z.number().int().positive(), z.string().min(1)]),
});

const createDocSchema = z.object({
  workspace: workspaceSchema,
  title: z.string().min(1),
  content: z.string().optional(),
  parentId: z.number().int().positive().optional(),
});

const updateDocSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
  title: z.string().optional(),
  content: z.string().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

const deleteDocSchema = z.object({
  workspace: workspaceSchema,
  id: z.number().int().positive(),
});

const createInviteSchema = z.object({
  username: z.string().min(1),
  fullName: z.string().optional(),
  email: z.string().optional(),
  workspace: workspaceSchema,
  workspaceKeys: z.array(z.string()).optional(),
  expiresInDays: z.union([z.literal(1), z.literal(2)]).optional(),
});

const revokeInviteSchema = z.object({
  id: z.number().int().positive(),
});

const addWorkspaceMemberSchema = z.object({
  workspace: workspaceSchema,
  userId: z.number().int().positive().optional(),
  userIds: z.array(z.number().int().positive()).optional(),
});

function collectWorkspaceKeys(args: {
  workspace?: string;
  workspaceKeys?: string[];
}, defaultKey: string): string[] {
  if (args.workspaceKeys && args.workspaceKeys.length > 0) {
    return args.workspaceKeys.map((key) => key.toUpperCase());
  }
  if (args.workspace) {
    return [args.workspace.toUpperCase()];
  }
  return [defaultKey];
}

function jsonText(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function resolveWorkspaceArg(args: { workspace?: string }, defaultKey: string): string {
  return (args.workspace ?? defaultKey).toUpperCase();
}

const workspaceProperty = {
  workspace: {
    type: 'string',
    description: 'Workspace key (e.g. FORGE, ALFA). Defaults to FORGE_WORKSPACE env.',
  },
};

async function main() {
  const { client, workspaceKey: defaultWorkspaceKey } = await initClient();

  const server = new Server(
    {
      name: 'forge',
      version: '1.3.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'forge_list_workspaces',
        description: 'List Forge workspaces the authenticated user can access.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'forge_list_users',
        description: 'List workspace members (for assignee lookup).',
        inputSchema: {
          type: 'object',
          properties: workspaceProperty,
        },
      },
      {
        name: 'forge_list_all_users',
        description: 'List all active users in Forge (admin only).',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'forge_list_issues',
        description: 'List issues in a workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            status: {
              type: 'string',
              enum: ['to_inscribe', 'carving', 'baked'],
              description: 'Filter by Kanban status',
            },
            assigneeId: {
              type: 'number',
              description: 'Filter by assignee user ID',
            },
          },
        },
      },
      {
        name: 'forge_get_issue',
        description: 'Get a single issue by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_create_issue',
        description: 'Create a new issue.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            title: { type: 'string', description: 'Issue title (required)' },
            description: { type: 'string', description: 'Markdown description' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
            assigneeId: { type: 'number', description: 'Assignee user ID' },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Label tags (e.g. bug, agent, feat)',
            },
            dueDate: {
              type: 'string',
              description: 'ISO 8601 due date',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'forge_update_issue',
        description: 'Update an existing issue.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: {
              type: 'string',
              enum: ['to_inscribe', 'carving', 'baked'],
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
            assigneeId: { type: ['number', 'null'] },
            labels: { type: 'array', items: { type: 'string' } },
            dueDate: { type: ['string', 'null'] },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_delete_issue',
        description: 'Delete an issue.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_move_issue',
        description:
          'Reorder or move an issue on the Kanban board to a position between two neighbors. Use beforeId/afterId from forge_list_issues output.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID to move' },
            status: {
              type: 'string',
              enum: ['to_inscribe', 'carving', 'baked'],
              description: 'Destination column. Omit to keep the current status (reorder in place).',
            },
            beforeId: {
              type: ['number', 'null'],
              description: 'ID of the issue that should end up directly ABOVE the moved card. Null/omit to drop at the top.',
            },
            afterId: {
              type: ['number', 'null'],
              description: 'ID of the issue that should end up directly BELOW the moved card. Null/omit to drop at the bottom.',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_set_issue_status',
        description: 'Move an issue to a different Kanban column (status only).',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
            status: {
              type: 'string',
              enum: ['to_inscribe', 'carving', 'baked'],
            },
          },
          required: ['id', 'status'],
        },
      },
      {
        name: 'forge_list_issue_comments',
        description: 'List comments on an issue.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_add_issue_comment',
        description: 'Add a comment to an issue.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
            content: { type: 'string', description: 'Comment markdown content' },
          },
          required: ['id', 'content'],
        },
      },
      {
        name: 'forge_get_issue_activity',
        description: 'Get the activity/change history for an issue.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Issue ID' },
            limit: { type: 'number', description: 'Max entries (1-100, default 10)' },
            offset: { type: 'number', description: 'Pagination offset' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_list_docs',
        description: 'List docs in a workspace, optionally filtered by parent.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            parentId: {
              oneOf: [
                { type: 'number', description: 'Parent doc ID' },
                { type: 'string', enum: ['root'], description: 'Top-level docs only' },
              ],
            },
          },
        },
      },
      {
        name: 'forge_get_doc',
        description: 'Get a doc by numeric ID or slug.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: {
              oneOf: [
                { type: 'number', description: 'Doc ID' },
                { type: 'string', description: 'Doc slug' },
              ],
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_create_doc',
        description: 'Create a new doc.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            title: { type: 'string', description: 'Doc title (required)' },
            content: { type: 'string', description: 'Markdown content' },
            parentId: { type: 'number', description: 'Parent doc ID for nesting' },
          },
          required: ['title'],
        },
      },
      {
        name: 'forge_update_doc',
        description: 'Update an existing doc.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Doc ID' },
            title: { type: 'string' },
            content: { type: 'string' },
            parentId: { type: ['number', 'null'] },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_delete_doc',
        description: 'Delete a doc.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            id: { type: 'number', description: 'Doc ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_search',
        description: 'Search issues and docs in a workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'forge_create_invite',
        description: 'Create an expiring invite link for a new user (admin only).',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username for the new user' },
            fullName: { type: 'string', description: 'Full name (optional)' },
            email: { type: 'string', description: 'Email (optional, defaults to username@sarray.de)' },
            workspace: {
              type: 'string',
              description: 'Single workspace key when workspaceKeys is omitted',
            },
            workspaceKeys: {
              type: 'array',
              items: { type: 'string' },
              description: 'Workspace keys to grant access',
            },
            expiresInDays: {
              type: 'number',
              enum: [1, 2],
              description: 'Invite validity in days (default 2)',
            },
          },
          required: ['username'],
        },
      },
      {
        name: 'forge_list_invites',
        description: 'List pending user invites (admin only).',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'forge_revoke_invite',
        description: 'Revoke a pending user invite (admin only).',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Invite ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_add_workspace_member',
        description: 'Add existing user(s) to a workspace without replacing all members (admin only).',
        inputSchema: {
          type: 'object',
          properties: {
            ...workspaceProperty,
            userId: { type: 'number', description: 'Single user ID to add' },
            userIds: {
              type: 'array',
              items: { type: 'number' },
              description: 'Multiple user IDs to add',
            },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case 'forge_list_workspaces': {
          const workspaces = await client.listWorkspaces();
          return jsonText({ defaultWorkspace: defaultWorkspaceKey, workspaces });
        }
        case 'forge_list_users': {
          const args = listUsersSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const users = await client.listUsers(ws);
          return jsonText({ workspace: ws, count: users.length, users });
        }
        case 'forge_list_all_users': {
          const users = await client.listAllUsers();
          return jsonText({ count: users.length, users });
        }
        case 'forge_list_issues': {
          const args = listIssuesSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const { workspace: _, ...filters } = args;
          const issues = await client.listIssues({ ...filters, workspaceKey: ws });
          return jsonText({ workspace: ws, count: issues.length, issues });
        }
        case 'forge_get_issue': {
          const args = getIssueSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const issue = await client.getIssue(args.id, ws);
          return jsonText({ workspace: ws, issue });
        }
        case 'forge_create_issue': {
          const args = createIssueSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const { workspace: _, ...data } = args;
          const issue = await client.createIssue(data, ws);
          return jsonText({ workspace: ws, issue });
        }
        case 'forge_update_issue': {
          const args = updateIssueSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const { workspace: _, id, ...data } = args;
          const issue = await client.updateIssue(id, data, ws);
          return jsonText({ workspace: ws, issue });
        }
        case 'forge_delete_issue': {
          const args = deleteIssueSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const result = await client.deleteIssue(args.id, ws);
          return jsonText({ workspace: ws, id: args.id, ...result });
        }
        case 'forge_move_issue': {
          const args = moveIssueSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const status = args.status ?? (await client.getIssue(args.id, ws)).status;
          const issue = await client.moveIssue(
            args.id,
            { status, beforeId: args.beforeId, afterId: args.afterId },
            ws
          );
          return jsonText({ workspace: ws, issue });
        }
        case 'forge_set_issue_status': {
          const args = setIssueStatusSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const issue = await client.setIssueStatus(args.id, args.status, ws);
          return jsonText({ workspace: ws, issue });
        }
        case 'forge_list_issue_comments': {
          const args = listIssueCommentsSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const comments = await client.listIssueComments(args.id, ws);
          return jsonText({ workspace: ws, count: comments.length, comments });
        }
        case 'forge_add_issue_comment': {
          const args = createIssueCommentSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const comment = await client.createIssueComment(args.id, args.content, ws);
          return jsonText({ workspace: ws, comment });
        }
        case 'forge_get_issue_activity': {
          const args = getIssueActivitySchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const activity = await client.getIssueActivity(
            args.id,
            { limit: args.limit, offset: args.offset },
            ws
          );
          return jsonText({ workspace: ws, ...activity });
        }
        case 'forge_list_docs': {
          const args = listDocsSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const { workspace: _, parentId } = args;
          const docs = await client.listDocs({ parentId, workspaceKey: ws });
          return jsonText({ workspace: ws, count: docs.length, docs });
        }
        case 'forge_get_doc': {
          const args = getDocSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const doc = await client.getDoc(args.id, ws);
          return jsonText({ workspace: ws, doc });
        }
        case 'forge_create_doc': {
          const args = createDocSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const { workspace: _, ...data } = args;
          const doc = await client.createDoc(data, ws);
          return jsonText({ workspace: ws, doc });
        }
        case 'forge_update_doc': {
          const args = updateDocSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const { workspace: _, id, ...data } = args;
          const doc = await client.updateDoc(id, data, ws);
          return jsonText({ workspace: ws, doc });
        }
        case 'forge_delete_doc': {
          const args = deleteDocSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const result = await client.deleteDoc(args.id, ws);
          return jsonText({ workspace: ws, id: args.id, ...result });
        }
        case 'forge_search': {
          const args = searchSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const results = await client.search(args.query, ws);
          return jsonText({ workspace: ws, ...results });
        }
        case 'forge_create_invite': {
          const args = createInviteSchema.parse(request.params.arguments ?? {});
          const workspaceKeys = collectWorkspaceKeys(args, defaultWorkspaceKey);
          const invite = await client.createInvite({
            username: args.username,
            fullName: args.fullName,
            email: args.email,
            workspaceKeys,
            expiresInDays: args.expiresInDays,
          });
          return jsonText({ invite });
        }
        case 'forge_list_invites': {
          const invites = await client.listInvites();
          return jsonText({ count: invites.length, invites });
        }
        case 'forge_revoke_invite': {
          const args = revokeInviteSchema.parse(request.params.arguments ?? {});
          const result = await client.revokeInvite(args.id);
          return jsonText({ id: args.id, ...result });
        }
        case 'forge_add_workspace_member': {
          const args = addWorkspaceMemberSchema.parse(request.params.arguments ?? {});
          const ws = resolveWorkspaceArg(args, defaultWorkspaceKey);
          const userIds = [...(args.userIds ?? [])];
          if (args.userId) userIds.push(args.userId);
          if (userIds.length === 0) {
            throw new Error('userId or userIds is required');
          }
          const members = await client.addWorkspaceMembers(ws, userIds);
          return jsonText({ workspace: ws, count: members.length, members });
        }
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[forge-mcp]', error instanceof Error ? error.message : error);
  process.exit(1);
});
