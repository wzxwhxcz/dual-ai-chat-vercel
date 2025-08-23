import { useState, useRef, useCallback } from 'react';
import { ChatMessage, MessageSender, MessagePurpose, FailedStepPayload, DiscussionMode } from '../types'; 
import { generateResponse as generateGeminiResponse } from '../services/geminiService';
import { generateOpenAiResponse } from '../services/openaiService'; 
import {
  AiModel,
  NOTEPAD_INSTRUCTION_PROMPT_PART,
  DISCUSSION_COMPLETE_TAG,
  AI_DRIVEN_DISCUSSION_INSTRUCTION_PROMPT_PART,
  MAX_AUTO_RETRIES,
  RETRY_DELAY_BASE_MS,
  THINKING_BUDGET_CONFIG_HIGH_QUALITY,
  THINKING_BUDGET_CONFIG_PRO_HIGH_QUALITY,
  GEMINI_PRO_MODEL_ID,
  GEMINI_2_5_PRO_PREVIEW_05_06_MODEL_ID
} from '../constants';
import { parseAIResponse, fileToBase64, ParsedAIResponse, formatNotepadContentForAI } from '../utils/appUtils';

interface UseChatLogicProps {
  addMessage: (text: string, sender: MessageSender, purpose: MessagePurpose, durationMs?: number, image?: ChatMessage['image']) => string;
  processNotepadUpdateFromAI: (parsedResponse: ParsedAIResponse, sender: MessageSender, addSystemMessage: UseChatLogicProps['addMessage']) => void;
  setGlobalApiKeyStatus: (status: {isMissing?: boolean, isInvalid?: boolean, message?: string}) => void;
  
  cognitoModelDetails: AiModel;
  museModelDetails: AiModel;
  
  // Gemini Custom Config
  useCustomApiConfig: boolean;
  customApiKey: string;
  customApiEndpoint: string;

  // OpenAI Custom Config
  useOpenAiApiConfig: boolean;
  openAiApiKey: string;
  openAiApiBaseUrl: string;
  openAiCognitoModelId: string;
  openAiMuseModelId: string;

  // Shared Settings
  discussionMode: DiscussionMode;
  manualFixedTurns: number;
  isThinkingBudgetActive: boolean;
  cognitoSystemPrompt: string;
  museSystemPrompt: string;
  notepadContent: string;
  startProcessingTimer: () => void;
  stopProcessingTimer: () => void;
  currentQueryStartTimeRef: React.MutableRefObject<number | null>;
  temperature: number;
  
  // 新增：消息历史访问
  getAllMessages: () => ChatMessage[];
}

export const useChatLogic = ({
  addMessage,
  processNotepadUpdateFromAI,
  setGlobalApiKeyStatus,
  cognitoModelDetails,
  museModelDetails,
  // Gemini
  useCustomApiConfig,
  customApiKey,
  customApiEndpoint,
  // OpenAI
  useOpenAiApiConfig,
  openAiApiKey,
  openAiApiBaseUrl,
  openAiCognitoModelId: _openAiCognitoModelId,  // 参数传入但在此不直接使用
  openAiMuseModelId: _openAiMuseModelId,        // 参数传入但在此不直接使用
  // Shared
  discussionMode,
  manualFixedTurns,
  isThinkingBudgetActive,
  cognitoSystemPrompt,
  museSystemPrompt,
  notepadContent,
  startProcessingTimer,
  stopProcessingTimer,
  currentQueryStartTimeRef: _currentQueryStartTimeRef, // 参数传入但在此不直接使用
  temperature,
  // 新增
  getAllMessages,
}: UseChatLogicProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [discussionLog, setDiscussionLog] = useState<string[]>([]);
  const [failedStepInfo, setFailedStepInfo] = useState<FailedStepPayload | null>(null);
  const cancelRequestRef = useRef<boolean>(false);
  const [currentDiscussionTurn, setCurrentDiscussionTurn] = useState<number>(0);
  const [isInternalDiscussionActive, setIsInternalDiscussionActive] = useState<boolean>(false);
  const [lastCompletedTurnCount, setLastCompletedTurnCount] = useState<number>(0);

  const getThinkingConfigForGeminiModel = useCallback((modelDetails: AiModel) : { thinkingBudget: number } | undefined => {
    if (!useOpenAiApiConfig && modelDetails.supportsThinkingConfig && isThinkingBudgetActive) {
      return (modelDetails.apiName === GEMINI_PRO_MODEL_ID || modelDetails.apiName === GEMINI_2_5_PRO_PREVIEW_05_06_MODEL_ID)
        ? THINKING_BUDGET_CONFIG_PRO_HIGH_QUALITY.thinkingConfig
        : THINKING_BUDGET_CONFIG_HIGH_QUALITY.thinkingConfig;
    }
    return undefined;
  }, [useOpenAiApiConfig, isThinkingBudgetActive]);

  const commonAIStepExecution = useCallback(async (
    stepIdentifier: string,
    prompt: string,
    modelDetailsForStep: AiModel,
    senderForStep: MessageSender,
    purposeForStep: MessagePurpose,
    imageApiPartForStep?: { inlineData: { mimeType: string; data: string } },
    userInputForFlowContext?: string,
    imageApiPartForFlowContext?: { inlineData: { mimeType: string; data: string } },
    discussionLogBeforeFailureContext?: string[],
    currentTurnIndexForResumeContext?: number,
    previousAISignaledStopForResumeContext?: boolean,
    messageHistory?: ChatMessage[]  // 新增：消息历史参数
  ): Promise<ParsedAIResponse> => {
    let stepSuccess = false;
    let parsedResponse: ParsedAIResponse | null = null;
    let autoRetryCount = 0;
    
    const systemInstructionToUse = senderForStep === MessageSender.Cognito ? cognitoSystemPrompt : museSystemPrompt;
    const thinkingConfigToUseForGemini = getThinkingConfigForGeminiModel(modelDetailsForStep);

    // 获取消息历史：优先使用传入的参数，否则获取当前所有消息
    const historyToUse = messageHistory || getAllMessages();
    
    // 🔍 DEBUG: 验证消息历史传递
    console.log(`[DEBUG-${stepIdentifier}] commonAIStepExecution调用:`, {
      传入的messageHistory长度: messageHistory?.length || 0,
      实际使用的historyToUse长度: historyToUse?.length || 0,
      historyToUse前3条消息: historyToUse?.slice(0, 3).map(m => ({
        sender: m.sender,
        text: m.text.substring(0, 100) + '...'
      })) || [],
      stepIdentifier,
      senderForStep
    });

    while (autoRetryCount <= MAX_AUTO_RETRIES && !stepSuccess) {
      if (cancelRequestRef.current) throw new Error("用户取消操作");
      
      let result: { text: string; durationMs: number; error?: string; requestDetails?: any; responseBody?: any } | undefined;
      
      try {
        const currentOpenAiModelId = modelDetailsForStep.apiName;

        if (useOpenAiApiConfig) {
          result = await generateOpenAiResponse(
            prompt,
            currentOpenAiModelId,
            openAiApiKey,
            openAiApiBaseUrl,
            modelDetailsForStep.supportsSystemInstruction ? systemInstructionToUse : undefined,
            imageApiPartForStep ? { mimeType: imageApiPartForStep.inlineData.mimeType, data: imageApiPartForStep.inlineData.data } : undefined,
            temperature,
            historyToUse  // 传递消息历史
          );
        } else {
          result = await generateGeminiResponse(
            prompt,
            modelDetailsForStep.apiName,
            useCustomApiConfig,
            customApiKey,
            customApiEndpoint,
            modelDetailsForStep.supportsSystemInstruction ? systemInstructionToUse : undefined,
            imageApiPartForStep,
            thinkingConfigToUseForGemini,
            temperature,
            historyToUse  // 传递消息历史
          );
        }

        if (cancelRequestRef.current) throw new Error("用户取消操作");
        
        if (result.error) {
          if (result.error === "API key not configured" || result.error.toLowerCase().includes("api key not provided")) {
             setGlobalApiKeyStatus({isMissing: true, message: result.text}); 
             throw new Error(result.text); 
          }
          if (result.error === "API key invalid or permission denied") {
             setGlobalApiKeyStatus({isInvalid: true, message: result.text}); 
             throw new Error(result.text);
          }
          throw new Error(result.text || "AI 响应错误");
        }
        setGlobalApiKeyStatus({isMissing: false, isInvalid: false, message: undefined }); 
        parsedResponse = parseAIResponse(result.text);
        addMessage(parsedResponse.spokenText, senderForStep, purposeForStep, result.durationMs);
        stepSuccess = true;
      } catch (e) {
        const error = e as Error;
        if (error.message.includes("API密钥") || error.message.toLowerCase().includes("api key")) {
           throw error; 
        }

        if (autoRetryCount < MAX_AUTO_RETRIES) {
          let errorMessage = `[${senderForStep} - ${stepIdentifier}] 调用失败，重试 (${autoRetryCount + 1}/${MAX_AUTO_RETRIES})... ${error.message}`;
          
          if (result?.requestDetails) {
            errorMessage += `\n请求详情: ${JSON.stringify(result.requestDetails, null, 2)}`;
          }
          if (result?.responseBody) {
            errorMessage += `\n响应内容: ${JSON.stringify(result.responseBody, null, 2)}`;
          }
          
          addMessage(errorMessage, MessageSender.System, MessagePurpose.SystemNotification);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE_MS * (autoRetryCount + 1)));
        } else {
          let finalErrorMessage = `[${senderForStep} - ${stepIdentifier}] 在 ${MAX_AUTO_RETRIES + 1} 次尝试后失败: ${error.message} 可手动重试。`;
          
          if (result?.requestDetails) {
            finalErrorMessage += `\n最后一次请求详情: ${JSON.stringify(result.requestDetails, null, 2)}`;
          }
          if (result?.responseBody) {
            finalErrorMessage += `\n最后一次响应内容: ${JSON.stringify(result.responseBody, null, 2)}`;
          }
          
          const errorMsgId = addMessage(finalErrorMessage, MessageSender.System, MessagePurpose.SystemNotification);
          
          let thinkingConfigForPayload: {thinkingBudget: number} | undefined = undefined;
          if (!useOpenAiApiConfig) { 
            thinkingConfigForPayload = thinkingConfigToUseForGemini;
          }

          setFailedStepInfo({
            stepIdentifier: stepIdentifier, 
            prompt: prompt, 
            modelName: modelDetailsForStep.apiName, 
            systemInstruction: modelDetailsForStep.supportsSystemInstruction ? systemInstructionToUse : undefined, 
            imageApiPart: imageApiPartForStep, 
            sender: senderForStep, 
            purpose: purposeForStep, 
            originalSystemErrorMsgId: errorMsgId, 
            thinkingConfig: thinkingConfigForPayload,
            userInputForFlow: userInputForFlowContext || "", 
            imageApiPartForFlow: imageApiPartForFlowContext,
            discussionLogBeforeFailure: discussionLogBeforeFailureContext || [], 
            currentTurnIndexForResume: currentTurnIndexForResumeContext,
            previousAISignaledStopForResume: previousAISignaledStopForResumeContext
          });
          setIsInternalDiscussionActive(false); 
          throw error; 
        }
      }
      autoRetryCount++;
    }
    if (!parsedResponse) {
        setIsInternalDiscussionActive(false); 
        throw new Error("AI响应处理失败");
    }
    return parsedResponse;
  }, [
      addMessage, cognitoSystemPrompt, museSystemPrompt, getThinkingConfigForGeminiModel,
      useOpenAiApiConfig, openAiApiKey, openAiApiBaseUrl,
      useCustomApiConfig, customApiKey, customApiEndpoint,
      setGlobalApiKeyStatus, setIsLoading, setIsInternalDiscussionActive, temperature,
      getAllMessages  // 添加新的依赖
    ]);

  const continueDiscussionAfterSuccessfulRetry = useCallback(async (
    retriedStepPayload: FailedStepPayload,
    retryResponse: ParsedAIResponse
  ) => {
    const {
      stepIdentifier: retriedStepId,
      userInputForFlow,
      imageApiPartForFlow, 
    } = retriedStepPayload;

    let localDiscussionLog = [...retriedStepPayload.discussionLogBeforeFailure!]; 
    localDiscussionLog.push(`${retriedStepPayload.sender}: ${retryResponse.spokenText}`);
    setDiscussionLog(localDiscussionLog);

    let localLastTurnTextForLog = retryResponse.spokenText;
    let localPreviousAISignaledStop = (discussionMode === DiscussionMode.AiDriven && (retryResponse.discussionShouldEnd || false));
    if (discussionMode === DiscussionMode.AiDriven && retriedStepPayload.previousAISignaledStopForResume && retryResponse.discussionShouldEnd) {
        localPreviousAISignaledStop = true;
    }
    
    const effectiveCognitoModel = cognitoModelDetails;
    const effectiveMuseModel = museModelDetails;

    const imageInstructionForAI = imageApiPartForFlow ? "用户还提供了一张图片。请在您的分析和回复中同时考虑此图片和文本查询。" : "";
    const discussionModeInstructionText = discussionMode === DiscussionMode.AiDriven ? AI_DRIVEN_DISCUSSION_INSTRUCTION_PROMPT_PART : "";
    const commonPromptInstructions = () => NOTEPAD_INSTRUCTION_PROMPT_PART.replace('{notepadContent}', formatNotepadContentForAI(notepadContent)) + discussionModeInstructionText;

    let initialLoopTurn = 0;
    let skipMuseInFirstIteration = false;

    if (retriedStepId === 'cognito-initial-to-muse') {
        initialLoopTurn = 0;
        setIsInternalDiscussionActive(true); 
        setCurrentDiscussionTurn(0);
        if (localPreviousAISignaledStop) addMessage(`${MessageSender.Cognito} 已建议结束讨论。等待 ${MessageSender.Muse} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
    } else if (retriedStepId.startsWith('muse-reply-to-cognito-turn-')) {
        initialLoopTurn = retriedStepPayload.currentTurnIndexForResume ?? 0;
        setIsInternalDiscussionActive(true); 
        setCurrentDiscussionTurn(initialLoopTurn);
        skipMuseInFirstIteration = true; 
        if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop && retriedStepPayload.previousAISignaledStopForResume) {
            addMessage(`双方AI (${MessageSender.Cognito} 和 ${MessageSender.Muse}) 已同意结束讨论。`, MessageSender.System, MessagePurpose.SystemNotification);
             setIsInternalDiscussionActive(false);
        } else if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop) {
             addMessage(`${MessageSender.Muse} 已建议结束讨论。等待 ${MessageSender.Cognito} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
        }
    } else if (retriedStepId.startsWith('cognito-reply-to-muse-turn-')) {
        initialLoopTurn = (retriedStepPayload.currentTurnIndexForResume ?? 0) + 1;
        setIsInternalDiscussionActive(true); 
        setCurrentDiscussionTurn(initialLoopTurn); 
         if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop && retriedStepPayload.previousAISignaledStopForResume) {
             addMessage(`双方AI (${MessageSender.Muse} 和 ${MessageSender.Cognito}) 已同意结束讨论。`, MessageSender.System, MessagePurpose.SystemNotification);
             setIsInternalDiscussionActive(false);
        } else if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop) {
             addMessage(`${MessageSender.Cognito} 已建议结束讨论。等待 ${MessageSender.Muse} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
        }
    } else if (retriedStepId === 'cognito-final-answer') {
        setIsInternalDiscussionActive(false); 
        return;
    }

    try {
      let discussionLoopShouldRun = true;
      if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop && retriedStepPayload.previousAISignaledStopForResume) {
          discussionLoopShouldRun = false;
      }
      if (retriedStepId === 'cognito-final-answer') discussionLoopShouldRun = false;

      if (discussionLoopShouldRun && isInternalDiscussionActive) { 
        for (let turn = initialLoopTurn; ; turn++) {
          setCurrentDiscussionTurn(turn);
          if (cancelRequestRef.current) break;
          if (discussionMode === DiscussionMode.FixedTurns && turn >= manualFixedTurns) break;
          if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop && retriedStepPayload.previousAISignaledStopForResume && turn > initialLoopTurn) break;

          if (!(skipMuseInFirstIteration && turn === initialLoopTurn)) {
            const museStepIdentifier = `muse-reply-to-cognito-turn-${turn}`;
            addMessage(`${MessageSender.Muse} 正在回应 ${MessageSender.Cognito} (使用 ${effectiveMuseModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
            let musePromptText = `用户的查询 (中文) 是: "${userInputForFlow}". ${imageInstructionForAI} 当前讨论 (均为中文):\n${localDiscussionLog.join("\n")}\n${MessageSender.Cognito} (逻辑AI) 刚刚说 (中文): "${localLastTurnTextForLog}". 请回复 ${MessageSender.Cognito}。继续讨论。保持您的回复简洁并使用中文。\n${commonPromptInstructions()}`;
            if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop) musePromptText += `\n${MessageSender.Cognito} 已包含 ${DISCUSSION_COMPLETE_TAG} 建议结束讨论。如果您同意，请在您的回复中也包含 ${DISCUSSION_COMPLETE_TAG}。否则，请继续讨论。`;

            const museParsedResponse = await commonAIStepExecution(
                museStepIdentifier, musePromptText, effectiveMuseModel, MessageSender.Muse, MessagePurpose.MuseToCognito, imageApiPartForFlow,
                userInputForFlow, imageApiPartForFlow, [...localDiscussionLog], turn, localPreviousAISignaledStop, getAllMessages()
            );
            if (cancelRequestRef.current) return;
            processNotepadUpdateFromAI(museParsedResponse, MessageSender.Muse, addMessage);
            const prevSignalBeforeMuse = localPreviousAISignaledStop;
            localLastTurnTextForLog = museParsedResponse.spokenText; localDiscussionLog.push(`${MessageSender.Muse}: ${localLastTurnTextForLog}`); setDiscussionLog([...localDiscussionLog]);
            localPreviousAISignaledStop = museParsedResponse.discussionShouldEnd || false;

            if (discussionMode === DiscussionMode.AiDriven) {
                if (localPreviousAISignaledStop && prevSignalBeforeMuse) {
                    addMessage(`双方AI (${MessageSender.Cognito} 和 ${MessageSender.Muse}) 已同意结束讨论。`, MessageSender.System, MessagePurpose.SystemNotification);
                    setIsInternalDiscussionActive(false); break;
                } else if (localPreviousAISignaledStop) {
                    addMessage(`${MessageSender.Muse} 已建议结束讨论。等待 ${MessageSender.Cognito} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
                }
            }
          }
          skipMuseInFirstIteration = false;
          if (cancelRequestRef.current) break;
          if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop && retriedStepPayload.previousAISignaledStopForResume) { setIsInternalDiscussionActive(false); break; }
          if (discussionMode === DiscussionMode.FixedTurns && turn >= manualFixedTurns -1) { setIsInternalDiscussionActive(false); break; }

          const cognitoReplyStepIdentifier = `cognito-reply-to-muse-turn-${turn}`;
          addMessage(`${MessageSender.Cognito} 正在回应 ${MessageSender.Muse} (使用 ${effectiveCognitoModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
          let cognitoReplyPromptText = `用户的查询 (中文) 是: "${userInputForFlow}". ${imageInstructionForAI} 当前讨论 (均为中文):\n${localDiscussionLog.join("\n")}\n${MessageSender.Muse} (创意AI) 刚刚说 (中文): "${localLastTurnTextForLog}". 请回复 ${MessageSender.Muse}。继续讨论。保持您的回复简洁并使用中文。\n${commonPromptInstructions()}`;
          if (discussionMode === DiscussionMode.AiDriven && localPreviousAISignaledStop) cognitoReplyPromptText += `\n${MessageSender.Muse} 已包含 ${DISCUSSION_COMPLETE_TAG} 建议结束讨论。如果您同意，请在您的回复中也包含 ${DISCUSSION_COMPLETE_TAG}。否则，请继续讨论。`;

          const cognitoReplyParsedResponse = await commonAIStepExecution(
              cognitoReplyStepIdentifier, cognitoReplyPromptText, effectiveCognitoModel, MessageSender.Cognito, MessagePurpose.CognitoToMuse, imageApiPartForFlow,
              userInputForFlow, imageApiPartForFlow, [...localDiscussionLog], turn, localPreviousAISignaledStop, getAllMessages()
          );
          if (cancelRequestRef.current) return;
          processNotepadUpdateFromAI(cognitoReplyParsedResponse, MessageSender.Cognito, addMessage);
          const prevSignalBeforeCognito = localPreviousAISignaledStop;
          localLastTurnTextForLog = cognitoReplyParsedResponse.spokenText; localDiscussionLog.push(`${MessageSender.Cognito}: ${localLastTurnTextForLog}`); setDiscussionLog([...localDiscussionLog]);
          localPreviousAISignaledStop = cognitoReplyParsedResponse.discussionShouldEnd || false;

          if (discussionMode === DiscussionMode.AiDriven) {
              if (localPreviousAISignaledStop && prevSignalBeforeCognito) {
                  addMessage(`双方AI (${MessageSender.Muse} 和 ${MessageSender.Cognito}) 已同意结束讨论。`, MessageSender.System, MessagePurpose.SystemNotification);
                  setIsInternalDiscussionActive(false); break;
              } else if (localPreviousAISignaledStop) {
                  addMessage(`${MessageSender.Cognito} 已建议结束讨论。等待 ${MessageSender.Muse} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
              }
          }
          if (cancelRequestRef.current) break;
        }
      }
      setIsInternalDiscussionActive(false); 

      if (cancelRequestRef.current) return;

      const finalAnswerStepIdentifier = 'cognito-final-answer';
      addMessage(`${MessageSender.Cognito} 正在综合讨论内容，准备最终答案 (使用 ${effectiveCognitoModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);

      const finalAnswerPromptText = `用户的查询 (中文) 是: "${userInputForFlow}". ${imageInstructionForAI} 您 (${MessageSender.Cognito}) 和 ${MessageSender.Muse} 进行了以下讨论 (均为中文):\n${localDiscussionLog.join("\n")}

**您的最终任务是为用户生成最终答案，并将其放入记事本中。**

**指令:**
1.  **生成最终答案:** 基于整个对话和当前记事本内容，综合所有要点，为用户创建一个全面、结构良好、易于理解的最终答案。答案必须是中文，并使用 Markdown 格式化以提高可读性。
2.  **更新记事本:** 使用 <np-replace-all> 标签将完整的最终答案放入记事本。这将是用户看到的主要输出。
3.  **口头回复:** 你的口头回复 (在 <np-replace-all> 标签之前的部分) 应该非常简短。只需告诉用户最终答案已在记事本中准备好。例如："最终答案已为您准备好，请查看右侧的记事本。"

**严格遵守以上指令。最终答案必须在记事本中。**
\n${commonPromptInstructions()}`;

      const finalAnswerParsedResponse = await commonAIStepExecution(
          finalAnswerStepIdentifier, finalAnswerPromptText, effectiveCognitoModel, MessageSender.Cognito, MessagePurpose.FinalResponse, imageApiPartForFlow,
          userInputForFlow, imageApiPartForFlow, [...localDiscussionLog], undefined, undefined, getAllMessages()
      );
      if (cancelRequestRef.current) return;
      processNotepadUpdateFromAI(finalAnswerParsedResponse, MessageSender.Cognito, addMessage);

    } catch (error) {
      const e = error as Error;
      if (cancelRequestRef.current) { /* User cancelled */ }
      else if (!e.message.includes("API密钥") && !e.message.toLowerCase().includes("api key")) { 
        console.error("继续讨论流程中发生错误:", error);
      }
      setIsInternalDiscussionActive(false);
    } finally {
      if (!failedStepInfo || cancelRequestRef.current) {
         setIsLoading(false);
         stopProcessingTimer();
         if (!cancelRequestRef.current && !failedStepInfo) {
            let completedTurns = 0;
            if (discussionLog.length > 1) {
                if (discussionMode === DiscussionMode.FixedTurns) {
                    completedTurns = manualFixedTurns;
                } else {
                    completedTurns = currentDiscussionTurn + 1;
                }
            }
            setLastCompletedTurnCount(completedTurns);
        } else if (cancelRequestRef.current && !failedStepInfo) {
            setLastCompletedTurnCount(0);
        }
      }
      if (cancelRequestRef.current && !failedStepInfo) {
        addMessage("用户已停止AI响应。", MessageSender.System, MessagePurpose.SystemNotification);
      }
      setIsInternalDiscussionActive(false);
    }
  }, [
      addMessage, commonAIStepExecution, processNotepadUpdateFromAI, setDiscussionLog, 
      discussionMode, manualFixedTurns, cognitoModelDetails, museModelDetails, notepadContent, 
      setIsLoading, stopProcessingTimer, failedStepInfo, setIsInternalDiscussionActive, currentDiscussionTurn, setLastCompletedTurnCount
    ]);

  const startChatProcessing = useCallback(async (userInput: string, imageFile?: File | null) => {
    if (isLoading) return;
    if (!userInput.trim() && !imageFile) return;

    cancelRequestRef.current = false;
    setIsLoading(true);
    setFailedStepInfo(null);
    setDiscussionLog([]);
    setCurrentDiscussionTurn(0);
    setIsInternalDiscussionActive(false);
    setGlobalApiKeyStatus({}); 
    startProcessingTimer();

    let userImageForDisplay: ChatMessage['image'] | undefined = undefined;
    let geminiImageApiPart: { inlineData: { mimeType: string; data: string } } | undefined = undefined;

    if (imageFile) {
      try {
        const dataUrl = URL.createObjectURL(imageFile); 
        userImageForDisplay = { dataUrl, name: imageFile.name, type: imageFile.type };
        const base64Data = await fileToBase64(imageFile); 
        geminiImageApiPart = { inlineData: { mimeType: imageFile.type, data: base64Data } };
      } catch (error) {
        console.error("图片处理失败:", error);
        addMessage("图片处理失败，请重试。", MessageSender.System, MessagePurpose.SystemNotification);
        setIsLoading(false);
        stopProcessingTimer();
        if (userImageForDisplay?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(userImageForDisplay.dataUrl);
        return;
      }
    }

    addMessage(userInput, MessageSender.User, MessagePurpose.UserInput, undefined, userImageForDisplay);

    let currentLocalDiscussionLog: string[] = [];
    let lastTurnTextForLog = "";

    const effectiveCognitoModel = cognitoModelDetails; 
    const effectiveMuseModel = museModelDetails;     

    const imageInstructionForAI = geminiImageApiPart ? "用户还提供了一张图片。请在您的分析和回复中同时考虑此图片和文本查询。" : "";
    const discussionModeInstructionText = discussionMode === DiscussionMode.AiDriven ? AI_DRIVEN_DISCUSSION_INSTRUCTION_PROMPT_PART : "";
    const commonPromptInstructions = () => NOTEPAD_INSTRUCTION_PROMPT_PART.replace('{notepadContent}', formatNotepadContentForAI(notepadContent)) + discussionModeInstructionText;

    try {
      const cognitoInitialStepIdentifier = 'cognito-initial-to-muse';
      addMessage(`${MessageSender.Cognito} 正在为 ${MessageSender.Muse} 准备第一个观点 (使用 ${effectiveCognitoModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
      const cognitoPromptText = `${`用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 请针对此查询提供您的初步想法或分析，以便 ${MessageSender.Muse} (创意型AI) 可以回应并与您开始讨论。用中文回答。`}\n${commonPromptInstructions()}`;

      const cognitoParsedResponse = await commonAIStepExecution(
          cognitoInitialStepIdentifier, cognitoPromptText, effectiveCognitoModel, MessageSender.Cognito, MessagePurpose.CognitoToMuse, geminiImageApiPart,
          userInput, geminiImageApiPart, [] 
      );
      if (cancelRequestRef.current) throw new Error("用户取消操作");
      processNotepadUpdateFromAI(cognitoParsedResponse, MessageSender.Cognito, addMessage);
      lastTurnTextForLog = cognitoParsedResponse.spokenText;
      currentLocalDiscussionLog.push(`${MessageSender.Cognito}: ${lastTurnTextForLog}`);
      setDiscussionLog([...currentLocalDiscussionLog]);

      setIsInternalDiscussionActive(true); 
      setCurrentDiscussionTurn(0); 

      let previousAISignaledStop = discussionMode === DiscussionMode.AiDriven && (cognitoParsedResponse.discussionShouldEnd || false);
      if (previousAISignaledStop) addMessage(`${MessageSender.Cognito} 已建议结束讨论。等待 ${MessageSender.Muse} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);

      for (let turn = 0; ; turn++) {
        setCurrentDiscussionTurn(turn);
        if (cancelRequestRef.current) break;
        if (discussionMode === DiscussionMode.FixedTurns && turn >= manualFixedTurns) break;

        const museStepIdentifier = `muse-reply-to-cognito-turn-${turn}`;
        addMessage(`${MessageSender.Muse} 正在回应 ${MessageSender.Cognito} (使用 ${effectiveMuseModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
        let musePromptText = `用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 当前讨论 (均为中文):\n${currentLocalDiscussionLog.join("\n")}\n${MessageSender.Cognito} (逻辑AI) 刚刚说 (中文): "${lastTurnTextForLog}". 请回复 ${MessageSender.Cognito}。继续讨论。保持您的回复简洁并使用中文。\n${commonPromptInstructions()}`;
        if (discussionMode === DiscussionMode.AiDriven && previousAISignaledStop) musePromptText += `\n${MessageSender.Cognito} 已包含 ${DISCUSSION_COMPLETE_TAG} 建议结束讨论。如果您同意，请在您的回复中也包含 ${DISCUSSION_COMPLETE_TAG}。否则，请继续讨论。`;

        // 🔍 DEBUG: AI间讨论 - Muse调用前的状态检查
        const currentMessages = getAllMessages();
        console.log(`[DEBUG-DISCUSSION-MUSE] Turn ${turn} Muse调用前状态:`, {
          currentMessages长度: currentMessages.length,
          currentLocalDiscussionLog长度: currentLocalDiscussionLog.length,
          currentLocalDiscussionLog内容: currentLocalDiscussionLog,
          用户原始输入: userInput,
          是否传递了完整历史: '❌ 未传递messageHistory参数！'
        });

        const museParsedResponse = await commonAIStepExecution(
            museStepIdentifier, musePromptText, effectiveMuseModel, MessageSender.Muse, MessagePurpose.MuseToCognito, geminiImageApiPart,
            userInput, geminiImageApiPart, [...currentLocalDiscussionLog], turn, previousAISignaledStop, getAllMessages()
        );
        if (cancelRequestRef.current) break;
        processNotepadUpdateFromAI(museParsedResponse, MessageSender.Muse, addMessage);
        const signalFromCognitoBeforeMuse = previousAISignaledStop;
        lastTurnTextForLog = museParsedResponse.spokenText; currentLocalDiscussionLog.push(`${MessageSender.Muse}: ${lastTurnTextForLog}`); setDiscussionLog([...currentLocalDiscussionLog]);
        previousAISignaledStop = museParsedResponse.discussionShouldEnd || false;

        if (discussionMode === DiscussionMode.AiDriven) {
            if (previousAISignaledStop && signalFromCognitoBeforeMuse) {
                addMessage(`双方AI (${MessageSender.Cognito} 和 ${MessageSender.Muse}) 已同意结束讨论。`, MessageSender.System, MessagePurpose.SystemNotification);
                setIsInternalDiscussionActive(false); break;
            } else if (previousAISignaledStop) {
                addMessage(`${MessageSender.Muse} 已建议结束讨论。等待 ${MessageSender.Cognito} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
            }
        }

        if (cancelRequestRef.current) break;
        if (discussionMode === DiscussionMode.FixedTurns && turn >= manualFixedTurns -1) { setIsInternalDiscussionActive(false); break; }

        const cognitoReplyStepIdentifier = `cognito-reply-to-muse-turn-${turn}`;
        addMessage(`${MessageSender.Cognito} 正在回应 ${MessageSender.Muse} (使用 ${effectiveCognitoModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
        let cognitoReplyPromptText = `用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 当前讨论 (均为中文):\n${currentLocalDiscussionLog.join("\n")}\n${MessageSender.Muse} (创意AI) 刚刚说 (中文): "${lastTurnTextForLog}". 请回复 ${MessageSender.Muse}。继续讨论。保持您的回复简洁并使用中文。\n${commonPromptInstructions()}`;
        if (discussionMode === DiscussionMode.AiDriven && previousAISignaledStop) cognitoReplyPromptText += `\n${MessageSender.Muse} 已包含 ${DISCUSSION_COMPLETE_TAG} 建议结束讨论。如果您同意，请在您的回复中也包含 ${DISCUSSION_COMPLETE_TAG}。否则，请继续讨论。`;

        // 🔍 DEBUG: AI间讨论 - Cognito回复调用前的状态检查
        console.log(`[DEBUG-DISCUSSION-COGNITO] Turn ${turn} Cognito回复调用前状态:`, {
          currentMessages长度: getAllMessages().length,
          currentLocalDiscussionLog长度: currentLocalDiscussionLog.length,
          是否传递了完整历史: '❌ 未传递messageHistory参数！'
        });

        const cognitoReplyParsedResponse = await commonAIStepExecution(
            cognitoReplyStepIdentifier, cognitoReplyPromptText, effectiveCognitoModel, MessageSender.Cognito, MessagePurpose.CognitoToMuse, geminiImageApiPart,
            userInput, geminiImageApiPart, [...currentLocalDiscussionLog], turn, previousAISignaledStop, getAllMessages()
        );
        if (cancelRequestRef.current) break;
        processNotepadUpdateFromAI(cognitoReplyParsedResponse, MessageSender.Cognito, addMessage);
        const signalFromMuseBeforeCognito = previousAISignaledStop;
        lastTurnTextForLog = cognitoReplyParsedResponse.spokenText; currentLocalDiscussionLog.push(`${MessageSender.Cognito}: ${lastTurnTextForLog}`); setDiscussionLog([...currentLocalDiscussionLog]);
        previousAISignaledStop = cognitoReplyParsedResponse.discussionShouldEnd || false;

        if (discussionMode === DiscussionMode.AiDriven) {
            if (previousAISignaledStop && signalFromMuseBeforeCognito) {
                addMessage(`双方AI (${MessageSender.Muse} 和 ${MessageSender.Cognito}) 已同意结束讨论。`, MessageSender.System, MessagePurpose.SystemNotification);
                setIsInternalDiscussionActive(false); break;
            } else if (previousAISignaledStop) {
                addMessage(`${MessageSender.Cognito} 已建议结束讨论。等待 ${MessageSender.Muse} 的回应。`, MessageSender.System, MessagePurpose.SystemNotification);
            }
        }
      }
      setIsInternalDiscussionActive(false); 

      if (cancelRequestRef.current) throw new Error("用户取消操作");

      const finalAnswerStepIdentifier = 'cognito-final-answer';
      addMessage(`${MessageSender.Cognito} 正在综合讨论内容，准备最终答案 (使用 ${effectiveCognitoModel.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
      const finalAnswerPromptText = `用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 您 (${MessageSender.Cognito}) 和 ${MessageSender.Muse} 进行了以下讨论 (均为中文):\n${currentLocalDiscussionLog.join("\n")}

**您的最终任务是为用户生成最终答案，并将其放入记事本中。**

**指令:**
1.  **生成最终答案:** 基于整个对话和当前记事本内容，综合所有要点，为用户创建一个全面、结构良好、易于理解的最终答案。答案必须是中文，并使用 Markdown 格式化以提高可读性。
2.  **更新记事本:** 使用 <np-replace-all> 标签将完整的最终答案放入记事本。这将是用户看到的主要输出。
3.  **口头回复:** 你的口头回复 (在 <np-replace-all> 标签之前的部分) 应该非常简短。只需告诉用户最终答案已在记事本中准备好。例如："最终答案已为您准备好，请查看右侧的记事本。"

**严格遵守以上指令。最终答案必须在记事本中。**
\n${commonPromptInstructions()}`;

      // 🔍 DEBUG: 最终答案生成前的状态检查
      console.log(`[DEBUG-FINAL-ANSWER] 最终答案生成前状态:`, {
        currentMessages长度: getAllMessages().length,
        currentLocalDiscussionLog长度: currentLocalDiscussionLog.length,
        discussionLog完整内容: currentLocalDiscussionLog.join('\n'),
        是否传递了完整历史: '❌ 未传递messageHistory参数！'
      });

      const finalAnswerParsedResponse = await commonAIStepExecution(
          finalAnswerStepIdentifier, finalAnswerPromptText, effectiveCognitoModel, MessageSender.Cognito, MessagePurpose.FinalResponse, geminiImageApiPart,
          userInput, geminiImageApiPart, [...currentLocalDiscussionLog], undefined, undefined, getAllMessages()
      );
      if (cancelRequestRef.current) throw new Error("用户取消操作");
      processNotepadUpdateFromAI(finalAnswerParsedResponse, MessageSender.Cognito, addMessage);

    } catch (error) {
      const e = error as Error;
      if (cancelRequestRef.current) { /* User cancelled, handled by finally */ }
      else if (!e.message.includes("API密钥") && !e.message.toLowerCase().includes("api key")) { 
        console.error("聊天流程中发生错误:", error);
        addMessage(`错误: ${e.message}`, MessageSender.System, MessagePurpose.SystemNotification);
      }
      setIsInternalDiscussionActive(false);
    } finally {
      setIsLoading(false);
      stopProcessingTimer();
      setIsInternalDiscussionActive(false); 

      if (!cancelRequestRef.current && !failedStepInfo) {
        let completedTurns = 0;
        if (currentLocalDiscussionLog.length > 1) {
            if (discussionMode === DiscussionMode.FixedTurns) {
                completedTurns = manualFixedTurns;
            } else {
                completedTurns = currentDiscussionTurn + 1;
            }
        }
        setLastCompletedTurnCount(completedTurns);
      } else if (cancelRequestRef.current && !failedStepInfo) {
          setLastCompletedTurnCount(0);
      }

      if (userImageForDisplay?.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(userImageForDisplay.dataUrl);
      }
      if (cancelRequestRef.current && !failedStepInfo) {
        addMessage("用户已停止AI响应。", MessageSender.System, MessagePurpose.SystemNotification);
      }
    }
  }, [
      isLoading, setIsLoading, setFailedStepInfo, setDiscussionLog, setCurrentDiscussionTurn, 
      setIsInternalDiscussionActive, setGlobalApiKeyStatus, startProcessingTimer, stopProcessingTimer,
      addMessage, processNotepadUpdateFromAI, cognitoModelDetails, museModelDetails, discussionMode, 
      manualFixedTurns, notepadContent, commonAIStepExecution, failedStepInfo, currentDiscussionTurn, setLastCompletedTurnCount
    ]);

  const retryFailedStep = useCallback(async (stepToRetry: FailedStepPayload) => {
    if (isLoading) return;

    setIsLoading(true);
    cancelRequestRef.current = false;
    setGlobalApiKeyStatus({}); 
    startProcessingTimer();

    setFailedStepInfo(null);
    addMessage(
      `[${stepToRetry.sender} - ${stepToRetry.stepIdentifier}] 正在手动重试...`,
      MessageSender.System,
      MessagePurpose.SystemNotification
    );

    const modelForRetry = stepToRetry.sender === MessageSender.Cognito ? cognitoModelDetails : museModelDetails;
    const systemInstructionForRetry = stepToRetry.sender === MessageSender.Cognito ? cognitoSystemPrompt : museSystemPrompt;
    
    const updatedStepToRetry = { 
      ...stepToRetry, 
      systemInstruction: modelForRetry.supportsSystemInstruction ? systemInstructionForRetry : undefined,
      modelName: modelForRetry.apiName, 
    };

    let result: { text: string; durationMs: number; error?: string; requestDetails?: any; responseBody?: any } | undefined;

    try {
      const geminiImageApiPartForRetry = updatedStepToRetry.imageApiPart;
      const currentOpenAiModelIdForRetry = modelForRetry.apiName;
      
      // 获取当前消息历史用于重试
      const historyForRetry = getAllMessages();

      if (useOpenAiApiConfig) {
        result = await generateOpenAiResponse(
          updatedStepToRetry.prompt,
          currentOpenAiModelIdForRetry,
          openAiApiKey,
          openAiApiBaseUrl,
          updatedStepToRetry.systemInstruction,
          geminiImageApiPartForRetry ? { mimeType: geminiImageApiPartForRetry.inlineData.mimeType, data: geminiImageApiPartForRetry.inlineData.data } : undefined,
          temperature,
          historyForRetry  // 传递消息历史
        );
      } else {
        result = await generateGeminiResponse(
          updatedStepToRetry.prompt,
          modelForRetry.apiName,
          useCustomApiConfig,
          customApiKey,
          customApiEndpoint,
          updatedStepToRetry.systemInstruction,
          geminiImageApiPartForRetry,
          getThinkingConfigForGeminiModel(modelForRetry),
          temperature,
          historyForRetry  // 传递消息历史
        );
      }

      if (cancelRequestRef.current) throw new Error("用户已停止手动重试");
      if (result.error) {
         if (result.error === "API key not configured" || result.error.toLowerCase().includes("api key not provided")) {
             setGlobalApiKeyStatus({isMissing: true, message: result.text});
             throw new Error(result.text);
          }
          if (result.error === "API key invalid or permission denied") {
             setGlobalApiKeyStatus({isInvalid: true, message: result.text});
             throw new Error(result.text);
          }
        throw new Error(result.text);
      }
      setGlobalApiKeyStatus({ isMissing: false, isInvalid: false, message: undefined }); 

      const parsedResponseFromRetry = parseAIResponse(result.text);
      addMessage(parsedResponseFromRetry.spokenText, updatedStepToRetry.sender, updatedStepToRetry.purpose, result.durationMs);
      processNotepadUpdateFromAI(parsedResponseFromRetry, updatedStepToRetry.sender, addMessage);
      addMessage(`[${updatedStepToRetry.sender} - ${updatedStepToRetry.stepIdentifier}] 手动重试成功。后续流程将继续。`, MessageSender.System, MessagePurpose.SystemNotification);

      await continueDiscussionAfterSuccessfulRetry(
          {...updatedStepToRetry, imageApiPartForFlow: geminiImageApiPartForRetry}, 
          parsedResponseFromRetry
      );

    } catch (error) {
        const e = error as Error;
      if (cancelRequestRef.current) { /* User cancelled */ }
      else {
        console.error("手动重试失败:", error);
        let errorMsg = e.message || "未知错误";
        
        if (result?.requestDetails) {
          errorMsg += `\n请求详情: ${JSON.stringify(result.requestDetails, null, 2)}`;
        }
        if (result?.responseBody) {
          errorMsg += `\n响应内容: ${JSON.stringify(result.responseBody, null, 2)}`;
        }
        
        const displayErrorMessage = errorMsg.includes("API密钥") || errorMsg.toLowerCase().includes("api key") 
          ? errorMsg 
          : `[${updatedStepToRetry.sender} - ${updatedStepToRetry.stepIdentifier}] 手动重试失败: ${errorMsg}. 您可以再次尝试。`;

        const newErrorMsgId = addMessage(displayErrorMessage, MessageSender.System, MessagePurpose.SystemNotification);
        
        if (!errorMsg.includes("API密钥") && !errorMsg.toLowerCase().includes("api key")) {
            let thinkingConfigForNewFailure: {thinkingBudget: number} | undefined = undefined;
            if (!useOpenAiApiConfig) { 
                thinkingConfigForNewFailure = getThinkingConfigForGeminiModel(modelForRetry);
            }
            setFailedStepInfo({ 
              ...updatedStepToRetry, 
              originalSystemErrorMsgId: newErrorMsgId, 
              thinkingConfig: thinkingConfigForNewFailure 
            });
        }
      }
      if (!cancelRequestRef.current || failedStepInfo) { 
          setIsLoading(false);
          stopProcessingTimer();
      }
      setIsInternalDiscussionActive(false); 
      if (cancelRequestRef.current && !failedStepInfo) {
          addMessage("用户已停止手动重试。", MessageSender.System, MessagePurpose.SystemNotification);
      }
    }
  }, [
    isLoading, setIsLoading, setGlobalApiKeyStatus, startProcessingTimer, stopProcessingTimer, 
    setFailedStepInfo, addMessage, cognitoModelDetails, museModelDetails, cognitoSystemPrompt, 
    museSystemPrompt, useOpenAiApiConfig, openAiApiKey, openAiApiBaseUrl, useCustomApiConfig, 
    customApiKey, customApiEndpoint, getThinkingConfigForGeminiModel, processNotepadUpdateFromAI, 
    continueDiscussionAfterSuccessfulRetry, failedStepInfo, setIsInternalDiscussionActive, currentDiscussionTurn, setLastCompletedTurnCount, discussionMode, manualFixedTurns, discussionLog, temperature
  ]);

  const stopGenerating = useCallback(() => {
    cancelRequestRef.current = true;
    setIsInternalDiscussionActive(false);
    setIsLoading(false);
    stopProcessingTimer();
  }, [setIsInternalDiscussionActive, setIsLoading, stopProcessingTimer]);

  return {
    isLoading,
    discussionLog,
    failedStepInfo,
    startChatProcessing,
    retryFailedStep,
    stopGenerating,
    cancelRequestRef,
    currentDiscussionTurn,
    isInternalDiscussionActive,
    lastCompletedTurnCount,
  };
};