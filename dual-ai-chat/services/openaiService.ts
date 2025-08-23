import { ChatMessage } from '../types';
import { convertToOpenAIMessages, truncateMessageHistory } from '../utils/messageConverter';

interface OpenAiResponsePayload {
  text: string;
  durationMs: number;
  error?: string;
  requestDetails?: any;
  responseBody?: any;
}

interface OpenAiStreamResponse {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, durationMs: number) => void;
  onError: (error: string, errorType: string, durationMs: number, requestDetails?: any, responseBody?: any) => void;
}

interface OpenAiMessageContentPartText {
  type: 'text';
  text: string;
}

interface OpenAiMessageContentPartImage {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

type OpenAiMessageContentPart = OpenAiMessageContentPartText | OpenAiMessageContentPartImage;

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<OpenAiMessageContentPart>;
}

export const generateOpenAiResponse = async (
  prompt: string,
  modelId: string,
  apiKey: string,
  baseUrl: string,
  systemInstruction?: string,
  imagePart?: { mimeType: string; data: string },
  temperature?: number,
  messageHistory?: ChatMessage[]
): Promise<OpenAiResponsePayload> => {
  const startTime = performance.now();
  let messages: OpenAiChatMessage[] = [];

  // 🔍 DEBUG: 验证OpenAI服务中的消息历史
  console.log(`[DEBUG-OpenAI] generateOpenAiResponse调用:`, {
    传入的messageHistory长度: messageHistory?.length || 0,
    messageHistory前3条: messageHistory?.slice(0, 3).map(m => ({
      sender: m.sender,
      text: m.text.substring(0, 50) + '...'
    })) || [],
    使用消息历史: !!(messageHistory && messageHistory.length > 0)
  });

  // 如果有消息历史，使用消息历史构建完整对话
  if (messageHistory && messageHistory.length > 0) {
    // 截断消息历史以防止超出token限制
    const truncatedHistory = truncateMessageHistory(messageHistory, 6000);
    const historyMessages = convertToOpenAIMessages(truncatedHistory);
    
    console.log(`[DEBUG-OpenAI] 消息历史处理结果:`, {
      原始历史长度: messageHistory.length,
      截断后长度: truncatedHistory.length,
      转换后OpenAI格式消息数: historyMessages.length
    });
    
    // 转换为本地OpenAiChatMessage格式
    messages = historyMessages.map(msg => ({
      role: msg.role,
      content: msg.content as string | Array<OpenAiMessageContentPart>
    }));
    
    // 🔧 CRITICAL FIX: 检查转换后的messages是否缺少user/assistant内容
    const hasUserOrAssistantMessage = messages.some(m =>
        m.role === 'user' || m.role === 'assistant'
    );
    
    // 如果没有user/assistant消息且有当前prompt，添加为user消息
    if (!hasUserOrAssistantMessage && prompt && prompt.trim()) {
      console.log(`[DEBUG-OpenAI] 历史消息转换后缺少user/assistant内容，添加当前prompt作为user消息`);
      
      // 复用现有的用户消息内容构建逻辑
      let userMessageContent: string | Array<OpenAiMessageContentPart>;
      if (imagePart && imagePart.data) {
        userMessageContent = [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
            },
          },
        ];
      } else {
        userMessageContent = prompt;
      }
      messages.push({ role: 'user', content: userMessageContent });
    }
    
    // 如果有系统指令，将其插入到开头
    if (systemInstruction) {
      messages.unshift({ role: 'system', content: systemInstruction });
    }
  } else {
    // 向后兼容：没有消息历史时使用原始逻辑
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    let userMessageContent: string | Array<OpenAiMessageContentPart>;
    if (imagePart && imagePart.data) {
      userMessageContent = [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
          },
        },
      ];
    } else {
      userMessageContent = prompt;
    }
    messages.push({ role: 'user', content: userMessageContent });
  }

  const requestBody = {
    model: modelId,
    messages: messages,
    temperature: temperature !== undefined ? temperature : 1.0,
  };

  const requestDetails = {
    url: `${baseUrl}/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.substring(0, 10)}...`,
    },
    body: requestBody
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const durationMs = performance.now() - startTime;
    
    let data;
    try {
      data = await response.json();
    } catch (parseError: any) {
      const textBody = await response.text();
      return {
        text: "无法解析响应JSON",
        durationMs,
        error: "JSON Parse Error",
        requestDetails,
        responseBody: { rawText: textBody, parseError: parseError?.message || 'Unknown parse error' }
      };
    }

    if (!response.ok) {
      const errorMessage = data?.error?.message || response.statusText || `请求失败，状态码: ${response.status}`;
      
      let errorType = "OpenAI API error";
      if (response.status === 401 || response.status === 403) {
        errorType = "API key invalid or permission denied";
      } else if (response.status === 429) {
        errorType = "Quota exceeded";
      }
      
      return { text: errorMessage, durationMs, error: errorType, requestDetails, responseBody: data };
    }

    // 适配这个 API 的响应格式
    let content = "";
    
    // 检查是否是标准 OpenAI 格式
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      if (choice.message && choice.message.content !== undefined) {
        content = choice.message.content || "";
      }
    }
    // 检查是否是这个 API 的格式
    else if (data.result && data.result.length > 0) {
      const result = data.result[0];
      if (result.content !== undefined) {
        content = result.content || "";
      }
    }
    // 都不匹配则返回错误
    else {
      return { text: "AI响应格式无效。", durationMs, error: "Invalid response structure", requestDetails, responseBody: data };
    }
    
    return { text: content, durationMs };

  } catch (error) {
    const durationMs = performance.now() - startTime;
    let errorMessage = "与AI通信时发生未知错误。";
    let errorType = "Unknown AI error";
    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name;
    }
    return { text: errorMessage, durationMs, error: errorType, requestDetails };
  }
};

export const generateOpenAiStreamResponse = async (
  prompt: string,
  modelId: string,
  apiKey: string,
  baseUrl: string,
  systemInstruction?: string,
  imagePart?: { mimeType: string; data: string },
  temperature?: number,
  callbacks?: OpenAiStreamResponse,
  messageHistory?: ChatMessage[]
): Promise<void> => {
  const startTime = performance.now();
  let messages: OpenAiChatMessage[] = [];

  // 如果有消息历史，使用消息历史构建完整对话
  if (messageHistory && messageHistory.length > 0) {
    // 截断消息历史以防止超出token限制
    const truncatedHistory = truncateMessageHistory(messageHistory, 6000);
    const historyMessages = convertToOpenAIMessages(truncatedHistory);
    
    // 转换为本地OpenAiChatMessage格式
    messages = historyMessages.map(msg => ({
      role: msg.role,
      content: msg.content as string | Array<OpenAiMessageContentPart>
    }));
    
    // 🔧 CRITICAL FIX: 检查转换后的messages是否缺少user/assistant内容
    const hasUserOrAssistantMessage = messages.some(m =>
        m.role === 'user' || m.role === 'assistant'
    );
    
    // 如果没有user/assistant消息且有当前prompt，添加为user消息
    if (!hasUserOrAssistantMessage && prompt && prompt.trim()) {
      console.log(`[DEBUG-OpenAI-Stream] 历史消息转换后缺少user/assistant内容，添加当前prompt作为user消息`);
      
      // 复用现有的用户消息内容构建逻辑
      let userMessageContent: string | Array<OpenAiMessageContentPart>;
      if (imagePart && imagePart.data) {
        userMessageContent = [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
            },
          },
        ];
      } else {
        userMessageContent = prompt;
      }
      messages.push({ role: 'user', content: userMessageContent });
    }
    
    // 如果有系统指令，将其插入到开头
    if (systemInstruction) {
      messages.unshift({ role: 'system', content: systemInstruction });
    }
  } else {
    // 向后兼容：没有消息历史时使用原始逻辑
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    let userMessageContent: string | Array<OpenAiMessageContentPart>;
    if (imagePart && imagePart.data) {
      userMessageContent = [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
          },
        },
      ];
    } else {
      userMessageContent = prompt;
    }
    messages.push({ role: 'user', content: userMessageContent });
  }

  const requestBody = {
    model: modelId,
    messages: messages,
    temperature: temperature !== undefined ? temperature : 1.0,
    stream: true,
  };

  const requestDetails = {
    url: `${baseUrl}/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.substring(0, 10)}...`,
    },
    body: requestBody
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const durationMs = performance.now() - startTime;
      let data;
      try {
        data = await response.json();
      } catch (parseError: any) {
        const textBody = await response.text();
        callbacks?.onError?.("无法解析响应JSON", "JSON Parse Error", durationMs, requestDetails, { rawText: textBody, parseError: parseError?.message || 'Unknown parse error' });
        return;
      }

      const errorMessage = data?.error?.message || response.statusText || `请求失败，状态码: ${response.status}`;
      
      let errorType = "OpenAI API error";
      if (response.status === 401 || response.status === 403) {
        errorType = "API key invalid or permission denied";
      } else if (response.status === 429) {
        errorType = "Quota exceeded";
      }
      
      callbacks?.onError?.(errorMessage, errorType, durationMs, requestDetails, data);
      return;
    }

    if (!response.body) {
      const durationMs = performance.now() - startTime;
      callbacks?.onError?.("响应体为空", "No response body", durationMs, requestDetails);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                fullText += content;
                callbacks?.onChunk?.(content);
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      const durationMs = performance.now() - startTime;
      callbacks?.onComplete?.(fullText, durationMs);

    } catch (error) {
      const durationMs = performance.now() - startTime;
      callbacks?.onError?.(error instanceof Error ? error.message : "流读取错误", "Stream read error", durationMs, requestDetails);
    }

  } catch (error) {
    const durationMs = performance.now() - startTime;
    let errorMessage = "与AI通信时发生未知错误。";
    let errorType = "Unknown AI error";
    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name;
    }
    callbacks?.onError?.(errorMessage, errorType, durationMs, requestDetails);
  }
};