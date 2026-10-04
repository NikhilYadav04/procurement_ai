import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { format } from 'date-fns';

// Create a specialized sub-agent for report generation
const reportSubAgent = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.3, // Lower temperature for more focused analysis
});

// Sub-agent system prompt
const REPORT_ANALYST_PROMPT = `You are an expert business analyst specializing in procurement operations and generating audit trials.

Your task is to analyze chat conversation history and generate a comprehensive executive report.

**Analysis Guidelines:**

1. **Work Completed**: Extract concrete actions taken:
   - RFP generations (look for "RFP-XXXX generated")
   - Auctions scheduled (look for "AUC-XXXX scheduled")
   - Vendors added (look for "vendor added", "vendor created")
   - Emails sent (look for "email sent to")
   - Any completed procurement tasks

2. **Key Decisions**: Identify important choices made:
   - Vendor selections
   - Pricing decisions
   - Auction type choices
   - RFP terms agreed upon

3. **Problems Solved**: Note issues that were resolved:
   - Errors fixed
   - Integration issues resolved
   - Process improvements made

4. **Insights & Learnings**: Extract valuable observations:
   - Patterns noticed
   - Efficiency improvements
   - Best practices discovered

5. **Action Items**: Identify next steps:
   - Pending tasks
   - Follow-ups needed
   - Scheduled activities

**Output Format:**
Return ONLY a valid JSON object with these exact keys. Do not include any explanatory text, markdown formatting, or comments.

{
  "workCompleted": ["item1", "item2"],
  "keyDecisions": ["decision1", "decision2"],
  "problemsSolved": ["problem1", "problem2"],
  "insights": ["insight1", "insight2"],
  "actionItems": ["action1", "action2"],
  "summary": "Brief 2-3 sentence overview"
}

**Critical JSON Rules:**
- Return ONLY the JSON object, nothing else
- Use double quotes ONLY for JSON structure (object keys and string delimiters)
- NEVER use quotes inside string values - use single quotes or backticks instead
- Example: CORRECT: "RFP-0001 for 'Procurement of Arduino Boards' generated"
- Example: WRONG: "RFP-0001 for "Procurement of Arduino Boards" generated"
- NO trailing commas in arrays or objects
- NO comments or extra text
- Each array item must be a string
- If category has no items, use empty array: []

**Content Guidelines:**
- Be specific and concrete - use actual RFP numbers, auction IDs, vendor names
- For titles or names that need quotes, use single quotes (') or describe without quotes
- Each array should have 3-10 items (quality over quantity)
- Extract from BOTH user and assistant messages
- Focus on procurement-specific activities`;

async function analyzeChatsWithSubAgent(chatHistory: any[]): Promise<any> {
  console.log('[REPORT SUB-AGENT] Analyzing', chatHistory.length, 'messages');
  
  if (chatHistory.length === 0) {
    return {
      workCompleted: ['No chat history available for this date'],
      keyDecisions: ['Report generation initiated'],
      problemsSolved: [],
      insights: ['Begin using the assistant to populate future reports'],
      actionItems: ['Continue procurement activities'],
      summary: 'No procurement activities recorded for this date.'
    };
  }

  // Prepare chat history for analysis
  const chatText = chatHistory.map((msg, idx) => 
    `[Message ${idx + 1}] ${msg.role.toUpperCase()}: ${msg.content}`
  ).join('\n\n');

  const analysisPrompt = `${REPORT_ANALYST_PROMPT}

**Chat History to Analyze:**
${chatText}

Now analyze this conversation and return ONLY the JSON object with your analysis:`;

  try {
    const response = await reportSubAgent.invoke(analysisPrompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    console.log('[REPORT SUB-AGENT] Raw response length:', content.length);
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    
    // Remove markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }
    
    // Remove any text before the first {
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart > 0) {
      jsonStr = jsonStr.substring(jsonStart);
    }
    
    // Remove any text after the last }
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonEnd > 0 && jsonEnd < jsonStr.length - 1) {
      jsonStr = jsonStr.substring(0, jsonEnd + 1);
    }
    
    // Clean up common JSON issues (but preserve the structure)
    jsonStr = jsonStr
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
      .trim();
    
    console.log('[REPORT SUB-AGENT] Original response (first 300 chars):', jsonStr.substring(0, 300));
    
    // Instead of trying to parse potentially malformed JSON, extract arrays directly
    // This is more robust for AI-generated content with nested quotes
    let analysis;
    
    const extractArray = (key: string): string[] => {
      // Find the key and extract everything between [ and ]
      const keyPattern = new RegExp(`"${key}"\\s*:\\s*\\[`, 'i');
      const keyMatch = jsonStr.match(keyPattern);
      if (!keyMatch) return [];
      
      const startIndex = jsonStr.indexOf(keyMatch[0]) + keyMatch[0].length;
      let bracketCount = 1;
      let endIndex = startIndex;
      
      // Find matching closing bracket
      for (let i = startIndex; i < jsonStr.length; i++) {
        if (jsonStr[i] === '[') bracketCount++;
        if (jsonStr[i] === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            endIndex = i;
            break;
          }
        }
      }
      
      if (endIndex === startIndex) return [];
      
      const arrayContent = jsonStr.substring(startIndex, endIndex).trim();
      if (!arrayContent) return [];
      
      // Manual string extraction - find strings between quotes
      const items: string[] = [];
      let i = 0;
      
      while (i < arrayContent.length) {
        // Skip whitespace and commas
        while (i < arrayContent.length && (arrayContent[i] === ' ' || arrayContent[i] === ',' || arrayContent[i] === '\n')) {
          i++;
        }
        
        if (i >= arrayContent.length) break;
        
        // Look for opening quote
        if (arrayContent[i] === '"') {
          i++; // Skip opening quote
          let item = '';
          let escaped = false;
          
          // Extract until closing quote (handling escaped quotes)
          while (i < arrayContent.length) {
            if (escaped) {
              item += arrayContent[i];
              escaped = false;
            } else if (arrayContent[i] === '\\') {
              escaped = true;
            } else if (arrayContent[i] === '"') {
              // Check if next char is a comma, bracket, or whitespace (end of item)
              let j = i + 1;
              while (j < arrayContent.length && arrayContent[j] === ' ') j++;
              if (j >= arrayContent.length || arrayContent[j] === ',' || arrayContent[j] === ']') {
                // This is the closing quote
                break;
              } else {
                // Quote is part of the content
                item += arrayContent[i];
              }
            } else {
              item += arrayContent[i];
            }
            i++;
          }
          
          if (item.trim()) {
            items.push(item.trim());
          }
          i++; // Skip closing quote
        } else {
          i++;
        }
      }
      
      return items;
    };
    
    const extractString = (key: string): string => {
      const keyPattern = new RegExp(`"${key}"\\s*:\\s*"`, 'i');
      const keyMatch = jsonStr.match(keyPattern);
      if (!keyMatch) return '';
      
      const startIndex = jsonStr.indexOf(keyMatch[0]) + keyMatch[0].length;
      let item = '';
      let escaped = false;
      
      for (let i = startIndex; i < jsonStr.length; i++) {
        if (escaped) {
          item += jsonStr[i];
          escaped = false;
        } else if (jsonStr[i] === '\\') {
          escaped = true;
        } else if (jsonStr[i] === '"') {
          break;
        } else {
          item += jsonStr[i];
        }
      }
      
      return item.trim();
    };
    
    console.log('[REPORT SUB-AGENT] Using direct extraction method (bypassing JSON.parse)...');
    
    try {
      analysis = {
        workCompleted: extractArray('workCompleted'),
        keyDecisions: extractArray('keyDecisions'),
        problemsSolved: extractArray('problemsSolved'),
        insights: extractArray('insights'),
        actionItems: extractArray('actionItems'),
        summary: extractString('summary') || 'Analysis completed successfully'
      };
      
      console.log('[REPORT SUB-AGENT] Direct extraction successful:', {
        work: analysis.workCompleted.length,
        decisions: analysis.keyDecisions.length,
        problems: analysis.problemsSolved.length,
        insights: analysis.insights.length,
        actions: analysis.actionItems.length
      });
    } catch (extractError: any) {
      console.error('[REPORT SUB-AGENT] Direct extraction failed:', extractError.message);
      
      // Ultimate fallback
      analysis = {
        workCompleted: ['Report generation attempted'],
        keyDecisions: [],
        problemsSolved: [],
        insights: ['Data extraction encountered issues'],
        actionItems: ['Review chat history manually'],
        summary: 'Analysis completed with limited data recovery'
      };
    }
    
    console.log('[REPORT SUB-AGENT] Analysis complete:', {
      workItems: analysis.workCompleted?.length || 0,
      decisions: analysis.keyDecisions?.length || 0,
      problems: analysis.problemsSolved?.length || 0,
      insights: analysis.insights?.length || 0,
      actions: analysis.actionItems?.length || 0
    });
    
    return analysis;
  } catch (error: any) {
    console.error('[REPORT SUB-AGENT] Analysis failed:', error);
    // Fallback to basic analysis
    return {
      workCompleted: ['Chat analysis completed'],
      keyDecisions: ['Report generation requested'],
      problemsSolved: [],
      insights: ['Sub-agent analysis encountered an issue'],
      actionItems: ['Review chat history manually'],
      summary: `Analyzed ${chatHistory.length} messages from the conversation.`
    };
  }
}

export const generateExecutiveReportTool = tool(
  async ({ report_date }, config) => {
    try {
      // Parse date or use today
      let targetDate: Date;
      
      if (!report_date || report_date.toLowerCase() === 'today') {
        targetDate = new Date();
      } else if (report_date.toLowerCase() === 'yesterday') {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
      } else {
        // Try parsing the date string
        targetDate = new Date(report_date);
        // If invalid date, default to today
        if (isNaN(targetDate.getTime())) {
          console.log('[REPORT TOOL] Invalid date format, defaulting to today');
          targetDate = new Date();
        }
      }
      
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      console.log('[REPORT TOOL] Generating report for date:', dateStr);
      console.log('[REPORT TOOL] Target date object:', targetDate.toISOString());

      // IMPORTANT: We need to fetch chat history from all sessions for this date
      // The config.messages only contains the current thread's messages
      // We need to get ALL chat sessions from localStorage via the client
      
      // Check if chatSessions were passed through config
      const chatSessions = (config as any)?.configurable?.chatSessions || (config as any)?.chatSessions || [];
      console.log('[REPORT TOOL] Received chat sessions:', chatSessions.length);
      if (chatSessions.length > 0) {
        console.log('[REPORT TOOL] Sample session:', JSON.stringify(chatSessions[0], null, 2));
      }

      // If no chatSessions provided, fall back to current thread messages
      let allMessages: any[] = [];
      
      if (chatSessions.length > 0) {
        // Filter sessions by target date and aggregate messages
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        console.log('[REPORT TOOL] Filtering for target date:', targetDateStr);
        
        chatSessions.forEach((session: any) => {
          const sessionDate = format(new Date(session.timestamp), 'yyyy-MM-dd');
          console.log('[REPORT TOOL] Session date:', sessionDate, 'Messages:', session.messages?.length || 0);
          
          if (sessionDate === targetDateStr && session.messages) {
            allMessages.push(...session.messages);
            console.log('[REPORT TOOL] Added', session.messages.length, 'messages from session');
          }
        });
        console.log('[REPORT TOOL] Aggregated messages from all sessions:', allMessages.length);
      } else {
        // Fallback: use current thread messages from config
        const messages = (config as any)?.messages || [];
        allMessages = messages.map((msg: any) => ({
          role: msg._getType() === 'human' ? 'user' : 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: new Date().toISOString(),
        }));
        console.log('[REPORT TOOL] Using current thread messages:', allMessages.length);
      }

      // Convert to chat history format for sub-agent
      const chatHistory = allMessages.map((msg: any) => ({
        role: msg.role === 'user' || msg.role === 'human' ? 'user' : 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: msg.timestamp || new Date().toISOString(),
      }));

      console.log('[REPORT TOOL] Final chat history for analysis:', chatHistory.length, 'messages');

      // Use sub-agent to analyze chat history
const analysis = await analyzeChatsWithSubAgent(chatHistory);

// If running on Vercel / server environment, bypass HTTP and call directly
if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
  console.log('[REPORT TOOL] Using direct report generator (no HTTP)');

  const { generateReportFromData } = await import('@/pages/api/reports/generate');

  const title = `Executive Report - ${format(targetDate, 'MMMM dd, yyyy')}`;

  const result = await generateReportFromData({
    title,
    includeAnalytics: true,
    timestamp: new Date().toISOString(),
    chatHistory,
    preAnalyzedData: {
      workCompleted: analysis.workCompleted || [],
      keyDecisions: analysis.keyDecisions || [],
      problemsSolved: analysis.problemsSolved || [],
      insights: analysis.insights || [],
      actionItems: analysis.actionItems || [],
      summary: analysis.summary || '',
    },
  });

  console.log('[REPORT TOOL] Direct report generation result:', result);

  // Prefer persistent public URL if available
  const effectiveDownloadUrl = result.publicDownloadUrl || result.downloadUrl;

  return {
    success: true,
    message: `Executive report for ${format(targetDate, 'MMMM dd, yyyy')} generated successfully!`,
    report_date: dateStr,
    filename: result.filename,
    downloadUrl: effectiveDownloadUrl,
    publicDownloadUrl: result.publicDownloadUrl || null,
    pdf_path: result.filePath,
    pageCount: result.pageCount,
    generatedAt: result.generatedAt,
    sections: result.sections,
    analysis: {
      summary: analysis.summary,
      totalItems:
        (analysis.workCompleted?.length || 0) +
        (analysis.keyDecisions?.length || 0) +
        (analysis.insights?.length || 0),
    },
    storageUploaded: result.storageUploaded || false,
  };
}

// Fallback: dev / local → keep using HTTP API
const apiUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/reports/generate`
  : process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/reports/generate`
  : 'http://localhost:3000/api/reports/generate';

console.log('[REPORT TOOL] Calling API:', apiUrl);

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: `Executive Report - ${format(targetDate, 'MMMM dd, yyyy')}`,
    includeAnalytics: true,
    timestamp: new Date().toISOString(),
    chatHistory,
    preAnalyzedData: {
      workCompleted: analysis.workCompleted || [],
      keyDecisions: analysis.keyDecisions || [],
      problemsSolved: analysis.problemsSolved || [],
      insights: analysis.insights || [],
      actionItems: analysis.actionItems || [],
      summary: analysis.summary || '',
    },
  }),
});

// …keep your existing error handling + success branch here for dev.

      console.log('[REPORT TOOL] API Response status:', response.status);
      console.log('[REPORT TOOL] API Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMsg = 'Unknown error';
        let errorDetails = '';
        try {
          const error = await response.json();
          errorMsg = error.message || JSON.stringify(error);
          errorDetails = JSON.stringify(error, null, 2);
        } catch (e) {
          const errorText = await response.text();
          errorMsg = errorText || `HTTP ${response.status}`;
          errorDetails = errorText;
        }
        
        console.error('[REPORT TOOL] API Error Response:', errorDetails);
        console.error('[REPORT TOOL] API Error Message:', errorMsg);
        
        return {
          success: false,
          error: `Failed to generate report (${response.status}): ${errorMsg}`,
          details: errorDetails,
        };
      }

      const result = await response.json();
      console.log('[REPORT TOOL] API Result:', result);

      console.log('[REPORT TOOL] Report generated successfully:', {
        filename: result.filename,
        filePath: result.filePath,
        downloadUrl: result.downloadUrl
      });

      // Return object (not JSON string) so UI can render download button
      const effectiveDownloadUrl = result.publicDownloadUrl || result.downloadUrl;
      return {
        success: true,
        message: `Executive report for ${format(targetDate, 'MMMM dd, yyyy')} generated successfully! The report includes ${analysis.workCompleted?.length || 0} work items, ${analysis.keyDecisions?.length || 0} decisions, and ${analysis.insights?.length || 0} insights.

IMPORTANT: To email this report WITH the PDF attachment, you MUST call send_email tool with:
- attachment_path: "${result.filePath}"

Download link uses ${result.publicDownloadUrl ? 'persistent storage (Supabase)' : 'ephemeral fallback API'}.
`,
        report_date: dateStr,
        filename: result.filename,
        downloadUrl: effectiveDownloadUrl,
        publicDownloadUrl: result.publicDownloadUrl || null,
        pdf_path: result.filePath, // ⚠️ USE THIS for attachment_path when emailing
        pageCount: result.pageCount,
        generatedAt: result.generatedAt,
        sections: result.sections,
        analysis: {
          summary: analysis.summary,
          totalItems: (analysis.workCompleted?.length || 0) + (analysis.keyDecisions?.length || 0) + (analysis.insights?.length || 0)
        },
        storageUploaded: result.storageUploaded || false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate executive report: ${error.message}`,
      };
    }
  },
  {
    name: "generate_executive_report",
    description: `Generate a comprehensive executive summary report by analyzing chat history from a specific date.

This tool uses an AI sub-agent to deeply analyze conversations and extract meaningful insights.

**Key Features:**
- Analyzes all chats from the specified date
- Extracts RFP generations, auction schedules, vendor activities, emails sent
- Identifies key decisions, problems solved, insights, and action items
- Generates a professional 2-3 page PDF report with visual analytics
- Sub-agent ensures high-quality analysis without context limitations

**When to use:**
- "Generate report for today"
- "Create executive summary"
- "Generate report for yesterday"
- "Show me what we did on November 15"

**Output:**
- Professional PDF with structured insights
- Download link for sharing
- File path for email attachment

The sub-agent will intelligently analyze the conversation and create a comprehensive report.`,
    schema: z.object({
      report_date: z
        .string()
        .optional()
        .describe("Date for the report in YYYY-MM-DD format. Defaults to today if not specified. Examples: '2024-11-16', 'today', 'yesterday'"),
    }),
  }
);
