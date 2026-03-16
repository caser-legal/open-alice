/**
 * Test heartbeat functionality
 */

import { AgentCenter } from './src/core/agent-center.ts';
import { VercelAIProvider } from './src/ai-providers/vercel-ai-sdk/vercel-provider.ts';
import { ToolCenter } from './src/core/tool-center.ts';
import { Brain } from './src/extension/brain/index.ts';
import { SessionStore } from './src/core/session.ts';

async function testHeartbeat() {
  console.log('Testing heartbeat functionality...');

  try {
    // Create required components
    const toolCenter = new ToolCenter();
    const brain = new Brain({ onCommit: () => {} });
    const session = new SessionStore('heartbeat-test');

    // Create agent center
    const agentCenter = new AgentCenter({
      router: new VercelAIProvider(
        () => toolCenter.getVercelTools(),
        'Test instructions',
        5
      ),
      compaction: { enabled: false },
    });

    // Test asking the agent
    const result = await agentCenter.askWithSession(
      `Read data/brain/heartbeat.md (or data/default/heartbeat.default.md if not found) and follow the instructions inside. Check for any market opportunities and report using the proper format: STATUS: HEARTBEAT_OK | CHAT_YES, REASON: <brief explanation>, CONTENT: <detailed analysis>.`,
      session
    );

    console.log('Agent response:');
    console.log(result.text);

  } catch (error) {
    console.error('Error testing heartbeat:', error);
  }
}

testHeartbeat();