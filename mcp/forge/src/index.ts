#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { initClient } from './client';

const createIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.number().int().positive().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
});

const updateIssueSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['to_inscribe', 'carving', 'baked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
});

const listIssuesSchema = z.object({
  status: z.enum(['to_inscribe', 'carving', 'baked']).optional(),
  assigneeId: z.number().int().positive().optional(),
});

const getIssueSchema = z.object({
  id: z.number().int().positive(),
});

const searchSchema = z.object({
  query: z.string().min(1),
});

function jsonText(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function main() {
  const { client, workspaceKey } = await initClient();

  const server = new Server(
    {
      name: 'forge',
      version: '1.0.0',
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
        name: 'forge_list_issues',
        description: 'List issues in the configured workspace.',
        inputSchema: {
          type: 'object',
          properties: {
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
        description: 'Get a single issue by ID from the configured workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Issue ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_create_issue',
        description: 'Create a new issue in the configured workspace.',
        inputSchema: {
          type: 'object',
          properties: {
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
        description: 'Update an existing issue in the configured workspace.',
        inputSchema: {
          type: 'object',
          properties: {
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
        name: 'forge_search',
        description: 'Search issues and docs in the configured workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case 'forge_list_workspaces': {
          const workspaces = await client.listWorkspaces();
          return jsonText({ activeWorkspace: workspaceKey, workspaces });
        }
        case 'forge_list_issues': {
          const args = listIssuesSchema.parse(request.params.arguments ?? {});
          const issues = await client.listIssues(args);
          return jsonText({ workspace: workspaceKey, count: issues.length, issues });
        }
        case 'forge_get_issue': {
          const args = getIssueSchema.parse(request.params.arguments ?? {});
          const issue = await client.getIssue(args.id);
          return jsonText(issue);
        }
        case 'forge_create_issue': {
          const args = createIssueSchema.parse(request.params.arguments ?? {});
          const issue = await client.createIssue(args);
          return jsonText(issue);
        }
        case 'forge_update_issue': {
          const args = updateIssueSchema.parse(request.params.arguments ?? {});
          const { id, ...data } = args;
          const issue = await client.updateIssue(id, data);
          return jsonText(issue);
        }
        case 'forge_search': {
          const args = searchSchema.parse(request.params.arguments ?? {});
          const results = await client.search(args.query);
          return jsonText(results);
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
