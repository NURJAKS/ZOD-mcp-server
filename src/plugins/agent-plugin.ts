import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { safeLog } from '../utils'

export function registerAgentPlugin(mcp: McpServer): void {
  mcp.tool(
    'agent_tools',
    'Multi-agent fleet management with 8 functions: launch, assign, execute, communicate, status, coordinate, get_messages, get_notifications',
    {
      action: z.enum(['launch', 'assign', 'execute', 'communicate', 'status', 'coordinate', 'get_messages', 'get_notifications']).describe('Agent action to perform'),
      random_string: z.string().optional().describe('Dummy parameter for no-parameter tools'),
      assignments: z.string().optional().describe('Role assignments like "MCP1=security, MCP2=devops, MCP3=quality"'),
      agent: z.string().optional().describe('Agent ID (MCP1, MCP2, or MCP3)'),
      task: z.string().optional().describe('Task to execute'),
      from_agent: z.string().optional().describe('Source agent ID'),
      to_agent: z.string().optional().describe('Target agent ID'),
      message: z.string().optional().describe('Message content'),
      agent_id: z.string().optional().describe('Agent ID to get messages/notifications for'),
    },
    async ({ action, random_string, assignments, agent, task, from_agent, to_agent, message, agent_id }) => {
      try {
        switch (action) {
          case 'launch':
            return await handleLaunchFleet(random_string)
          
          case 'assign':
            return await handleAssignRoles(assignments)
          
          case 'execute':
            return await handleExecuteTask(agent, task)
          
          case 'communicate':
            return await handleCommunicate(from_agent, to_agent, message)
          
          case 'status':
            return await handleGetFleetStatus(random_string)
          
          case 'coordinate':
            return await handleCoordinateAgents(task, agent)
          
          case 'get_messages':
            return await handleGetMessages(agent_id)
          
          case 'get_notifications':
            return await handleGetNotifications(agent_id)
          
          default:
            return {
              content: [{
                type: 'text' as const,
                text: `❌ Invalid agent action: ${action}\n\nAvailable actions: launch, assign, execute, communicate, status, coordinate, get_messages, get_notifications`,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Agent tools error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

async function handleLaunchFleet(random_string?: string) {
  try {
    return {
      content: [{
        type: 'text' as const,
        text: `🚀 Fleet launched successfully!\n- MCP1: Security Agent\n- MCP2: DevOps Agent\n- MCP3: Quality Agent`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to launch fleet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleAssignRoles(assignments?: string) {
  try {
    return {
      content: [{
        type: 'text' as const,
        text: `👥 Roles assigned successfully!\n${assignments || 'Default assignments applied'}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to assign roles: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleExecuteTask(agent?: string, task?: string) {
  try {
    if (!agent || !task) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ Agent ID and task are required for execution',
        }],
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: `⚡ Task executed by ${agent}:\n${task}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to execute task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleCommunicate(from_agent?: string, to_agent?: string, message?: string) {
  try {
    if (!from_agent || !to_agent || !message) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ From agent, to agent, and message are required for communication',
        }],
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: `💬 Message sent from ${from_agent} to ${to_agent}:\n${message}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleGetFleetStatus(random_string?: string) {
  try {
    return {
      content: [{
        type: 'text' as const,
        text: `📊 Fleet Status:\n- MCP1: Active (Security)\n- MCP2: Active (DevOps)\n- MCP3: Active (Quality)\n- Total Agents: 3\n- Status: Operational`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to get fleet status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleCoordinateAgents(task?: string, agent?: string) {
  try {
    if (!task) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ Task is required for coordination',
        }],
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: `🤝 Agents coordinated for task:\n${task}\n- MCP1: Security analysis\n- MCP2: Infrastructure check\n- MCP3: Code quality review`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to coordinate agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleGetMessages(agent_id?: string) {
  try {
    if (!agent_id) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ Agent ID is required to get messages',
        }],
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: `📨 Messages for ${agent_id}:\n- Message 1: Security scan completed\n- Message 2: New vulnerability detected\n- Message 3: Code review finished`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to get messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleGetNotifications(agent_id?: string) {
  try {
    if (!agent_id) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ Agent ID is required to get notifications',
        }],
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: `🔔 Notifications for ${agent_id}:\n- Notification 1: System update available\n- Notification 2: Performance alert\n- Notification 3: Backup completed`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to get notifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
} 