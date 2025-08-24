export enum MessageSender {
  User = '用户',
  Cognito = 'Cognito', // Logical AI
  Muse = 'Muse',     // Creative AI
  System = '系统',
}

export enum MessagePurpose {
  UserInput = 'user-input',
  SystemNotification = 'system-notification',
  CognitoToMuse = 'cognito-to-muse',      // Cognito's message to Muse for discussion
  MuseToCognito = 'muse-to-cognito',      // Muse's response to Cognito
  FinalResponse = 'final-response',       // Final response from Cognito to User
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  purpose: MessagePurpose;
  timestamp: Date;
  durationMs?: number; // Time taken to generate this message (for AI messages)
  isStreaming?: boolean; // Whether this message is currently being streamed
  image?: { // Optional image data for user messages
    dataUrl: string; // base64 data URL for displaying the image
    name: string;
    type: string;
  };
}

// Updated types for structured notepad modifications based on HTML-like tags
export type NotepadAction =
  | { action: 'replace_all'; content: string }
  | { action: 'append'; content: string }
  | { action: 'prepend'; content: string }
  | { action: 'insert'; line: number; content: string } // Changed from insert_after_line, uses 'line'
  | { action: 'replace'; line: number; content: string } // Changed from replace_line, uses 'line'
  | { action: 'delete_line'; line: number } // Action name kept, uses 'line'
  | { action: 'search_and_replace'; find: string; with: string; all?: boolean }; // Uses 'find' and 'with'

export type NotepadUpdatePayload = {
  modifications?: NotepadAction[];
  error?: string; // For reporting parsing errors or action application errors
} | null;

export interface FailedStepPayload {
  stepIdentifier: string;
  prompt: string;
  modelName: string;
  systemInstruction?: string;
  imageApiPart?: { inlineData: { mimeType: string; data: string } };
  sender: MessageSender;
  purpose: MessagePurpose;
  originalSystemErrorMsgId: string;
  thinkingConfig?: { thinkingBudget: number };
  userInputForFlow: string;
  imageApiPartForFlow?: { inlineData: { mimeType: string; data: string } };
  discussionLogBeforeFailure: string[];
  currentTurnIndexForResume?: number;
  previousAISignaledStopForResume?: boolean;
}

export enum DiscussionMode {
  FixedTurns = 'fixed',
  AiDriven = 'ai-driven',
}

// 记事本版本历史
export interface NotepadVersion {
  id: string;
  content: string;
  timestamp: Date;
  author: MessageSender | null;
  description?: string;
  wordCount: number;
  lineCount: number;
}

export interface NotepadHistoryState {
  versions: NotepadVersion[];
  currentVersionIndex: number;
}

// 对话历史管理
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  notepadContent: string;
  notepadHistory?: NotepadHistoryState; // 每个会话独立的记事本历史
  channelId?: string; // 会话关联的渠道ID
  channelOverride?: ApiChannelOverride; // 会话级别的渠道覆盖设置
  createdAt: Date;
  updatedAt: Date;
}

// API 渠道覆盖设置
export interface ApiChannelOverride {
  cognitoChannelId?: string;
  museChannelId?: string;
}

// AI角色自定义
export interface CustomAIRole {
  id: string;
  name: string;
  displayName: string;
  systemPrompt: string;
  icon: string;
  color: string;
  isBuiltIn: boolean;
  createdAt: Date;
}

// API 渠道管理
export type ApiChannelProvider = 'openai' | 'gemini';

export interface ApiChannel {
  id: string;
  name: string;
  provider: ApiChannelProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  timeout: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    version: string;
    description?: string;
    [key: string]: any; // 允许其他自定义字段
  };
}

export interface ApiChannelStorageData {
  version: string;
  channels: ApiChannel[];
  lastUpdated: string;
}

export interface ApiChannelValidationError {
  field: keyof ApiChannel;
  message: string;
}

export interface ApiChannelTestResult {
  success: boolean;
  error?: string;
  latency?: number;
}

