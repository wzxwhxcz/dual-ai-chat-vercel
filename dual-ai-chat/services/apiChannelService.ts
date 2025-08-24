import { ApiChannel, ChatMessage } from '../types';
import { generateResponse as generateGeminiResponse, generateStreamResponse as generateGeminiStreamResponse } from './geminiService';
import { generateOpenAiResponse, generateOpenAiStreamResponse } from './openaiService';
import { ApiChannelErrorType } from '../constants';

export interface ApiChannelServiceConfig {
  channel: ApiChannel;
  messageHistory?: ChatMessage[];
  temperature?: number;
  abortSignal?: AbortSignal;
}

export interface ApiChannelResponsePayload {
  text: string;
  durationMs: number;
  error?: string;
  errorType?: ApiChannelErrorType;
  channelId: string;
  provider: string;
  requestDetails?: any;
  responseBody?: any;
}

export interface ApiChannelStreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, durationMs: number) => void;
  onError: (error: string, errorType: string, durationMs: number) => void;
}

/**
 * 统一的 API 渠道服务路由层
 */
export class ApiChannelService {
  /**
   * 生成非流式响应
   */
  static async generateResponse(
    prompt: string,
    config: ApiChannelServiceConfig,
    systemInstruction?: string,
    imagePart?: { inlineData: { mimeType: string; data: string } }
  ): Promise<ApiChannelResponsePayload> {
    const startTime = performance.now();
    const { channel, messageHistory, temperature, abortSignal } = config;
    
    try {
      // 验证渠道配置
      this.validateChannel(channel);
      
      // 设置超时控制
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, channel.timeout);
      
      // 合并超时控制和外部中断信号
      const combinedSignal = this.combineAbortSignals([
        timeoutController.signal,
        ...(abortSignal ? [abortSignal] : [])
      ]);
      
      let result: { text: string; durationMs: number; error?: string; requestDetails?: any; responseBody?: any };
      
      try {
        if (channel.provider === 'openai') {
          // OpenAI 兼容服务调用
          result = await generateOpenAiResponse(
            prompt,
            channel.defaultModel,
            channel.apiKey,
            channel.baseUrl!,
            systemInstruction,
            imagePart ? { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } : undefined,
            temperature,
            messageHistory
          );
        } else if (channel.provider === 'gemini') {
          // Gemini 服务调用
          result = await generateGeminiResponse(
            prompt,
            channel.defaultModel,
            true, // 使用自定义配置
            channel.apiKey,
            channel.baseUrl,
            systemInstruction,
            imagePart,
            undefined, // thinkingConfig 在这里不处理
            temperature,
            messageHistory
          );
        } else {
          throw new Error(`不支持的提供商: ${channel.provider}`);
        }
        
        clearTimeout(timeoutId);
        
        // 检查是否被中断
        if (combinedSignal.aborted) {
          throw new Error('请求被中断');
        }
        
        // 转换为统一格式
        return {
          text: result.text,
          durationMs: result.durationMs,
          error: result.error,
          errorType: this.mapErrorType(result.error),
          channelId: channel.id,
          provider: channel.provider,
          requestDetails: result.requestDetails,
          responseBody: result.responseBody
        };
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        const durationMs = performance.now() - startTime;
        
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('请求被中断')) {
            return {
              text: '请求被中断',
              durationMs,
              error: '请求被中断',
              errorType: ApiChannelErrorType.TIMEOUT,
              channelId: channel.id,
              provider: channel.provider
            };
          }
          
          if (error.message.includes('timeout') || timeoutController.signal.aborted) {
            return {
              text: `请求超时 (${channel.timeout/1000}秒)`,
              durationMs,
              error: `请求超时 (${channel.timeout/1000}秒)`,
              errorType: ApiChannelErrorType.TIMEOUT,
              channelId: channel.id,
              provider: channel.provider
            };
          }
          
          return {
            text: error.message,
            durationMs,
            error: error.message,
            errorType: this.mapErrorType(error.message),
            channelId: channel.id,
            provider: channel.provider
          };
        }
        
        return {
          text: '未知错误',
          durationMs,
          error: '未知错误',
          errorType: ApiChannelErrorType.NETWORK_ERROR,
          channelId: channel.id,
          provider: channel.provider
        };
      }
      
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      return {
        text: errorMessage,
        durationMs,
        error: errorMessage,
        errorType: this.mapErrorType(errorMessage),
        channelId: channel.id,
        provider: channel.provider
      };
    }
  }
  
  /**
   * 生成流式响应
   */
  static async generateStreamResponse(
    prompt: string,
    config: ApiChannelServiceConfig,
    callbacks: ApiChannelStreamCallbacks,
    systemInstruction?: string,
    imagePart?: { inlineData: { mimeType: string; data: string } }
  ): Promise<void> {
    const { channel, messageHistory, temperature, abortSignal } = config;
    
    try {
      // 验证渠道配置
      this.validateChannel(channel);
      
      // 设置超时控制
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, channel.timeout);
      
      // 合并超时控制和外部中断信号
      const combinedSignal = this.combineAbortSignals([
        timeoutController.signal,
        ...(abortSignal ? [abortSignal] : [])
      ]);
      
      // 包装回调函数以添加超时清理
      const wrappedCallbacks: ApiChannelStreamCallbacks = {
        onChunk: callbacks.onChunk,
        onComplete: (fullText: string, durationMs: number) => {
          clearTimeout(timeoutId);
          callbacks.onComplete(fullText, durationMs);
        },
        onError: (error: string, errorType: string, durationMs: number) => {
          clearTimeout(timeoutId);
          callbacks.onError(error, errorType, durationMs);
        }
      };
      
      try {
        if (channel.provider === 'openai') {
          // OpenAI 兼容流式调用
          await generateOpenAiStreamResponse(
            prompt,
            channel.defaultModel,
            channel.apiKey,
            channel.baseUrl!,
            systemInstruction,
            imagePart ? { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } : undefined,
            temperature,
            wrappedCallbacks,
            messageHistory
          );
        } else if (channel.provider === 'gemini') {
          // Gemini 流式调用（模拟）
          await generateGeminiStreamResponse(
            prompt,
            channel.defaultModel,
            true, // 使用自定义配置
            channel.apiKey,
            channel.baseUrl,
            systemInstruction,
            imagePart,
            undefined, // thinkingConfig
            temperature,
            wrappedCallbacks,
            messageHistory
          );
        } else {
          throw new Error(`不支持的提供商: ${channel.provider}`);
        }
        
        // 检查是否被中断
        if (combinedSignal.aborted) {
          clearTimeout(timeoutId);
          callbacks.onError('请求被中断', ApiChannelErrorType.TIMEOUT, 0);
          return;
        }
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('请求被中断')) {
            callbacks.onError('请求被中断', ApiChannelErrorType.TIMEOUT, 0);
            return;
          }
          
          if (error.message.includes('timeout') || timeoutController.signal.aborted) {
            callbacks.onError(`请求超时 (${channel.timeout/1000}秒)`, ApiChannelErrorType.TIMEOUT, 0);
            return;
          }
          
          callbacks.onError(error.message, this.mapErrorType(error.message), 0);
        } else {
          callbacks.onError('未知错误', ApiChannelErrorType.NETWORK_ERROR, 0);
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      callbacks.onError(errorMessage, this.mapErrorType(errorMessage), 0);
    }
  }
  
  /**
   * 测试渠道连接
   */
  static async testChannelConnection(channel: ApiChannel): Promise<{
    success: boolean;
    error?: string;
    latency?: number;
  }> {
    const startTime = Date.now();
    
    try {
      this.validateChannel(channel);
      
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, Math.min(channel.timeout, 10000)); // 测试连接最多10秒
      
      let testResult: { success: boolean; error?: string; latency?: number };
      
      if (channel.provider === 'openai') {
        // 测试 OpenAI 兼容接口
        const response = await fetch(`${channel.baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${channel.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: timeoutController.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        testResult = {
          success: true,
          latency: Date.now() - startTime
        };
        
      } else if (channel.provider === 'gemini') {
        // 测试 Gemini 接口
        const testUrl = `${channel.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models?key=${channel.apiKey}`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          signal: timeoutController.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        testResult = {
          success: true,
          latency: Date.now() - startTime
        };
        
      } else {
        throw new Error(`不支持的提供商: ${channel.provider}`);
      }
      
      return testResult;
      
    } catch (error) {
      const latency = Date.now() - startTime;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: '连接测试超时', latency };
        }
        return { success: false, error: error.message, latency };
      }
      
      return { success: false, error: '未知错误', latency };
    }
  }
  
  /**
   * 验证渠道配置
   */
  private static validateChannel(channel: ApiChannel): void {
    if (!channel) {
      throw new Error('渠道配置不能为空');
    }
    
    if (!channel.id || !channel.name || !channel.provider || !channel.defaultModel) {
      throw new Error('渠道配置不完整');
    }
    
    if (!channel.apiKey && channel.provider === 'gemini') {
      throw new Error('Gemini 渠道必须提供 API Key');
    }
    
    if (!channel.baseUrl && channel.provider === 'openai') {
      throw new Error('OpenAI 兼容渠道必须提供 Base URL');
    }
    
    if (channel.timeout < 1000 || channel.timeout > 300000) {
      throw new Error('超时时间必须在1秒到5分钟之间');
    }
  }
  
  /**
   * 映射错误类型
   */
  private static mapErrorType(error?: string): ApiChannelErrorType {
    if (!error) {
      return ApiChannelErrorType.NETWORK_ERROR;
    }
    
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('api key') || errorLower.includes('unauthorized') || errorLower.includes('forbidden')) {
      return ApiChannelErrorType.INVALID_KEY;
    }
    
    if (errorLower.includes('timeout') || errorLower.includes('超时') || errorLower.includes('中断')) {
      return ApiChannelErrorType.TIMEOUT;
    }
    
    if (errorLower.includes('not found') || errorLower.includes('不存在')) {
      return ApiChannelErrorType.CHANNEL_NOT_FOUND;
    }
    
    if (errorLower.includes('validation') || errorLower.includes('验证')) {
      return ApiChannelErrorType.VALIDATION_ERROR;
    }
    
    return ApiChannelErrorType.NETWORK_ERROR;
  }
  
  /**
   * 合并多个 AbortSignal
   */
  private static combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      
      signal.addEventListener('abort', () => {
        controller.abort();
      });
    }
    
    return controller.signal;
  }
  
  /**
   * 获取渠道状态信息
   */
  static getChannelStatus(channel: ApiChannel): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      this.validateChannel(channel);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    
    // 检查警告
    if (channel.timeout > 60000) {
      warnings.push('超时时间超过1分钟，可能影响用户体验');
    }
    
    if (channel.provider === 'openai' && !channel.apiKey.trim()) {
      warnings.push('OpenAI 兼容渠道建议提供 API Key');
    }
    
    if (channel.provider === 'gemini' && channel.baseUrl && !channel.baseUrl.includes('googleapis.com')) {
      warnings.push('使用非官方 Gemini 端点可能存在兼容性问题');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}