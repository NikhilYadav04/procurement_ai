import type { NextApiRequest, NextApiResponse } from 'next';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { date, chatSessions } = req.body;

    if (!chatSessions || !Array.isArray(chatSessions)) {
      return res.status(400).json({ message: 'Chat sessions array required' });
    }

    // Parse target date
    const targetDate = date ? new Date(date) : new Date();
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('[FETCH CHATS] Fetching chats for date:', targetDateStr);
    console.log('[FETCH CHATS] Total sessions available:', chatSessions.length);

    // Filter sessions from the target date
    const filteredSessions: ChatSession[] = chatSessions.filter((session: ChatSession) => {
      const sessionDate = new Date(session.timestamp).toISOString().split('T')[0];
      return sessionDate === targetDateStr;
    });

    console.log('[FETCH CHATS] Sessions matching date:', filteredSessions.length);

    // Aggregate all messages from filtered sessions
    const allMessages: ChatMessage[] = [];
    filteredSessions.forEach(session => {
      if (session.messages && Array.isArray(session.messages)) {
        allMessages.push(...session.messages);
      }
    });

    // Sort messages by timestamp
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    console.log('[FETCH CHATS] Total messages collected:', allMessages.length);

    res.status(200).json({
      success: true,
      date: targetDateStr,
      sessionsCount: filteredSessions.length,
      messagesCount: allMessages.length,
      messages: allMessages,
    });
  } catch (error: any) {
    console.error('[FETCH CHATS] Error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to fetch chat history' 
    });
  }
}
