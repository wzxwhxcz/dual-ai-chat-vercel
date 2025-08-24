import { useState, useRef, useCallback } from 'react';
import { ChatMessage, MessageSender, MessagePurpose } from '../types';
import { generateStreamResponse as generateGeminiStreamResponse } from '../services/geminiService';
import { generateOpenAiStreamResponse } from '../services/openaiService';

interface UseStreamResponseProps {
  addMessage: (text: string, sender: MessageSender, purpose: MessagePurpose, durationMs?: number, image?: ChatMessage['image']) => string;
  updateMessage: (messageId: string, newText: string, isStreaming?: boolean) => void;
}

export const useStreamResponse = ({ addMessage, updateMessage }: UseStreamResponseProps) => {
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const cancelStreamRef = useRef<boolean>(false);

  const startStreamResponse = useCallback(async (
    prompt: string,
    modelName: string,
    sender: MessageSender,
    purpose: MessagePurpose,
    useOpenAiApiConfig: boolean,
    // Gemini参数
    useCustomApiConfig?: boolean,
    customApiKey?: string,
    customApiEndpoint?: string,
    systemInstruction?: string,
    imagePart?: { inlineData: { mimeType: string; data: string } },
    thinkingConfig?: { thinkingBudget: number },
    temperature?: number,
    // OpenAI参数
    openAiApiKey?: string,
    openAiApiBaseUrl?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    
    cancelStreamRef.current = false;
    setStreamingText('');
    
    // 创建初始消息
    const messageId = addMessage('', sender, purpose);
    setStreamingMessageId(messageId);
    updateMessage(messageId, '', true);

    let accumulatedText = '';

    const callbacks = {
      onChunk: (chunk: string) => {
        if (cancelStreamRef.current) return;
        
        accumulatedText += chunk;
        setStreamingText(accumulatedText);
        updateMessage(messageId, accumulatedText, true);
      },
      onComplete: (fullText: string, durationMs: number) => {
        if (cancelStreamRef.current) return;
        
        setStreamingText('');
        setStreamingMessageId(null);
        void durationMs;
        updateMessage(messageId, fullText, false);
      },
      onError: (error: string, errorType: string, durationMs: number) => {
        setStreamingText('');
        setStreamingMessageId(null);
        void errorType;
        void durationMs;
        updateMessage(messageId, `错误: ${error}`, false);
      }
    };

    try {
      if (useOpenAiApiConfig) {
        await generateOpenAiStreamResponse(
          prompt,
          modelName,
          openAiApiKey || '',
          openAiApiBaseUrl || '',
          systemInstruction,
          imagePart ? { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } : undefined,
          temperature,
          callbacks
        );
      } else {
        await generateGeminiStreamResponse(
          prompt,
          modelName,
          useCustomApiConfig || false,
          customApiKey,
          customApiEndpoint,
          systemInstruction,
          imagePart,
          thinkingConfig,
          temperature,
          callbacks
        );
      }

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      updateMessage(messageId, `错误: ${errorMessage}`, false);
      setStreamingMessageId(null);
      setStreamingText('');
      return { success: false, messageId, error: errorMessage };
    }
  }, [addMessage, updateMessage]);

  const cancelStream = useCallback(() => {
    cancelStreamRef.current = true;
    if (streamingMessageId) {
      updateMessage(streamingMessageId, streamingText + ' [已取消]', false);
      setStreamingMessageId(null);
      setStreamingText('');
    }
  }, [streamingMessageId, streamingText, updateMessage]);

  const isStreaming = streamingMessageId !== null;

  return {
    startStreamResponse,
    cancelStream,
    isStreaming,
    streamingMessageId
  };
};