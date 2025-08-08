

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessage, MessageSender, MessagePurpose, DiscussionMode } from './types';
import ChatInput from './components/ChatInput';
import MessageBubble from './components/MessageBubble';
import Notepad from './components/Notepad';
import SettingsModal from './components/SettingsModal';
import SessionManager from './components/SessionManager';
import RoleManager from './components/RoleManager';
import {
  MODELS,
  DEFAULT_COGNITO_MODEL_API_NAME,
  DEFAULT_MUSE_MODEL_API_NAME,
  COGNITO_SYSTEM_PROMPT_HEADER,
  MUSE_SYSTEM_PROMPT_HEADER,
  DEFAULT_MANUAL_FIXED_TURNS,
  MIN_MANUAL_FIXED_TURNS,
  INITIAL_NOTEPAD_CONTENT,
  AiModel,
  // Gemini Custom API Keys
  CUSTOM_API_ENDPOINT_STORAGE_KEY,
  CUSTOM_API_KEY_STORAGE_KEY,
  USE_CUSTOM_API_CONFIG_STORAGE_KEY,
  // OpenAI Custom API Keys
  USE_OPENAI_API_CONFIG_STORAGE_KEY,
  OPENAI_API_BASE_URL_STORAGE_KEY,
  OPENAI_API_KEY_STORAGE_KEY,
  OPENAI_COGNITO_MODEL_ID_STORAGE_KEY,
  OPENAI_MUSE_MODEL_ID_STORAGE_KEY,
  DEFAULT_OPENAI_API_BASE_URL,
  DEFAULT_OPENAI_COGNITO_MODEL_ID,
  DEFAULT_OPENAI_MUSE_MODEL_ID,
  STREAM_MODE_STORAGE_KEY,
} from './constants';
import { BotMessageSquare, AlertTriangle, RefreshCcw as RefreshCwIcon, Settings2, Brain, Sparkles, History, Users, FileText } from 'lucide-react';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { cn } from './lib/utils'; 

import { useChatLogic } from './hooks/useChatLogic';
import { useNotepadLogic } from './hooks/useNotepadLogic';
import { useAppUI } from './hooks/useAppUI';
import { useChatSessions } from './hooks/useChatSessions';
import { useCustomRoles } from './hooks/useCustomRoles';
import { generateUniqueId, getWelcomeMessageText } from './utils/appUtils';

const DEFAULT_CHAT_PANEL_PERCENT = 60; 
const FONT_SIZE_STORAGE_KEY = 'dualAiChatFontSizeScale';
const DEFAULT_FONT_SIZE_SCALE = 0.875;
const DEFAULT_GEMINI_CUSTOM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

interface ApiKeyStatus {
  isMissing?: boolean;
  isInvalid?: boolean;
  message?: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Gemini Custom API Config State
  const [useCustomApiConfig, setUseCustomApiConfig] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY);
    return storedValue ? storedValue === 'true' : false; 
  });
  const [customApiEndpoint, setCustomApiEndpoint] = useState<string>(() => localStorage.getItem(CUSTOM_API_ENDPOINT_STORAGE_KEY) || DEFAULT_GEMINI_CUSTOM_API_ENDPOINT);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY) || '');
  
  // OpenAI-Compatible API Config State
  const [useOpenAiApiConfig, setUseOpenAiApiConfig] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(USE_OPENAI_API_CONFIG_STORAGE_KEY);
    // If Gemini custom config was already enabled from old storage, default OpenAI to false.
    if (useCustomApiConfig && storedValue === null) return false;
    return storedValue ? storedValue === 'true' : false;
  });
  const [openAiApiBaseUrl, setOpenAiApiBaseUrl] = useState<string>(() => localStorage.getItem(OPENAI_API_BASE_URL_STORAGE_KEY) || DEFAULT_OPENAI_API_BASE_URL);
  const [openAiApiKey, setOpenAiApiKey] = useState<string>(() => localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '');
  const [openAiCognitoModelId, setOpenAiCognitoModelId] = useState<string>(() => localStorage.getItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY) || DEFAULT_OPENAI_COGNITO_MODEL_ID);
  const [openAiMuseModelId, setOpenAiMuseModelId] = useState<string>(() => localStorage.getItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY) || DEFAULT_OPENAI_MUSE_MODEL_ID);


  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({});

  // Settings State
  const [selectedCognitoModelApiName, setSelectedCognitoModelApiName] = useState<string>(DEFAULT_COGNITO_MODEL_API_NAME);
  const [selectedMuseModelApiName, setSelectedMuseModelApiName] = useState<string>(DEFAULT_MUSE_MODEL_API_NAME);
  const [discussionMode, setDiscussionMode] = useState<DiscussionMode>(DiscussionMode.AiDriven);
  const [manualFixedTurns, setManualFixedTurns] = useState<number>(DEFAULT_MANUAL_FIXED_TURNS);
  const [isThinkingBudgetActive, setIsThinkingBudgetActive] = useState<boolean>(true); // Applicable to Gemini
  const [cognitoSystemPrompt, setCognitoSystemPrompt] = useState<string>(COGNITO_SYSTEM_PROMPT_HEADER);
  const [museSystemPrompt, setMuseSystemPrompt] = useState<string>(MUSE_SYSTEM_PROMPT_HEADER);
  const [fontSizeScale, setFontSizeScale] = useState<number>(() => {
    const storedScale = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return storedScale ? parseFloat(storedScale) : DEFAULT_FONT_SIZE_SCALE;
  });
  const [temperature, setTemperature] = useState<number>(() => {
    const storedTemp = localStorage.getItem('dualAiChatTemperature');
    return storedTemp ? parseFloat(storedTemp) : 1.0;
  });
  const [streamMode, setStreamMode] = useState<boolean>(() => {
    const storedStream = localStorage.getItem(STREAM_MODE_STORAGE_KEY);
    return storedStream ? storedStream === 'true' : false;
  });
  
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState<boolean>(true);

  // 新功能状态
  const [isSessionManagerOpen, setIsSessionManagerOpen] = useState<boolean>(false);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState<boolean>(false);
  const [currentCognitoRoleName, setCurrentCognitoRoleName] = useState<string>('cognito');
  const [currentMuseRoleName, setCurrentMuseRoleName] = useState<string>('muse');
  const [isMobile, setIsMobile] = useState<boolean>(false);


  const {
    isNotepadFullscreen,
    setIsNotepadFullscreen,
    chatPanelWidthPercent,
    currentTotalProcessingTimeMs,
    isSettingsModalOpen,
    toggleNotepadFullscreen,
    handleMouseDownOnResizer,
    handleResizerKeyDown,
    openSettingsModal,
    closeSettingsModal,
    startProcessingTimer,
    stopProcessingTimer,
    updateProcessingTimer,
    currentQueryStartTimeRef,
  } = useAppUI(DEFAULT_CHAT_PANEL_PERCENT, panelsContainerRef);

  // 会话管理hooks
  const {
    sessions,
    currentSessionId,
    createNewSession,
    updateCurrentSession,
    switchToSession,
    deleteSession,
    renameSession,
    exportSessions,
    importSessions,
    searchSessions,
  } = useChatSessions();

  // 角色管理hooks  
  const {
    allRoles,
    createRole,
    updateRole,
    deleteRole,
    getRoleByName,
    duplicateRole,
  } = useCustomRoles();

  // 当前选中的角色 - 必须在 getRoleByName 定义之后
  const currentCognitoRole = getRoleByName(currentCognitoRoleName) || getRoleByName('cognito') || {
    id: 'cognito-default',
    name: 'cognito',
    displayName: 'Cognito',
    systemPrompt: COGNITO_SYSTEM_PROMPT_HEADER,
    icon: '🧠',
    color: '#3B82F6',
    isBuiltIn: true,
    createdAt: new Date()
  };
  const currentMuseRole = getRoleByName(currentMuseRoleName) || getRoleByName('muse') || {
    id: 'muse-default',
    name: 'muse',
    displayName: 'Muse',
    systemPrompt: MUSE_SYSTEM_PROMPT_HEADER,
    icon: '✨',
    color: '#9333EA',
    isBuiltIn: true,
    createdAt: new Date()
  };

  const {
    notepadContent,
    lastNotepadUpdateBy,
    processNotepadUpdateFromAI,
    clearNotepadContent,
    setNotepadContentManual,
    undoNotepad,
    redoNotepad,
    canUndo,
    canRedo,
  } = useNotepadLogic(INITIAL_NOTEPAD_CONTENT);

  const addMessage = useCallback((
    text: string,
    sender: MessageSender,
    purpose: MessagePurpose,
    durationMs?: number,
    image?: ChatMessage['image']
  ): string => {
    const messageId = generateUniqueId();
    setMessages(prev => [...prev, {
      id: messageId,
      text,
      sender,
      purpose,
      timestamp: new Date(),
      durationMs,
      image,
    }]);
    return messageId;
  }, []);
  
  // Determine actual model details based on active API configuration
  const actualCognitoModelDetails: AiModel = useMemo(() => {
    if (useOpenAiApiConfig) {
      return {
        id: 'openai-cognito',
        name: `OpenAI Cognito: ${openAiCognitoModelId || '未指定'}`,
        apiName: openAiCognitoModelId || DEFAULT_OPENAI_COGNITO_MODEL_ID,
        supportsThinkingConfig: false, 
        supportsSystemInstruction: true, 
      };
    }
    return MODELS.find(m => m.apiName === selectedCognitoModelApiName) || MODELS[0];
  }, [useOpenAiApiConfig, openAiCognitoModelId, selectedCognitoModelApiName]);

  const actualMuseModelDetails: AiModel = useMemo(() => {
    if (useOpenAiApiConfig) {
      return { 
        id: 'openai-muse',
        name: `OpenAI Muse: ${openAiMuseModelId || '未指定'}`,
        apiName: openAiMuseModelId || DEFAULT_OPENAI_MUSE_MODEL_ID,
        supportsThinkingConfig: false,
        supportsSystemInstruction: true,
      };
    }
    return MODELS.find(m => m.apiName === selectedMuseModelApiName) || MODELS[0];
  }, [useOpenAiApiConfig, openAiMuseModelId, selectedMuseModelApiName]);


  const {
    isLoading,
    failedStepInfo,
    startChatProcessing,
    retryFailedStep,
    stopGenerating: stopChatLogicGeneration, 
    cancelRequestRef, 
    currentDiscussionTurn,
    isInternalDiscussionActive,
    lastCompletedTurnCount, // Added
  } = useChatLogic({
    addMessage,
    processNotepadUpdateFromAI,
    setGlobalApiKeyStatus: setApiKeyStatus,
    cognitoModelDetails: actualCognitoModelDetails, 
    museModelDetails: actualMuseModelDetails,    
    // Gemini Custom Config
    useCustomApiConfig, 
    customApiKey,
    customApiEndpoint,
    // OpenAI Custom Config
    useOpenAiApiConfig,
    openAiApiKey,
    openAiApiBaseUrl,
    openAiCognitoModelId,
    openAiMuseModelId,
    // Shared Settings
    discussionMode,
    manualFixedTurns,
    isThinkingBudgetActive, 
    cognitoSystemPrompt,
    museSystemPrompt,
    notepadContent, 
    startProcessingTimer,
    stopProcessingTimer,
    currentQueryStartTimeRef,
    temperature,
  });

  // Save Gemini custom config
  useEffect(() => { localStorage.setItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY, useCustomApiConfig.toString()); }, [useCustomApiConfig]);
  useEffect(() => { localStorage.setItem(CUSTOM_API_ENDPOINT_STORAGE_KEY, customApiEndpoint); }, [customApiEndpoint]);
  useEffect(() => { localStorage.setItem(CUSTOM_API_KEY_STORAGE_KEY, customApiKey); }, [customApiKey]);

  // Save OpenAI custom config
  useEffect(() => { localStorage.setItem(USE_OPENAI_API_CONFIG_STORAGE_KEY, useOpenAiApiConfig.toString()); }, [useOpenAiApiConfig]);
  useEffect(() => { localStorage.setItem(OPENAI_API_BASE_URL_STORAGE_KEY, openAiApiBaseUrl); }, [openAiApiBaseUrl]);
  useEffect(() => { localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, openAiApiKey); }, [openAiApiKey]);
  useEffect(() => { localStorage.setItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY, openAiCognitoModelId); }, [openAiCognitoModelId]);
  useEffect(() => { localStorage.setItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY, openAiMuseModelId); }, [openAiMuseModelId]);


  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSizeScale * 100}%`;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSizeScale.toString());
  }, [fontSizeScale]);

  useEffect(() => {
    localStorage.setItem('dualAiChatTemperature', temperature.toString());
  }, [temperature]);

  useEffect(() => {
    localStorage.setItem('dualAiChatStreamMode', streamMode.toString());
  }, [streamMode]);

  const initializeChat = useCallback(() => {
    setMessages([]);
    clearNotepadContent();
    setIsNotepadFullscreen(false); 
    setIsAutoScrollEnabled(true);
    setApiKeyStatus({});

    let missingKeyMsg = "";
    if (useOpenAiApiConfig) {
      if (!openAiApiBaseUrl.trim() || !openAiCognitoModelId.trim() || !openAiMuseModelId.trim()) {
        missingKeyMsg = "OpenAI API 配置不完整 (需要基地址和Cognito/Muse的模型ID)。请在设置中提供，或关闭“使用OpenAI API配置”。";
      }
    } else if (useCustomApiConfig) {
      if (!customApiKey.trim()) {
        missingKeyMsg = "自定义 Gemini API 密钥未在设置中提供。请在设置中输入密钥，或关闭“使用自定义API配置”。";
      }
    } else {
      if (!(process.env.API_KEY && process.env.API_KEY.trim() !== "")) {
        missingKeyMsg = "Google Gemini API 密钥未在环境变量中配置。请配置该密钥，或在设置中启用并提供自定义API配置。";
      }
    }

    if (missingKeyMsg) {
      const fullWarning = `严重警告：${missingKeyMsg} 在此之前，应用程序功能将受限。`;
      addMessage(fullWarning, MessageSender.System, MessagePurpose.SystemNotification);
      setApiKeyStatus({ isMissing: true, message: missingKeyMsg });
    } else {
      addMessage(
        getWelcomeMessageText(
            actualCognitoModelDetails.name, 
            actualMuseModelDetails.name, 
            discussionMode, 
            manualFixedTurns, 
            useOpenAiApiConfig, 
            openAiCognitoModelId, 
            openAiMuseModelId
        ),
        MessageSender.System,
        MessagePurpose.SystemNotification
      );
    }
  }, [addMessage, clearNotepadContent, actualCognitoModelDetails.name, actualMuseModelDetails.name, discussionMode, manualFixedTurns, setIsNotepadFullscreen, useCustomApiConfig, customApiKey, useOpenAiApiConfig, openAiApiBaseUrl, openAiApiKey, openAiCognitoModelId, openAiMuseModelId]);

  useEffect(() => {
    initializeChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCustomApiConfig, useOpenAiApiConfig]); // Re-initialize if API config mode changes

   useEffect(() => {
     const welcomeMessage = messages.find(msg => msg.sender === MessageSender.System && msg.text.startsWith("欢迎使用Dual AI Chat！"));
     if (welcomeMessage && !apiKeyStatus.isMissing && !apiKeyStatus.isInvalid) {
        setMessages(msgs => msgs.map(msg =>
            msg.id === welcomeMessage.id
            ? {...msg, text: getWelcomeMessageText(
                actualCognitoModelDetails.name, 
                actualMuseModelDetails.name, 
                discussionMode, 
                manualFixedTurns, 
                useOpenAiApiConfig, 
                openAiCognitoModelId, 
                openAiMuseModelId
            ) }
            : msg
        ));
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualCognitoModelDetails.name, actualMuseModelDetails.name, apiKeyStatus.isMissing, apiKeyStatus.isInvalid, discussionMode, manualFixedTurns, useOpenAiApiConfig, openAiCognitoModelId, openAiMuseModelId]); 


  useEffect(() => {
    let intervalId: number | undefined;
    if (isLoading && currentQueryStartTimeRef.current) {
      intervalId = window.setInterval(() => {
        if (currentQueryStartTimeRef.current && !cancelRequestRef.current) { 
          updateProcessingTimer();
        }
      }, 100);
    } else {
      if (intervalId) clearInterval(intervalId);
      if (!isLoading && currentQueryStartTimeRef.current !== null) {
         updateProcessingTimer(); 
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading, updateProcessingTimer, currentQueryStartTimeRef, cancelRequestRef]);

  const handleClearChat = useCallback(() => {
    if (isLoading) {
      stopChatLogicGeneration(); 
    }
    initializeChat(); 
  }, [isLoading, stopChatLogicGeneration, initializeChat]);

  const handleStopGeneratingAppLevel = useCallback(() => {
    stopChatLogicGeneration();
  }, [stopChatLogicGeneration]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isNotepadFullscreen) {
        toggleNotepadFullscreen();
      }
      if (event.key === 'Escape' && isSettingsModalOpen) {
        closeSettingsModal();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isNotepadFullscreen, toggleNotepadFullscreen, isSettingsModalOpen, closeSettingsModal]);

  const Separator = () => <div className="h-6 w-px bg-gray-300 mx-1 md:mx-1.5" aria-hidden="true"></div>;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    if (isAutoScrollEnabled && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isAutoScrollEnabled, scrollToBottom]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleChatScroll = useCallback(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const atBottom = scrollHeight - scrollTop - clientHeight < 20;

      if (atBottom) {
        setIsAutoScrollEnabled(true);
      } else {
        setIsAutoScrollEnabled(false);
      }
    }
  }, []);

  const apiKeyBannerMessage = useMemo(() => {
    if (!apiKeyStatus.message) return null;
    if (useOpenAiApiConfig) {
        if (apiKeyStatus.isMissing) return "OpenAI API 配置不完整 (需基地址和Cognito/Muse模型ID)。请在设置中提供，或关闭 OpenAI API 配置。";
        if (apiKeyStatus.isInvalid) return "提供的 OpenAI API 密钥无效或无法访问服务。请检查设置和网络。";
    } else if (useCustomApiConfig) {
        if (apiKeyStatus.isMissing) return "自定义 Gemini API 密钥缺失。请在设置中提供，或关闭自定义 Gemini API 配置。";
        if (apiKeyStatus.isInvalid) return "提供的自定义 Gemini API 密钥无效或权限不足。请检查设置中的密钥。";
    } else {
        if (apiKeyStatus.isMissing) return "环境变量中的 Google Gemini API 密钥缺失。请配置，或启用自定义 API 配置。";
        if (apiKeyStatus.isInvalid) return "环境变量中的 Google Gemini API 密钥无效或权限不足。请检查该密钥。";
    }
    return apiKeyStatus.message; 
  }, [apiKeyStatus, useCustomApiConfig, useOpenAiApiConfig]); 

  const handleUseCustomGeminiApiConfigChange = () => {
    if (!isLoading) {
      const newValue = !useCustomApiConfig;
      setUseCustomApiConfig(newValue);
      if (newValue && useOpenAiApiConfig) { 
        setUseOpenAiApiConfig(false);      
      }
    }
  };

  const handleUseOpenAiApiConfigChange = () => {
    if (!isLoading) {
      const newValue = !useOpenAiApiConfig;
      setUseOpenAiApiConfig(newValue);
      if (newValue && useCustomApiConfig) { 
        setUseCustomApiConfig(false);       
      }
    }
  };

  // 会话管理函数
  const handleCreateSession = useCallback((title?: string) => {
    createNewSession(title);
    setMessages([]);
    clearNotepadContent();
    setIsNotepadFullscreen(false);
    setIsAutoScrollEnabled(true);
    initializeChat();
  }, [createNewSession, clearNotepadContent, setIsNotepadFullscreen, initializeChat]);

  const handleSwitchSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      switchToSession(sessionId);
      setMessages(session.messages);
      // 这里需要更新notepad内容，但需要修改useNotepadLogic来支持设置内容
      setIsNotepadFullscreen(false);
      setIsAutoScrollEnabled(true);
    }
  }, [sessions, switchToSession]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      setMessages([]);
      clearNotepadContent();
      initializeChat();
    }
  }, [deleteSession, currentSessionId, clearNotepadContent, initializeChat]);

  // 角色管理函数
  const handleSelectRole = useCallback((roleName: string, type: 'cognito' | 'muse') => {
    if (type === 'cognito') {
      setCurrentCognitoRoleName(roleName);
      const role = getRoleByName(roleName);
      if (role) {
        setCognitoSystemPrompt(role.systemPrompt);
      }
    } else {
      setCurrentMuseRoleName(roleName);
      const role = getRoleByName(roleName);
      if (role) {
        setMuseSystemPrompt(role.systemPrompt);
      }
    }
  }, [getRoleByName]);

  // 保存会话状态
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      updateCurrentSession(messages, notepadContent);
    }
  }, [currentSessionId, messages, notepadContent, updateCurrentSession]);


  return (
    <div className={cn("flex flex-col h-screen bg-background shadow-2xl overflow-hidden border-x border-border", isNotepadFullscreen ? 'fixed inset-0 z-40' : 'relative')}>
      <header className={cn("p-3 md:p-4 bg-background border-b border-border flex flex-col lg:flex-row lg:items-center justify-between shrink-0 space-y-3 lg:space-y-0 lg:space-x-3", isNotepadFullscreen ? 'relative z-0' : 'relative z-10')}>
        <div className="flex items-center shrink-0">
          <BotMessageSquare size={28} className="mr-2 md:mr-3 text-primary" />
          <h1 className="text-lg md:text-xl lg:text-2xl font-semibold text-primary">Dual AI Chat</h1>
        </div>

        <div className="flex items-center space-x-1 md:space-x-2 flex-wrap justify-center lg:justify-end gap-y-2">
          {useOpenAiApiConfig ? (
            <>
              <div className="flex items-center p-2 bg-secondary rounded-md border" title={`OpenAI Cognito: ${openAiCognitoModelId || '未指定'}`}>
                <Brain size={18} className="mr-1.5 text-secondary-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-secondary-foreground whitespace-nowrap hidden sm:inline">Cognito:</span>
                <span className="text-sm font-medium text-secondary-foreground whitespace-nowrap ml-1 sm:ml-0">{openAiCognitoModelId || '未指定'}</span>
              </div>
              <Separator />
              <div className="flex items-center p-2 bg-accent rounded-md border" title={`OpenAI Muse: ${openAiMuseModelId || '未指定'}`}>
                <Sparkles size={18} className="mr-1.5 text-accent-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-accent-foreground whitespace-nowrap hidden sm:inline">Muse:</span>
                <span className="text-sm font-medium text-accent-foreground whitespace-nowrap ml-1 sm:ml-0">{openAiMuseModelId || '未指定'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center" title={`Cognito Model: ${actualCognitoModelDetails.name}`}>
                 <label htmlFor="cognitoModelSelector" className="sr-only">Cognito AI 模型</label>
                 <Brain size={18} className="mr-1.5 text-primary flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground mr-1 hidden sm:inline">Cognito:</span>
                <Select
                  value={selectedCognitoModelApiName}
                  onValueChange={setSelectedCognitoModelApiName}
                  disabled={isLoading || useOpenAiApiConfig}
                >
                  <SelectTrigger className="w-32 sm:w-40 md:w-44">
                    <SelectValue aria-label="选择Cognito的AI模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((model) => (
                      <SelectItem key={`cognito-${model.id}`} value={model.apiName}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center" title={`Muse Model: ${actualMuseModelDetails.name}`}>
                <label htmlFor="museModelSelector" className="sr-only">Muse AI 模型</label>
                <Sparkles size={18} className="mr-1.5 text-purple-600 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground mr-1 hidden sm:inline">Muse:</span>
                <Select
                  value={selectedMuseModelApiName}
                  onValueChange={setSelectedMuseModelApiName}
                  disabled={isLoading || useOpenAiApiConfig}
                >
                  <SelectTrigger className="w-32 sm:w-40 md:w-44">
                    <SelectValue aria-label="选择Muse的AI模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((model) => (
                      <SelectItem key={`muse-${model.id}`} value={model.apiName}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <Separator />
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleNotepadFullscreen}
              aria-label="记事本" 
              title="打开记事本" 
              disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}
            >
              <FileText size={20} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSessionManagerOpen(true)}
            aria-label="会话管理" 
            title="会话管理" 
            disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}
          >
            <History size={20} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsRoleManagerOpen(true)}
            aria-label="角色管理" 
            title="角色管理" 
            disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}
          >
            <Users size={20} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openSettingsModal}
            aria-label="打开设置" 
            title="打开设置" 
            disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}
          >
            <Settings2 size={20} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            aria-label="清空会话" 
            title="清空会话" 
            disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}
          >
            <RefreshCwIcon size={20} />
          </Button>
        </div>
      </header>

      <div ref={panelsContainerRef} className={`flex flex-row flex-grow overflow-hidden ${isNotepadFullscreen ? 'relative' : ''}`}>
        {!isNotepadFullscreen && (
          <div
            id="chat-panel-wrapper"
            className="flex flex-col h-full overflow-hidden w-full lg:w-auto"
            style={{ width: isMobile ? '100%' : `${chatPanelWidthPercent}%` }}
          >
            <div className="flex flex-col flex-grow h-full"> 
              <div 
                ref={chatContainerRef} 
                className="flex-grow p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto bg-muted/30 scroll-smooth overscroll-contain"
                onScroll={handleChatScroll}
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    failedStepPayloadForThisMessage={failedStepInfo && msg.id === failedStepInfo.originalSystemErrorMsgId ? failedStepInfo : null}
                    onManualRetry={retryFailedStep} 
                  />
                ))}
              </div>
              <ChatInput
                onSendMessage={startChatProcessing} 
                isLoading={isLoading}
                isApiKeyMissing={apiKeyStatus.isMissing || apiKeyStatus.isInvalid || false}
                onStopGenerating={handleStopGeneratingAppLevel}
              />
              <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/50">
                {isLoading ? (
                  isInternalDiscussionActive ? (
                    <>
                      <span>
                        AI 内部讨论: 第 {currentDiscussionTurn + 1} 轮
                        {discussionMode === DiscussionMode.FixedTurns && ` / ${manualFixedTurns} 轮`}
                      </span>
                      {currentTotalProcessingTimeMs > 0 && (
                        <>
                          <span className="mx-2" aria-hidden="true">|</span>
                          <span>耗时: {(currentTotalProcessingTimeMs / 1000).toFixed(2)}s</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span>
                      AI 正在处理...
                      {currentTotalProcessingTimeMs > 0 && ` 耗时: ${(currentTotalProcessingTimeMs / 1000).toFixed(2)}s`}
                    </span>
                  )
                ) : (
                  <span>
                    准备就绪
                    {currentTotalProcessingTimeMs > 0 && ` | 上次耗时: ${(currentTotalProcessingTimeMs / 1000).toFixed(2)}s`}
                    {lastCompletedTurnCount > 0 && ` | 上次轮数: ${lastCompletedTurnCount}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!isNotepadFullscreen && (
          <div
            id="panel-resizer"
            className="w-1.5 h-full bg-border hover:bg-primary cursor-col-resize select-none shrink-0 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-ring hidden lg:block"
            onMouseDown={handleMouseDownOnResizer}
            onKeyDown={handleResizerKeyDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动以调整聊天和记事本面板大小"
            aria-controls="chat-panel-wrapper notepad-panel-wrapper"
            aria-valuenow={chatPanelWidthPercent}
            aria-valuemin={20} 
            aria-valuemax={80} 
            tabIndex={0}
            title="拖动或使用方向键调整大小"
          />
        )}
        
        <div
          id="notepad-panel-wrapper"
          className={cn("h-full bg-background flex-col", 
            isNotepadFullscreen 
            ? 'fixed inset-0 z-50 w-screen flex' 
            : 'overflow-hidden hidden lg:flex'
          )}
          style={!isNotepadFullscreen && !isMobile ? { width: `${100 - chatPanelWidthPercent}%` } : {}}
        >
          <Notepad
            content={notepadContent}
            lastUpdatedBy={lastNotepadUpdateBy}
            isLoading={isLoading}
            isNotepadFullscreen={isNotepadFullscreen}
            onToggleFullscreen={toggleNotepadFullscreen}
            onUndo={undoNotepad}
            onRedo={redoNotepad}
            canUndo={canUndo}
            canRedo={canRedo}
            onContentChange={setNotepadContentManual}
          />
        </div>
      </div>

       {(apiKeyStatus.isMissing || apiKeyStatus.isInvalid) && apiKeyBannerMessage &&
        !isNotepadFullscreen &&
        (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg shadow-lg flex items-center text-sm z-50 max-w-md text-center">
            <AlertTriangle size={20} className="mr-2 shrink-0" /> {apiKeyBannerMessage}
        </div>
      )}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={closeSettingsModal}
          discussionMode={discussionMode}
          onDiscussionModeChange={(mode) => setDiscussionMode(mode)}
          manualFixedTurns={manualFixedTurns}
          onManualFixedTurnsChange={(e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) value = DEFAULT_MANUAL_FIXED_TURNS;
            value = Math.max(MIN_MANUAL_FIXED_TURNS, value); 
            setManualFixedTurns(value);
          }}
          minManualFixedTurns={MIN_MANUAL_FIXED_TURNS}
          isThinkingBudgetActive={isThinkingBudgetActive}
          onThinkingBudgetToggle={() => setIsThinkingBudgetActive(prev => !prev)}
          supportsThinkingConfig={Boolean(actualCognitoModelDetails.supportsThinkingConfig || actualMuseModelDetails.supportsThinkingConfig)}
          cognitoSystemPrompt={cognitoSystemPrompt}
          onCognitoPromptChange={(e) => setCognitoSystemPrompt(e.target.value)}
          onResetCognitoPrompt={() => setCognitoSystemPrompt(COGNITO_SYSTEM_PROMPT_HEADER)}
          museSystemPrompt={museSystemPrompt}
          onMusePromptChange={(e) => setMuseSystemPrompt(e.target.value)}
          onResetMusePrompt={() => setMuseSystemPrompt(MUSE_SYSTEM_PROMPT_HEADER)}
          supportsSystemInstruction={Boolean(actualCognitoModelDetails.supportsSystemInstruction || actualMuseModelDetails.supportsSystemInstruction)}
          isLoading={isLoading}
          fontSizeScale={fontSizeScale}
          onFontSizeScaleChange={setFontSizeScale}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          streamMode={streamMode}
          onStreamModeChange={setStreamMode}
          // Gemini Custom API Props
          useCustomApiConfig={useCustomApiConfig}
          onUseCustomApiConfigChange={handleUseCustomGeminiApiConfigChange}
          customApiEndpoint={customApiEndpoint}
          onCustomApiEndpointChange={(e) => setCustomApiEndpoint(e.target.value)}
          customApiKey={customApiKey}
          onCustomApiKeyChange={(e) => setCustomApiKey(e.target.value)}
          // OpenAI Custom API Props
          useOpenAiApiConfig={useOpenAiApiConfig}
          onUseOpenAiApiConfigChange={handleUseOpenAiApiConfigChange}
          openAiApiBaseUrl={openAiApiBaseUrl}
          onOpenAiApiBaseUrlChange={(e) => setOpenAiApiBaseUrl(e.target.value)}
          openAiApiKey={openAiApiKey}
          onOpenAiApiKeyChange={(e) => setOpenAiApiKey(e.target.value)}
          openAiCognitoModelId={openAiCognitoModelId}
          onOpenAiCognitoModelIdChange={(e) => setOpenAiCognitoModelId(e.target.value)}
          openAiMuseModelId={openAiMuseModelId}
          onOpenAiMuseModelIdChange={(e) => setOpenAiMuseModelId(e.target.value)}
        />
      )}
      
      {/* 会话管理器 */}
      {isSessionManagerOpen && (
        <SessionManager
          sessions={sessions}
          currentSessionId={currentSessionId}
          onCreateSession={handleCreateSession}
          onSwitchSession={handleSwitchSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={renameSession}
          onExportSessions={exportSessions}
          onImportSessions={importSessions}
          onSearchSessions={searchSessions}
          onClose={() => setIsSessionManagerOpen(false)}
        />
      )}
      
      {/* 角色管理器 */}
      {isRoleManagerOpen && (
        <RoleManager
          roles={allRoles}
          currentCognitoRole={currentCognitoRole}
          currentMuseRole={currentMuseRole}
          onCreateRole={createRole}
          onUpdateRole={updateRole}
          onDeleteRole={deleteRole}
          onDuplicateRole={duplicateRole}
          onSelectRole={handleSelectRole}
          onClose={() => setIsRoleManagerOpen(false)}
        />
      )}
    </div>
  );
};

export default App;