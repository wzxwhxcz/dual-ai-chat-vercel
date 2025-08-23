import { ChatMessage, MessageSender } from '../types';

// OpenAI消息格式接口
export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

// Gemini消息格式接口 (简化)
export interface GeminiChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * 将ChatMessage映射到OpenAI的role格式
 */
function mapSenderToOpenAIRole(sender: MessageSender): 'user' | 'assistant' | 'system' {
  switch (sender) {
    case MessageSender.User:
      return 'user';
    case MessageSender.Cognito:
    case MessageSender.Muse:
      return 'assistant';
    case MessageSender.System:
      return 'system';
    default:
      return 'user';
  }
}

/**
 * 将ChatMessage映射到Gemini的role格式
 */
function mapSenderToGeminiRole(sender: MessageSender): 'user' | 'model' {
  switch (sender) {
    case MessageSender.User:
      return 'user';
    case MessageSender.Cognito:
    case MessageSender.Muse:
      return 'model';
    case MessageSender.System:
      // Gemini API 不支持system role，将其当作model消息处理
      return 'model';
    default:
      return 'user';
  }
}

/**
 * 过滤消息历史，移除不必要的系统消息
 */
function filterRelevantMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(msg => {
    // 排除系统通知消息，保留用户输入和AI响应
    return msg.sender === MessageSender.User || 
           msg.sender === MessageSender.Cognito || 
           msg.sender === MessageSender.Muse;
  });
}

/**
 * 将ChatMessage数组转换为OpenAI消息格式
 */
export function convertToOpenAIMessages(messages: ChatMessage[]): OpenAiChatMessage[] {
  const relevantMessages = filterRelevantMessages(messages);
  
  return relevantMessages.map(msg => {
    const role = mapSenderToOpenAIRole(msg.sender);
    
    // 处理带图片的消息
    if (msg.image && msg.image.dataUrl) {
      return {
        role,
        content: [
          { type: 'text', text: msg.text },
          {
            type: 'image_url',
            image_url: {
              url: msg.image.dataUrl,
              detail: 'high'
            }
          }
        ]
      };
    }
    
    // 普通文本消息
    return {
      role,
      content: msg.text
    };
  });
}

/**
 * 将ChatMessage数组转换为Gemini消息格式
 */
export function convertToGeminiMessages(messages: ChatMessage[]): GeminiChatMessage[] {
  const relevantMessages = filterRelevantMessages(messages);
  
  return relevantMessages.map(msg => {
    const role = mapSenderToGeminiRole(msg.sender);
    
    return {
      role,
      parts: [{ text: msg.text }]
    };
  });
}

/**
 * 构建包含历史上下文的prompt
 * 当AI服务不直接支持消息历史时使用
 */
export function buildContextualPrompt(
  currentPrompt: string, 
  messageHistory: ChatMessage[],
  maxHistoryLength: number = 10
): string {
  const relevantMessages = filterRelevantMessages(messageHistory);
  
  // 限制历史消息长度，避免上下文过长
  const recentMessages = relevantMessages.slice(-maxHistoryLength);
  
  if (recentMessages.length === 0) {
    return currentPrompt;
  }
  
  const historyContext = recentMessages.map(msg => {
    const senderLabel = msg.sender === MessageSender.User ? '用户' : msg.sender;
    return `${senderLabel}: ${msg.text}`;
  }).join('\n');
  
  return `以下是对话历史:\n${historyContext}\n\n当前问题: ${currentPrompt}`;
}

/**
 * 计算消息历史的大概token长度（粗略估算）
 */
export function estimateTokenCount(messages: ChatMessage[]): number {
  const totalText = messages.map(msg => msg.text).join(' ');
  // 粗略估算：平均每4个字符约等于1个token（中文）
  return Math.ceil(totalText.length / 4);
}

/**
 * 截断消息历史以适应token限制
 */
export function truncateMessageHistory(
  messages: ChatMessage[], 
  maxTokens: number = 8000
): ChatMessage[] {
  const relevantMessages = filterRelevantMessages(messages);
  
  let currentTokens = 0;
  const truncatedMessages: ChatMessage[] = [];
  
  // 从最近的消息开始，向前添加直到达到token限制
  for (let i = relevantMessages.length - 1; i >= 0; i--) {
    const msg = relevantMessages[i];
    const msgTokens = Math.ceil(msg.text.length / 4);
    
    if (currentTokens + msgTokens > maxTokens && truncatedMessages.length > 0) {
      break;
    }
    
    truncatedMessages.unshift(msg);
    currentTokens += msgTokens;
  }
  
  return truncatedMessages;
}