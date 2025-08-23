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
  if (!messages || messages.length === 0) {
    console.log(`[DEBUG-MessageConverter] filterRelevantMessages: 输入消息为空`);
    return [];
  }
  
  const filtered = messages.filter(msg => {
    // 保留用户输入和AI响应
    const isRelevant = msg.sender === MessageSender.User ||
                      msg.sender === MessageSender.Cognito ||
                      msg.sender === MessageSender.Muse ||
                      // 🔧 FIX: 保留包含重要上下文的系统消息
                      (msg.sender === MessageSender.System &&
                       msg.text && msg.text.trim().length > 0 &&
                       // 过滤掉纯粹的状态通知消息
                       !msg.text.includes('正在') &&
                       !msg.text.includes('已停止') &&
                       !msg.text.includes('重试') &&
                       !msg.text.includes('失败'));
    
    return isRelevant;
  });
  
  console.log(`[DEBUG-MessageConverter] filterRelevantMessages: 从${messages.length}条消息过滤出${filtered.length}条相关消息`);
  
  return filtered;
}

/**
 * 将ChatMessage数组转换为OpenAI消息格式
 */
export function convertToOpenAIMessages(messages: ChatMessage[]): OpenAiChatMessage[] {
  // 🔧 ROBUSTNESS FIX: 输入验证和调试日志
  console.log(`[DEBUG-MessageConverter] convertToOpenAIMessages调用:`, {
    输入messages长度: messages?.length || 0,
    输入messages类型: Array.isArray(messages) ? 'array' : typeof messages,
    输入为空: !messages || messages.length === 0
  });

  // 🔧 ROBUSTNESS FIX: 处理空输入
  if (!messages || !Array.isArray(messages)) {
    console.warn(`[WARNING-MessageConverter] convertToOpenAIMessages收到无效输入:`, messages);
    return [];
  }

  if (messages.length === 0) {
    console.log(`[DEBUG-MessageConverter] convertToOpenAIMessages输入为空数组，返回空结果`);
    return [];
  }

  const relevantMessages = filterRelevantMessages(messages);
  
  console.log(`[DEBUG-MessageConverter] convertToOpenAIMessages处理结果:`, {
    原始消息数: messages.length,
    过滤后相关消息数: relevantMessages.length,
    过滤后消息概要: relevantMessages.slice(0, 3).map(m => ({
      sender: m.sender,
      text: m.text?.substring(0, 50) + '...' || '无文本内容'
    }))
  });

  // 🔧 ROBUSTNESS FIX: 确保即使过滤后为空也能安全处理
  if (relevantMessages.length === 0) {
    console.warn(`[WARNING-MessageConverter] 过滤后无相关消息，返回空结果`);
    return [];
  }
  
  const convertedMessages = relevantMessages.map((msg, index) => {
    try {
      const role = mapSenderToOpenAIRole(msg.sender);
      
      // 🔧 ROBUSTNESS FIX: 验证消息内容
      if (!msg.text && (!msg.image || !msg.image.dataUrl)) {
        console.warn(`[WARNING-MessageConverter] 消息${index}缺少文本和图片内容:`, msg);
        return {
          role,
          content: '[消息内容为空]'
        };
      }
      
      // 处理带图片的消息
      if (msg.image && msg.image.dataUrl) {
        return {
          role,
          content: [
            { type: 'text' as const, text: msg.text || '[图片消息]' },
            {
              type: 'image_url' as const,
              image_url: {
                url: msg.image.dataUrl,
                detail: 'high' as const
              }
            }
          ]
        };
      }
      
      // 普通文本消息
      return {
        role,
        content: msg.text || '[空消息]'
      };
    } catch (error) {
      console.error(`[ERROR-MessageConverter] 转换消息${index}时出错:`, error, msg);
      // 🔧 ROBUSTNESS FIX: 错误恢复，返回安全的默认消息
      return {
        role: 'user' as const,
        content: '[消息转换错误]'
      };
    }
  });

  console.log(`[DEBUG-MessageConverter] convertToOpenAIMessages最终结果:`, {
    转换后消息数: convertedMessages.length,
    消息角色分布: convertedMessages.reduce((acc, msg) => {
      acc[msg.role] = (acc[msg.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  return convertedMessages;
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
  // 🚨 CRITICAL DEBUG: 验证buildContextualPrompt的输入参数
  console.log(`[CRITICAL-DEBUG-MessageConverter] buildContextualPrompt调用:`, {
    currentPrompt长度: currentPrompt?.length || 0,
    currentPrompt前100字符: currentPrompt?.substring(0, 100) || '❌ EMPTY CURRENT PROMPT',
    messageHistory长度: messageHistory?.length || 0,
    maxHistoryLength: maxHistoryLength
  });

  // 🚨 CRITICAL: 检查currentPrompt不为空
  if (!currentPrompt || currentPrompt.trim().length === 0) {
    console.error(`[CRITICAL-ERROR] buildContextualPrompt收到空的currentPrompt!`, {
      currentPrompt,
      messageHistory长度: messageHistory?.length || 0
    });
    // 如果当前prompt为空但有历史消息，尝试构建纯历史上下文
    if (messageHistory && messageHistory.length > 0) {
      console.warn(`[WARNING] currentPrompt为空，尝试构建纯历史上下文`);
    } else {
      throw new Error('currentPrompt和messageHistory都为空，无法构建上下文');
    }
  }

  const relevantMessages = filterRelevantMessages(messageHistory);
  
  // 限制历史消息长度，避免上下文过长
  const recentMessages = relevantMessages.slice(-maxHistoryLength);
  
  console.log(`[CRITICAL-DEBUG-MessageConverter] 消息过滤结果:`, {
    原始messageHistory长度: messageHistory?.length || 0,
    过滤后relevantMessages长度: relevantMessages.length,
    最终recentMessages长度: recentMessages.length,
    recentMessages前3条: recentMessages.slice(0, 3).map(m => ({
      sender: m.sender,
      text: m.text.substring(0, 50) + '...'
    }))
  });
  
  if (recentMessages.length === 0) {
    console.log(`[DEBUG-MessageConverter] 无历史消息，返回原始prompt`);
    return currentPrompt || '';
  }
  
  const historyContext = recentMessages.map(msg => {
    const senderLabel = msg.sender === MessageSender.User ? '用户' : msg.sender;
    return `${senderLabel}: ${msg.text}`;
  }).join('\n');
  
  const contextualPrompt = currentPrompt
    ? `以下是对话历史:\n${historyContext}\n\n当前问题: ${currentPrompt}`
    : `以下是对话历史:\n${historyContext}\n\n请根据对话历史继续回应。`;
  
  console.log(`[CRITICAL-DEBUG-MessageConverter] 构建的最终contextualPrompt:`, {
    contextualPrompt长度: contextualPrompt.length,
    contextualPrompt前200字符: contextualPrompt.substring(0, 200) + '...'
  });
  
  return contextualPrompt;
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