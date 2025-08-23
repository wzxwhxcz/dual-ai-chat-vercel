
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { ChatMessage } from '../types';
import { truncateMessageHistory, buildContextualPrompt } from '../utils/messageConverter';

// Helper to create a GoogleGenAI instance with potential custom fetch
const createGoogleAIClient = (apiKey: string, customApiEndpoint?: string): GoogleGenAI => {
  const clientOptions: any = { apiKey };

  if (customApiEndpoint && customApiEndpoint.trim() !== '') {
    clientOptions.fetch = async (url: string | URL, init?: RequestInit) => {
      try {
        const sdkUrl = new URL(url.toString());
        // sdkUrl.pathname includes the leading slash e.g. /v1beta/models/..
        // sdkUrl.search includes the leading question mark e.g. ?alt=json
        // sdkUrl.hash includes the leading hash
        const sdkPathAndQuery = sdkUrl.pathname + sdkUrl.search + sdkUrl.hash;

        let basePath = customApiEndpoint.trim();
        // Ensure basePath does not end with a slash
        if (basePath.endsWith('/')) {
          basePath = basePath.slice(0, -1);
        }
        // sdkPathAndQuery already starts with '/'
        const finalUrl = basePath + sdkPathAndQuery;
        return fetch(finalUrl, init);
      } catch (e) {
        console.error(
          "Error constructing URL with custom endpoint. Using original SDK URL.",
          e,
          "Original URL:", url,
          "Custom Endpoint:", customApiEndpoint
        );
        // Fallback to original URL if custom endpoint logic fails catastrophically
        return fetch(url, init);
      }
    };
  }
  return new GoogleGenAI(clientOptions);
};

interface GeminiResponsePayload {
  text: string;
  durationMs: number;
  error?: string; // Standardized error key
}

interface GeminiStreamResponse {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, durationMs: number) => void;
  onError: (error: string, errorType: string, durationMs: number) => void;
}

export const generateResponse = async (
  prompt: string,
  modelName: string,
  useCustomConfig: boolean, // New parameter to decide API config source
  customApiKey?: string,
  customApiEndpoint?: string,
  systemInstruction?: string,
  imagePart?: { inlineData: { mimeType: string; data: string } },
  thinkingConfig?: { thinkingBudget: number },
  temperature?: number,
  messageHistory?: ChatMessage[]
): Promise<GeminiResponsePayload> => {
  const startTime = performance.now();
  try {
    let apiKeyToUse: string | undefined;
    let endpointForClient: string | undefined;
    let missingKeyUserMessage = "";
    let invalidKeyUserMessage = "API密钥无效或权限不足。请检查您的API密钥配置和权限。";

    if (useCustomConfig) {
      apiKeyToUse = customApiKey?.trim();
      endpointForClient = customApiEndpoint; // createGoogleAIClient handles if it's empty/default
      missingKeyUserMessage = "自定义API密钥未在设置中提供。请在设置中输入密钥，或关闭'使用自定义API配置'以使用环境变量。";
      if (apiKeyToUse) { // If custom key is provided, tailor invalid message slightly
        invalidKeyUserMessage = "提供的自定义API密钥无效或权限不足。请检查设置中的密钥。";
      }
    } else {
      apiKeyToUse = process.env.API_KEY;
      endpointForClient = undefined; // Ensures default Google endpoint is used by SDK
      missingKeyUserMessage = "API密钥未在环境变量中配置。请配置该密钥，或在设置中启用并提供自定义API配置。";
      if (apiKeyToUse) { // If env key is present, tailor invalid message
         invalidKeyUserMessage = "环境变量中的API密钥无效或权限不足。请检查该密钥。";
      }
    }

    if (!apiKeyToUse) {
      console.error(missingKeyUserMessage);
      // This specific error "API key not configured" will be checked by useChatLogic
      return { text: missingKeyUserMessage, durationMs: performance.now() - startTime, error: "API key not configured" };
    }
    
    const genAI = createGoogleAIClient(apiKeyToUse, endpointForClient);

    const configForApi: {
      systemInstruction?: string;
      thinkingConfig?: { thinkingBudget: number };
      generationConfig?: { temperature?: number };
    } = {};

    if (systemInstruction) {
      configForApi.systemInstruction = systemInstruction;
    }
    if (thinkingConfig) {
      configForApi.thinkingConfig = thinkingConfig;
    }
    if (temperature !== undefined) {
      configForApi.generationConfig = { temperature };
    }

    let requestContents: string | { parts: Part[] } | any;

    // 🔍 DEBUG: 验证Gemini服务中的消息历史
    console.log(`[DEBUG-Gemini] generateResponse调用:`, {
      传入的messageHistory长度: messageHistory?.length || 0,
      messageHistory前3条: messageHistory?.slice(0, 3).map(m => ({
        sender: m.sender,
        text: m.text.substring(0, 50) + '...'
      })) || [],
      使用消息历史: !!(messageHistory && messageHistory.length > 0)
    });

    // 如果有消息历史，构建完整对话上下文
    if (messageHistory && messageHistory.length > 0) {
      // 截断消息历史以防止超出token限制
      const truncatedHistory = truncateMessageHistory(messageHistory, 6000);
      
      // 对于Gemini，我们使用上下文化的prompt方式，因为Gemini的多轮对话API较复杂
      const contextualPrompt = buildContextualPrompt(prompt, truncatedHistory, 15);
      
      console.log(`[DEBUG-Gemini] 消息历史处理结果:`, {
        原始历史长度: messageHistory.length,
        截断后长度: truncatedHistory.length,
        最大历史长度限制: 15,
        构建的上下文化prompt长度: contextualPrompt.length
      });
      
      if (imagePart) {
        requestContents = { parts: [imagePart, { text: contextualPrompt }] };
      } else {
        requestContents = contextualPrompt;
      }
    } else {
      // 向后兼容：没有消息历史时使用原始逻辑
      const textPart: Part = { text: prompt };
      if (imagePart) {
        requestContents = { parts: [imagePart, textPart] };
      } else {
        requestContents = prompt;
      }
    }

    const response: GenerateContentResponse = await genAI.models.generateContent({
      model: modelName,
      contents: requestContents,
      config: Object.keys(configForApi).length > 0 ? configForApi : undefined,
    });

    const durationMs = performance.now() - startTime;
    const responseText = response.text || '';
    return { text: responseText, durationMs };
  } catch (error) {
    console.error("调用Gemini API时出错:", error);
    const durationMs = performance.now() - startTime;
    let errorMessage = "与AI通信时发生未知错误。";
    let errorType = "Unknown AI error";

    // Default messages, might be overridden by specific checks
    let specificMissingKeyMsg = "API密钥未配置。";
    let specificInvalidKeyMsg = "API密钥无效或权限不足。";

    if (useCustomConfig) {
        specificMissingKeyMsg = "自定义API密钥未在设置中提供。";
        specificInvalidKeyMsg = customApiKey?.trim() ? "提供的自定义API密钥无效或权限不足。" : specificMissingKeyMsg;
    } else {
        specificMissingKeyMsg = "API密钥未在环境变量中配置。";
        specificInvalidKeyMsg = process.env.API_KEY ? "环境变量中的API密钥无效或权限不足。" : specificMissingKeyMsg;
    }


    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name; 
      // Error messages from GenAI lib can be generic, map them to our standardized types
      if (error.message.includes('API key not valid') || 
          error.message.includes('API_KEY_INVALID') || 
          error.message.includes('permission-denied') || // Broader permission issue
          (error.message.includes('forbidden') && error.message.toLowerCase().includes('api key'))) { // Another way an invalid key might present
         errorMessage = specificInvalidKeyMsg;
         errorType = "API key invalid or permission denied";
      } else if (error.message.includes('Quota exceeded')) {
        errorMessage = "API配额已超出。请检查您的Google AI Studio配额。";
        errorType = "Quota exceeded";
      }
      // The "API key not configured" case is handled before calling createGoogleAIClient
      // and directly returned if apiKeyToUse is null/empty. This catch is for other errors.
    }
    return { text: errorMessage, durationMs, error: errorType };
  }
};

export const generateStreamResponse = async (
  prompt: string,
  modelName: string,
  useCustomConfig: boolean,
  customApiKey?: string,
  customApiEndpoint?: string,
  systemInstruction?: string,
  imagePart?: { inlineData: { mimeType: string; data: string } },
  thinkingConfig?: { thinkingBudget: number },
  temperature?: number,
  callbacks?: GeminiStreamResponse,
  messageHistory?: ChatMessage[]
): Promise<void> => {
  const startTime = performance.now();
  
  try {
    // 由于Gemini API可能不支持真正的流式，我们使用模拟流式
    const result = await generateResponse(
      prompt,
      modelName,
      useCustomConfig,
      customApiKey,
      customApiEndpoint,
      systemInstruction,
      imagePart,
      thinkingConfig,
      temperature,
      messageHistory
    );

    if (result.error) {
      callbacks?.onError?.(result.text, result.error, result.durationMs);
      return;
    }

    // 改进的模拟流式输出
    const text = result.text;
    const totalWords = text.split(/\s+/).length;
    const wordsPerChunk = Math.max(1, Math.ceil(totalWords / 30)); // 按词分块，约30个块
    const words = text.split(/(\s+)/); // 保留空格
    let currentWordIndex = 0;

    const sendChunk = () => {
      if (currentWordIndex >= words.length) {
        callbacks?.onComplete?.(text, result.durationMs);
        return;
      }

      // 取出一个块的词语
      const chunkWords = words.slice(currentWordIndex, currentWordIndex + wordsPerChunk * 2); // *2因为包含空格
      const chunk = chunkWords.join('');
      currentWordIndex += wordsPerChunk * 2;
      
      if (chunk.trim()) {
        callbacks?.onChunk?.(chunk);
      }

      // 动态调整延迟，让流式更自然
      const delay = Math.random() * 30 + 20; // 20-50ms的随机延迟
      setTimeout(sendChunk, delay);
    };

    sendChunk();

  } catch (error) {
    const durationMs = performance.now() - startTime;
    let errorMessage = "与AI通信时发生未知错误。";
    let errorType = "Unknown AI error";
    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name;
    }
    callbacks?.onError?.(errorMessage, errorType, durationMs);
  }
};
