import React, { useState } from 'react';
import { DiscussionMode } from '../types';
import { Bot, MessagesSquare, SlidersHorizontal, Info, RotateCcw, CaseSensitive, KeyRound, Globe, Settings, Database, Brain, Sparkles, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { cn } from '../lib/utils';
import ApiChannelSettings from './ApiChannelSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionMode: DiscussionMode;
  onDiscussionModeChange: (mode: DiscussionMode) => void;
  manualFixedTurns: number;
  onManualFixedTurnsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  minManualFixedTurns: number;
  isThinkingBudgetActive: boolean;
  onThinkingBudgetToggle: () => void;
  supportsThinkingConfig: boolean; 
  cognitoSystemPrompt: string;
  onCognitoPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onResetCognitoPrompt: () => void;
  museSystemPrompt: string;
  onMusePromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onResetMusePrompt: () => void;
  supportsSystemInstruction: boolean; 
  isLoading: boolean;
  fontSizeScale: number;
  onFontSizeScaleChange: (scale: number) => void;
  temperature: number;
  onTemperatureChange: (temperature: number) => void;
  streamMode: boolean;
  onStreamModeChange: (enabled: boolean) => void;
  
  // Gemini Custom API
  useCustomApiConfig: boolean; 
  onUseCustomApiConfigChange: () => void; 
  customApiEndpoint: string;
  onCustomApiEndpointChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  customApiKey: string;
  onCustomApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // OpenAI Custom API
  useOpenAiApiConfig: boolean;
  onUseOpenAiApiConfigChange: () => void;
  openAiApiBaseUrl: string;
  onOpenAiApiBaseUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openAiApiKey: string;
  onOpenAiApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openAiCognitoModelId: string;
  onOpenAiCognitoModelIdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openAiMuseModelId: string;
  onOpenAiMuseModelIdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FONT_SIZE_OPTIONS = [
  { label: '小', value: 0.875 },
  { label: '中', value: 1.0 },
  { label: '大', value: 1.125 },
  { label: '特大', value: 1.25 },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  discussionMode,
  onDiscussionModeChange,
  manualFixedTurns,
  onManualFixedTurnsChange,
  minManualFixedTurns,
  isThinkingBudgetActive,
  onThinkingBudgetToggle,
  supportsThinkingConfig,
  cognitoSystemPrompt,
  onCognitoPromptChange,
  onResetCognitoPrompt,
  museSystemPrompt,
  onMusePromptChange,
  onResetMusePrompt,
  supportsSystemInstruction,
  isLoading,
  fontSizeScale,
  onFontSizeScaleChange,
  temperature,
  onTemperatureChange,
  streamMode,
  onStreamModeChange,
  useCustomApiConfig,
  onUseCustomApiConfigChange,
  customApiEndpoint,
  onCustomApiEndpointChange,
  customApiKey,
  onCustomApiKeyChange,
  useOpenAiApiConfig,
  onUseOpenAiApiConfigChange,
  openAiApiBaseUrl,
  onOpenAiApiBaseUrlChange,
  openAiApiKey,
  onOpenAiApiKeyChange,
  openAiCognitoModelId,
  onOpenAiCognitoModelIdChange,
  openAiMuseModelId,
  onOpenAiMuseModelIdChange,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'advanced'>('general');
  
  if (!isOpen) return null;

  const handleDiscussionModeToggle = () => {
    if (!isLoading) {
      onDiscussionModeChange(discussionMode === DiscussionMode.FixedTurns ? DiscussionMode.AiDriven : DiscussionMode.FixedTurns);
    }
  };
  
  const actualSupportsThinkingConfig = supportsThinkingConfig && !useOpenAiApiConfig;
  const handleThinkingBudgetToggle = () => {
    if (!isLoading && actualSupportsThinkingConfig) {
      onThinkingBudgetToggle();
    }
  };

  const handleUseCustomGeminiApiConfigToggle = () => {
    if (!isLoading) {
      onUseCustomApiConfigChange(); 
    }
  }

  const handleUseOpenAiApiConfigToggle = () => {
    if (!isLoading) {
      onUseOpenAiApiConfigChange(); 
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-5xl w-[95vw] max-h-[95vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-semibold text-primary">应用程序设置</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            配置您的 AI 聊天应用程序设置
          </DialogDescription>
        </DialogHeader>

        {/* 标签页导航 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'general'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <Settings size={16} />
              常规设置
            </div>
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'channels'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <Zap size={16} />
              API 渠道
            </div>
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'advanced'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} />
              高级设置
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[70vh] sm:max-h-[60vh] pr-2">
          {/* 常规设置标签页 */}
          {activeTab === 'general' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Font Size Settings Section */}
              <section aria-labelledby="font-size-settings-heading">
                <h3 id="font-size-settings-heading" className="text-base sm:text-lg font-medium text-foreground mb-3 border-b pb-2">文字大小</h3>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-2">
                      <CaseSensitive size={20} className="text-primary flex-shrink-0" />
                      <label className="text-sm font-medium">界面文字大小:</label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    {FONT_SIZE_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          variant={fontSizeScale === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => !isLoading && onFontSizeScaleChange(option.value)}
                          disabled={isLoading}
                          aria-pressed={fontSizeScale === option.value}
                          aria-label={`设置字体大小为${option.label}`}
                          className="min-w-[3rem]"
                        >
                          {option.label}
                        </Button>
                    ))}
                    </div>
                </div>
              </section>

              {/* Discussion Settings Section */}
              <section aria-labelledby="discussion-settings-heading">
                <h3 id="discussion-settings-heading" className="text-base sm:text-lg font-medium text-foreground mb-3 border-b pb-2">讨论设置</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="discussionModeToggleModal" className="flex items-center text-sm font-medium cursor-pointer"
                      title={discussionMode === DiscussionMode.FixedTurns ? "切换到AI驱动轮次模式" : "切换到固定轮次模式"}>
                      {discussionMode === DiscussionMode.FixedTurns ? <MessagesSquare size={20} className="mr-2 text-primary" /> : <Bot size={20} className="mr-2 text-primary" />}
                      <span>对话轮数模式</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="discussionModeToggleModal"
                        checked={discussionMode === DiscussionMode.AiDriven}
                        onCheckedChange={handleDiscussionModeToggle}
                        disabled={isLoading}
                        aria-label="切换对话模式"
                      />
                      <span className="text-sm text-muted-foreground min-w-[4rem]">
                        {discussionMode === DiscussionMode.FixedTurns ? '固定轮次' : 'AI驱动'}
                      </span>
                    </div>
                  </div>
                  {discussionMode === DiscussionMode.FixedTurns && (
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 pl-6 bg-muted/30 p-3 rounded-md">
                      <label htmlFor="manualFixedTurnsInputModal" className="text-sm font-medium">固定轮数:</label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          id="manualFixedTurnsInputModal"
                          value={manualFixedTurns}
                          onChange={onManualFixedTurnsChange}
                          min={minManualFixedTurns}
                          disabled={isLoading}
                          className="w-20 text-center"
                          aria-label={`设置固定对话轮数, 最小 ${minManualFixedTurns}`}
                        />
                        <span className="text-sm text-muted-foreground">轮 (最小: {minManualFixedTurns})</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Model Performance Section */}
              <section aria-labelledby="performance-settings-heading">
                <h3 id="performance-settings-heading" className="text-base sm:text-lg font-medium text-foreground mb-3 border-b pb-2">模型性能</h3>
                <div className="space-y-6">
                  {/* Temperature Control */}
                  <div>
                    <label htmlFor="temperatureSlider" className="flex items-center text-sm font-medium mb-3">
                      <SlidersHorizontal size={16} className="mr-2 text-primary" />
                      温度设置: {temperature.toFixed(1)}
                    </label>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-muted-foreground w-8">0.0</span>
                      <Slider
                        id="temperatureSlider"
                        min={0}
                        max={2}
                        step={0.1}
                        value={[temperature]}
                        onValueChange={(value) => !isLoading && onTemperatureChange(value[0])}
                        disabled={isLoading}
                        className="flex-1"
                        aria-label="调整AI模型温度"
                      />
                      <span className="text-xs text-muted-foreground w-8">2.0</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      低温度 (0.0-0.7): 更精确、一致的回答; 高温度 (0.8-2.0): 更创意、多样的回答
                    </p>
                  </div>

                  {/* Streaming Mode */}
                  <div className="flex items-center justify-between">
                    <label htmlFor="streamModeToggleModal" className="flex items-center text-sm font-medium cursor-pointer"
                        title="启用后将实时显示AI回复，提供更好的用户体验">
                        <SlidersHorizontal size={20} className="mr-2 text-primary" />
                        <span>流式返回模式</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="streamModeToggleModal"
                        checked={streamMode}
                        onCheckedChange={() => !isLoading && onStreamModeChange(!streamMode)}
                        disabled={isLoading}
                        aria-label="切换流式返回模式"
                      />
                      <span className="text-sm text-muted-foreground min-w-[3rem]">
                        {streamMode ? '开启' : '关闭'}
                      </span>
                    </div>
                  </div>

                  {/* Thinking Budget */}
                  <div className="flex items-center justify-between">
                    <label htmlFor="thinkingBudgetToggleModal" className="flex items-center text-sm font-medium cursor-pointer"
                        title={actualSupportsThinkingConfig ? "切换AI思考预算 (仅Gemini Flash/Pro模型)。优质模式可获得更高质量回复。" : "当前模型或API配置不支持思考预算。"}>
                        <SlidersHorizontal size={20} className={cn("mr-2", actualSupportsThinkingConfig && isThinkingBudgetActive ? 'text-primary' : 'text-muted-foreground')} />
                        <span>AI思考预算 (Gemini)</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="thinkingBudgetToggleModal"
                        checked={isThinkingBudgetActive && actualSupportsThinkingConfig}
                        onCheckedChange={handleThinkingBudgetToggle}
                        disabled={isLoading || !actualSupportsThinkingConfig}
                        aria-label="切换AI思考预算"
                      />
                      <span className="text-sm text-muted-foreground min-w-[3rem]">
                        {actualSupportsThinkingConfig ? (isThinkingBudgetActive ? '优质' : '标准') : 'N/A'}
                      </span>
                    </div>
                  </div>
                  {!actualSupportsThinkingConfig && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-xs text-amber-700 flex items-center">
                        <Info size={14} className="mr-1 flex-shrink-0" />
                        当前选定模型或API配置不支持思考预算功能。
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* API 渠道标签页 */}
          {activeTab === 'channels' && (
            <ApiChannelSettings />
          )}

          {/* 高级设置标签页 */}
          {activeTab === 'advanced' && (
            <div className="space-y-4 sm:space-y-6">
              {/* API Configuration Section */}
              <section aria-labelledby="api-config-settings-heading">
                <h3 id="api-config-settings-heading" className="text-base sm:text-lg font-medium text-foreground mb-3 border-b pb-2">传统 API 配置</h3>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md mb-4">
                  <p className="text-sm text-amber-800 flex items-center">
                    <Info size={16} className="mr-2 flex-shrink-0" />
                    建议使用新的"API 渠道"功能来管理 API 配置，以下为传统配置选项，仅供兼容使用。
                  </p>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {/* Gemini Custom API */}
                  <div className={cn("p-4 border rounded-lg", useCustomApiConfig ? 'border-primary bg-primary/5' : 'border-border bg-muted/50')}>
                    <div className="flex items-center justify-between mb-3">
                      <label htmlFor="useCustomGeminiApiToggle" className="flex items-center text-sm font-medium cursor-pointer"
                        title={useCustomApiConfig ? "禁用自定义Gemini API配置" : "启用自定义Gemini API配置"}>
                        <Settings size={20} className="mr-2 text-primary" />
                        <span>使用自定义 Gemini API 配置</span>
                      </label>
                      <div className="flex items-center space-x-5">
                        <Switch
                          id="useCustomGeminiApiToggle"
                          checked={useCustomApiConfig}
                          onCheckedChange={handleUseCustomGeminiApiConfigToggle}
                          disabled={isLoading}
                          aria-label="切换自定义 Gemini API 配置"
                          className="shrink-0"
                        />
                        <span className="text-sm text-muted-foreground min-w-[4rem] shrink-0">
                          {useCustomApiConfig ? '开启' : '关闭'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="customApiEndpoint" className="flex items-center text-sm font-medium mb-2">
                          <Globe size={16} className="mr-2 text-primary" />
                          Gemini API 端点 (可选)
                        </label>
                        <Input
                          id="customApiEndpoint"
                          type="text"
                          value={customApiEndpoint}
                          onChange={onCustomApiEndpointChange}
                          placeholder="例如: https://my-proxy.com/gemini"
                          disabled={isLoading || !useCustomApiConfig}
                          aria-label="自定义 Gemini API 端点"
                        />
                        <p className="text-xs mt-1 text-muted-foreground">若留空，将使用默认 Google API 端点。</p>
                      </div>
                      <div>
                        <label htmlFor="customApiKey" className="flex items-center text-sm font-medium mb-2">
                          <KeyRound size={16} className="mr-2 text-primary" />
                          Gemini API 密钥
                        </label>
                        <Input
                          id="customApiKey"
                          type="password"
                          value={customApiKey}
                          onChange={onCustomApiKeyChange}
                          placeholder="输入您的 Gemini API 密钥"
                          disabled={isLoading || !useCustomApiConfig}
                          aria-label="自定义 Gemini API 密钥"
                          required={useCustomApiConfig}
                        />
                      </div>
                    </div>
                  </div>

                  {/* OpenAI-Compatible API */}
                  <div className={cn("p-4 border rounded-lg", useOpenAiApiConfig ? 'border-secondary bg-secondary/5' : 'border-border bg-muted/50')}>
                    <div className="flex items-center justify-between mb-3">
                       <label htmlFor="useOpenAiApiToggle" className="flex items-center text-sm font-medium cursor-pointer"
                        title={useOpenAiApiConfig ? "禁用OpenAI API配置" : "启用OpenAI API配置 (例如本地Ollama, LM Studio)"}>
                        <Database size={20} className="mr-2 text-secondary-foreground" />
                        <span>使用 OpenAI 兼容 API 配置</span>
                      </label>
                      <div className="flex items-center space-x-5">
                        <Switch
                          id="useOpenAiApiToggle"
                          checked={useOpenAiApiConfig}
                          onCheckedChange={handleUseOpenAiApiConfigToggle}
                          disabled={isLoading}
                          aria-label="切换 OpenAI API 配置"
                          className="shrink-0"
                        />
                        <span className="text-sm text-muted-foreground min-w-[4rem] shrink-0">
                          {useOpenAiApiConfig ? '开启' : '关闭'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="openAiApiBaseUrl" className="flex items-center text-sm font-medium mb-2">
                          <Globe size={16} className="mr-2 text-secondary-foreground" />
                          API 基地址 (Base URL)
                        </label>
                        <Input
                          id="openAiApiBaseUrl"
                          type="text"
                          value={openAiApiBaseUrl}
                          onChange={onOpenAiApiBaseUrlChange}
                          placeholder="例如: http://localhost:11434/v1"
                          disabled={isLoading || !useOpenAiApiConfig}
                          aria-label="OpenAI API 基地址"
                          required={useOpenAiApiConfig}
                        />
                      </div>
                      <div>
                        <label htmlFor="openAiApiKey" className="flex items-center text-sm font-medium mb-2">
                          <KeyRound size={16} className="mr-2 text-secondary-foreground" />
                          API 密钥 (可选)
                        </label>
                        <Input
                          id="openAiApiKey"
                          type="password"
                          value={openAiApiKey}
                          onChange={onOpenAiApiKeyChange}
                          placeholder="输入您的 OpenAI API 密钥 (部分服务可能不需要)"
                          disabled={isLoading || !useOpenAiApiConfig}
                          aria-label="OpenAI API 密钥"
                        />
                      </div>
                      <div>
                        <label htmlFor="openAiCognitoModelId" className="flex items-center text-sm font-medium mb-2">
                          <Brain size={16} className="mr-2 text-secondary-foreground" />
                          Cognito 模型 ID
                        </label>
                        <Input
                          id="openAiCognitoModelId"
                          type="text"
                          value={openAiCognitoModelId}
                          onChange={onOpenAiCognitoModelIdChange}
                          placeholder="例如: llama3, gpt-4-turbo"
                          disabled={isLoading || !useOpenAiApiConfig}
                          aria-label="OpenAI Cognito 模型 ID"
                          required={useOpenAiApiConfig}
                        />
                      </div>
                      <div>
                        <label htmlFor="openAiMuseModelId" className="flex items-center text-sm font-medium mb-2">
                          <Sparkles size={16} className="mr-2 text-purple-600" />
                          Muse 模型 ID
                        </label>
                        <Input
                          id="openAiMuseModelId"
                          type="text"
                          value={openAiMuseModelId}
                          onChange={onOpenAiMuseModelIdChange}
                          placeholder="例如: llama3, gpt-3.5-turbo"
                          disabled={isLoading || !useOpenAiApiConfig}
                          aria-label="OpenAI Muse 模型 ID"
                          required={useOpenAiApiConfig}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {!useCustomApiConfig && !useOpenAiApiConfig && (
                    <p className="text-xs text-muted-foreground text-center mt-1 p-2 bg-muted rounded-md">当前配置为使用环境变量中的 Google Gemini API 密钥。</p>
                  )}
                </div>
              </section>

              {/* AI Persona Settings Section */}
              <section aria-labelledby="persona-settings-heading">
                <h3 id="persona-settings-heading" className="text-base sm:text-lg font-medium text-foreground mb-3 border-b pb-2">AI 角色设定 (系统提示词)</h3>
                {!supportsSystemInstruction && ( 
                  <div className="mt-2 mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-sm text-yellow-700 flex items-start">
                    <Info size={18} className="mr-2 mt-0.5 shrink-0" />
                    当前选定模型或API配置可能不支持自定义系统提示词。以下设置可能无效。
                  </div>
                )}
                
                <div className="space-y-6 mt-4">
                  <div className="border border-border rounded-lg p-4 bg-gradient-to-r from-blue-50/50 to-blue-50/30">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-2">
                          <Brain size={16} className="text-blue-600" />
                          <label htmlFor="cognitoPrompt" className="text-sm font-medium">Cognito (逻辑AI) 提示词</label>
                        </div>
                        <Button 
                            variant="ghost"
                            size="sm"
                            onClick={onResetCognitoPrompt}
                            disabled={isLoading || !supportsSystemInstruction}
                            className="h-8 px-3 text-xs self-end sm:self-auto"
                            title="重置为默认提示词"
                        >
                            <RotateCcw size={12} className="mr-1" /> 重置
                        </Button>
                    </div>
                    <Textarea
                      id="cognitoPrompt"
                      value={cognitoSystemPrompt}
                      onChange={onCognitoPromptChange}
                      rows={5}
                      className="resize-y min-h-[90px] border-blue-200 focus:border-blue-400"
                      disabled={isLoading || !supportsSystemInstruction}
                      aria-label="Cognito系统提示词"
                      placeholder="设置Cognito AI的系统提示词..."
                    />
                  </div>

                  <div className="border border-border rounded-lg p-4 bg-gradient-to-r from-purple-50/50 to-purple-50/30">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-2">
                          <Sparkles size={16} className="text-purple-600" />
                          <label htmlFor="musePrompt" className="text-sm font-medium">Muse (创意AI) 提示词</label>
                        </div>
                         <Button
                            variant="ghost"
                            size="sm"
                            onClick={onResetMusePrompt}
                            disabled={isLoading || !supportsSystemInstruction}
                            className="h-8 px-3 text-xs self-end sm:self-auto"
                            title="重置为默认提示词"
                        >
                            <RotateCcw size={12} className="mr-1" /> 重置
                        </Button>
                    </div>
                    <Textarea
                      id="musePrompt"
                      value={museSystemPrompt}
                      onChange={onMusePromptChange}
                      rows={5}
                      className="resize-y min-h-[90px] border-purple-200 focus:border-purple-400"
                      disabled={isLoading || !supportsSystemInstruction}
                      aria-label="Muse系统提示词"
                      placeholder="设置Muse AI的系统提示词..."
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={onClose}
            disabled={isLoading}
            className="px-6"
            aria-label="完成并关闭设置"
          >
            完成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
