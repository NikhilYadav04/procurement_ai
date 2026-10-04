import type { NextApiRequest, NextApiResponse } from 'next';
import { proagent } from '../../../../agent/agent';
import { withUser } from '@/lib/auth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, threadId, chatSessions } = req.body as {
      messages: ChatMessage[];
      threadId: string;
      chatSessions?: any[];
    };

    const userId = user.userId;
    const customerEmail = user.email;

    console.log('[AGENT API] Received request:', {
      messageCount: messages?.length || 0,
      threadId,
      chatSessionsCount: chatSessions?.length || 0
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!threadId) {
      return res.status(400).json({ error: 'Thread ID is required' });
    }

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    try {
      // Stream agent response using 'values' mode for better state tracking
      const stream = await proagent.stream(
        { messages: messages as any },
        { 
          configurable: { 
            thread_id: threadId,
            userId: userId, // Pass userId through configuration
            customerEmail: customerEmail, // Pass customerEmail through configuration
            chatSessions: chatSessions || [] // Pass chat sessions for report generation
          },
          streamMode: 'values'
        }
      );

      let messagesSent = new Set<string>();

      // Helper function to safely stringify JSON with size limit
      const safeStringify = (obj: any, maxSize: number = 60000): string => {
        try {
          let str = JSON.stringify(obj);
          if (str.length > maxSize) {
            // Truncate large objects
            if (typeof obj === 'object' && obj !== null) {
              return JSON.stringify({
                ...obj,
                _truncated: true,
                _originalSize: str.length,
                _message: 'Content too large, truncated for display'
              });
            }
            return JSON.stringify({
              _truncated: true,
              _originalSize: str.length,
              value: str.substring(0, maxSize - 100) + '...'
            });
          }
          return str;
        } catch (e) {
          return JSON.stringify({ error: 'Failed to stringify', type: typeof obj });
        }
      };

      // Helper to send SSE data safely
      const sendSSE = (data: any) => {
        try {
          const jsonStr = safeStringify(data);
          res.write(`data: ${jsonStr}\n\n`);
        } catch (e) {
          console.error('[SSE Write Error]:', e);
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to send data' })}\n\n`);
        }
      };

      for await (const chunk of stream) {
        // Get the latest message from the state
        const latestMessage = chunk.messages?.at(-1);
        
        if (!latestMessage) continue;

        const messageId = latestMessage.id || '';
        
        // Skip if we've already sent this message
        if (messagesSent.has(messageId)) continue;
        
        messagesSent.add(messageId);

        // Enhanced logging for debugging tool calls
        if (process.env.NODE_ENV === 'development') {
          console.log('[Agent Stream] Message type:', latestMessage.type || latestMessage._getType?.());
          if (latestMessage.tool_calls) {
            console.log('[Agent Stream] Tool calls detected:', latestMessage.tool_calls.length);
          }
        }

        // Handle AI messages with tool calls
        if (latestMessage.tool_calls && latestMessage.tool_calls.length > 0) {
          for (const toolCall of latestMessage.tool_calls) {
            console.log('[Tool Call] Starting:', toolCall.name);
            // Truncate large arguments for SSE
            const argsStr = JSON.stringify(toolCall.args);
            const args = argsStr.length > 50000 ? { _truncated: true, _size: argsStr.length } : toolCall.args;
            
            sendSSE({ 
              type: 'tool_call_start', 
              toolName: toolCall.name,
              args: args,
              id: toolCall.id
            });
          }
        }
        // Handle tool result messages
        else if (latestMessage.name && latestMessage.tool_call_id) {
          try {
            const result = typeof latestMessage.content === 'string' 
              ? JSON.parse(latestMessage.content) 
              : latestMessage.content;
            
            // Truncate large results for SSE
            const resultStr = JSON.stringify(result);
            const truncatedResult = resultStr.length > 50000 
              ? { _truncated: true, _size: resultStr.length, preview: resultStr.substring(0, 1000) + '...' }
              : result;
            
            sendSSE({ 
              type: 'tool_call_end', 
              toolName: latestMessage.name,
              result: truncatedResult,
              toolCallId: latestMessage.tool_call_id
            });
          } catch {
            sendSSE({ 
              type: 'tool_call_end', 
              toolName: latestMessage.name,
              result: latestMessage.content,
              toolCallId: latestMessage.tool_call_id
            });
          }
        }
        // Handle regular AI text content
        else if (latestMessage.content && typeof latestMessage.content === 'string') {
          // Only send AI assistant messages by checking the message type/role
          // LangGraph/LangChain uses different properties to identify message types
          const messageType = latestMessage.type || latestMessage._getType?.() || '';
          const isHumanMessage = messageType === 'human' || messageType === 'user';
          
          // Skip human/user messages - only send AI responses
          if (isHumanMessage) {
            continue;
          }
          
          // Only send non-empty content that's not just whitespace
          if (latestMessage.content.trim().length > 0) {
            const content = latestMessage.content;
            
            // Split very large content into chunks to avoid JSON parsing errors
            if (content.length > 50000) {
              const chunkSize = 40000;
              for (let i = 0; i < content.length; i += chunkSize) {
                const chunk = content.substring(i, Math.min(i + chunkSize, content.length));
                sendSSE({ 
                  type: 'content', 
                  content: chunk,
                  isChunk: true,
                  chunkIndex: Math.floor(i / chunkSize),
                  totalChunks: Math.ceil(content.length / chunkSize)
                });
              }
            } else {
              sendSSE({ 
                type: 'content', 
                content: content
              });
            }
          }
        }
      }

      // Send completion event
      console.log('[Agent Stream] Completed successfully');
      sendSSE({ type: 'done' });
      res.end();
    } catch (streamError) {
      console.error('[Stream Error] Full error:', streamError);
      console.error('[Stream Error] Stack:', streamError instanceof Error ? streamError.stack : 'No stack');
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: streamError instanceof Error ? streamError.message : 'Streaming failed' 
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[Agent API Error] Full error:', error);
    console.error('[Agent API Error] Stack:', error instanceof Error ? error.stack : 'No stack');
    
    // If headers not sent, send JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to process request'
      });
    }

    res.end();
  }
});
