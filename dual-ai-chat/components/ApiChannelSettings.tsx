import React, { useState, useCallback, useEffect } from 'react';
import { 
  ApiChannel, 
  ApiChannelProvider,
  ApiChannelTestResult,
  ApiChannelValidationError 
} from '../types';
import { 
  DEFAULT_CHANNEL_TIMEOUT,
  MIN_CHANNEL_TIMEOUT,
  MAX_CHANNEL_TIMEOUT,
  DEFAULT_CHANNEL_TEMPLATES
} from '../constants';
import { useApiChannels } from '../hooks/useApiChannels';
import { ApiChannelService } from '../services/apiChannelService';
import {
  Plus,
  Edit2,
  Trash2,
  Star,
  StarOff,
  Eye,
  EyeOff,
  Copy,
  TestTube,
  CheckCircle,
  XCircle,
  Settings,
  Database,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';
import { Dialog, DialogContent } from './ui/dialog';
import { Switch } from './ui/switch';

interface ApiChannelSettingsProps {}

interface ChannelFormData {
  name: string;
  provider: ApiChannelProvider;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  description: string;
}

const ApiChannelSettings: React.FC<ApiChannelSettingsProps> = () => {
  const {
    channels,
    defaultChannelId,
    isLoading,
    createChannel,
    updateChannel,
    deleteChannel,
    setAsDefault,
    setChannelEnabled,
    duplicateChannel,
    validateChannel
  } = useApiChannels();

  // UI 状态
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showApiKeys, setShowApiKeys] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, ApiChannelTestResult>>(new Map());
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<ChannelFormData>({
    name: '',
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    defaultModel: '',
    timeout: DEFAULT_CHANNEL_TIMEOUT,
    description: ''
  });
  const [formErrors, setFormErrors] = useState<ApiChannelValidationError[]>([]);

  // 重置表单
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      provider: 'gemini',
      apiKey: '',
      baseUrl: '',
      defaultModel: '',
      timeout: DEFAULT_CHANNEL_TIMEOUT,
      description: ''
    });
    setFormErrors([]);
    setIsEditing(false);
    setSelectedChannelId(null);
  }, []);

  // 打开新增表单
  const handleAddChannel = useCallback(() => {
    resetForm();
    setIsFormOpen(true);
  }, [resetForm]);

  // 打开编辑表单
  const handleEditChannel = useCallback((channel: ApiChannel) => {
    setFormData({
      name: channel.name,
      provider: channel.provider,
      apiKey: channel.apiKey,
      baseUrl: channel.baseUrl || '',
      defaultModel: channel.defaultModel,
      timeout: channel.timeout,
      description: channel.metadata?.description || ''
    });
    setSelectedChannelId(channel.id);
    setIsEditing(true);
    setIsFormOpen(true);
    setFormErrors([]);
  }, []);

  // 关闭表单
  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    resetForm();
  }, [resetForm]);

  // 表单数据变更
  const handleFormChange = useCallback((field: keyof ChannelFormData, value: string | number) => {
    // 提供商变更：一次性原子更新，避免多次 set 导致 provider 未更新或联动字段错位
    if (field === 'provider') {
      const provider = value as ApiChannelProvider;
      const template = provider === 'gemini'
        ? DEFAULT_CHANNEL_TEMPLATES.GEMINI
        : DEFAULT_CHANNEL_TEMPLATES.OPENAI_LOCALHOST;
  
      setFormData(prev => ({
        ...prev,
        provider,                 // 确保 provider 同步更新
        baseUrl: template.baseUrl,
        defaultModel: template.defaultModel,
      }));
      return;
    }
  
    // 其他字段按常规更新
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 提交表单
  const handleSubmitForm = useCallback(async () => {
    try {
      const channelData = {
        name: formData.name.trim(),
        provider: formData.provider,
        apiKey: formData.apiKey.trim(),
        baseUrl: formData.provider === 'openai' ? formData.baseUrl.trim() : (formData.baseUrl.trim() || undefined),
        defaultModel: formData.defaultModel.trim(),
        timeout: formData.timeout,
        metadata: {
          version: '1.0.0',
          description: formData.description.trim() || undefined
        }
      };

      if (isEditing && selectedChannelId) {
        await updateChannel(selectedChannelId, channelData);
      } else {
        await createChannel(channelData);
      }

      handleCloseForm();
    } catch (error) {
      if (error instanceof Error) {
        setFormErrors([{ field: 'name', message: error.message }]);
      }
    }
  }, [formData, isEditing, selectedChannelId, createChannel, updateChannel, handleCloseForm]);

  // 删除渠道
  const handleDeleteChannel = useCallback(async (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const confirmMessage = `确定要删除渠道"${channel.name}"吗？此操作无法撤销。`;
    if (confirm(confirmMessage)) {
      try {
        await deleteChannel(channelId);
      } catch (error) {
        console.error('删除渠道失败:', error);
        alert('删除渠道失败，请重试');
      }
    }
  }, [channels, deleteChannel]);

  // 设为默认渠道
  const handleSetDefault = useCallback(async (channelId: string) => {
    try {
      await setAsDefault(channelId);
    } catch (error) {
      console.error('设置默认渠道失败:', error);
      alert('设置默认渠道失败，请重试');
    }
  }, [setAsDefault]);

  // 切换 API Key 显示
  const toggleApiKeyVisibility = useCallback((channelId: string) => {
    setShowApiKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
      }
      return newSet;
    });
  }, []);

  // 复制 API Key
  const handleCopyApiKey = useCallback(async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      alert('API Key 已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动选择复制');
    }
  }, []);

  // 测试渠道连接
  const handleTestChannel = useCallback(async (channel: ApiChannel) => {
    setTestingChannelId(channel.id);
    
    try {
      const result = await ApiChannelService.testChannelConnection(channel);
      setTestResults(prev => new Map(prev).set(channel.id, {
        success: result.success,
        error: result.error,
        latency: result.latency
      }));
    } catch (error) {
      setTestResults(prev => new Map(prev).set(channel.id, {
        success: false,
        error: error instanceof Error ? error.message : '测试失败'
      }));
    } finally {
      setTestingChannelId(null);
    }
  }, []);

  // 复制渠道
  const handleDuplicateChannel = useCallback(async (channelId: string) => {
    try {
      await duplicateChannel(channelId);
    } catch (error) {
      console.error('复制渠道失败:', error);
      alert('复制渠道失败，请重试');
    }
  }, [duplicateChannel]);

  // 格式化 API Key 显示
  const formatApiKey = useCallback((apiKey: string, channelId: string): string => {
    if (showApiKeys.has(channelId)) {
      return apiKey;
    }
    
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    
    return `${apiKey.slice(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
  }, [showApiKeys]);

  // 获取提供商图标
  const getProviderIcon = useCallback((provider: ApiChannelProvider) => {
    switch (provider) {
      case 'openai':
        return <Database size={16} className="text-blue-600" />;
      case 'gemini':
        return <Settings size={16} className="text-green-600" />;
      default:
        return <Settings size={16} className="text-gray-600" />;
    }
  }, []);

  // 表单验证
  const validateForm = useCallback((): boolean => {
    const errors = validateChannel({
      name: formData.name.trim(),
      provider: formData.provider,
      apiKey: formData.apiKey.trim(),
      baseUrl: formData.baseUrl.trim() || undefined,
      defaultModel: formData.defaultModel.trim(),
      timeout: formData.timeout
    });
    
    setFormErrors(errors);
    return errors.length === 0;
  }, [formData, validateChannel]);

  // 实时验证
  useEffect(() => {
    if (isFormOpen) {
      validateForm();
    }
  }, [formData, isFormOpen, validateForm]);

  // 防止 react-remove-scroll 在 body/父层强制 pointer-events:none 影响可交互性
  useEffect(() => {
    if (!isFormOpen) return;
    const prev = document.body.style.pointerEvents;
    // 强制恢复交互，避免 body 上的 inline pointer-events: none 导致遮罩/内容“透明”或不可交互
    document.body.style.pointerEvents = 'auto';
    return () => {
      document.body.style.pointerEvents = prev;
    };
  }, [isFormOpen]);


  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">API 渠道管理</h3>
          <p className="text-sm text-muted-foreground mt-1">
            管理和配置您的 AI API 渠道
          </p>
        </div>
        <Button
          onClick={handleAddChannel}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          新增渠道
        </Button>
      </div>

      {/* 渠道列表 */}
      <div className="space-y-3">
        {channels.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed border-border">
            <Settings size={48} className="mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium text-muted-foreground mb-2">暂无 API 渠道</h4>
            <p className="text-sm text-muted-foreground mb-4">
              添加您的第一个 API 渠道开始使用
            </p>
            <Button onClick={handleAddChannel} variant="outline">
              <Plus size={16} className="mr-2" />
              新增渠道
            </Button>
          </div>
        ) : (
          channels.map((channel) => {
            const testResult = testResults.get(channel.id);
            const isTesting = testingChannelId === channel.id;
            const isDefault = channel.id === defaultChannelId || channel.isDefault;

            return (
              <div
                key={channel.id}
                className={cn(
                  "p-4 border rounded-lg bg-card",
                  isDefault ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getProviderIcon(channel.provider)}
                      <h4 className="font-medium text-foreground truncate">
                        {channel.name}
                      </h4>
                      {isDefault && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          <Star size={12} />
                          默认
                        </div>
                      )}
                      {/* 启用/禁用开关 */}
                      <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>启用</span>
                        <Switch
                          checked={channel.enabled !== false}
                          onCheckedChange={(checked) => {
                            setChannelEnabled(channel.id, checked).catch(err => {
                              console.error('更新渠道启用状态失败', err);
                              alert('更新渠道启用状态失败，请重试');
                            });
                          }}
                          aria-label={`切换渠道 ${channel.name} 启用状态`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">提供商:</span>
                        <span className="ml-2 font-medium">
                          {channel.provider === 'openai' ? 'OpenAI 兼容' : 'Google Gemini'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">默认模型:</span>
                        <span className="ml-2 font-medium">{channel.defaultModel}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-muted-foreground">API Key:</span>
                        <span className="ml-2 font-mono text-xs">
                          {formatApiKey(channel.apiKey, channel.id)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleApiKeyVisibility(channel.id)}
                          className="ml-2 h-6 w-6 p-0"
                        >
                          {showApiKeys.has(channel.id) ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                        </Button>
                        {showApiKeys.has(channel.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyApiKey(channel.apiKey)}
                            className="ml-1 h-6 w-6 p-0"
                          >
                            <Copy size={12} />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Clock size={12} className="text-muted-foreground mr-1" />
                        <span className="text-muted-foreground">超时:</span>
                        <span className="ml-2">{channel.timeout / 1000}秒</span>
                      </div>
                    </div>

                    {/* 连接测试结果 */}
                    {testResult && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        {testResult.success ? (
                          <>
                            <CheckCircle size={14} className="text-green-600" />
                            <span className="text-green-600">
                              连接成功 ({testResult.latency}ms)
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} className="text-red-600" />
                            <span className="text-red-600">
                              连接失败: {testResult.error}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestChannel(channel)}
                      disabled={isTesting}
                      title="测试连接"
                    >
                      {isTesting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <TestTube size={16} />
                      )}
                    </Button>

                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(channel.id)}
                        title="设为默认"
                      >
                        <StarOff size={16} />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditChannel(channel)}
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicateChannel(channel.id)}
                      title="复制"
                    >
                      <Copy size={16} />
                    </Button>

                    {channels.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="text-red-600 hover:text-red-700"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 渠道编辑表单弹窗（使用 Radix Dialog Portal，避免叠层上下文导致的“透明”问题） */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseForm();
        }}
      >
        <DialogContent
          overlayClassName="z-[1100] pointer-events-auto bg-black/60"
          containerClassName="z-[1101] pointer-events-auto"
          className="max-w-2xl w-full max-h-[90vh] bg-white p-0"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {isEditing ? '编辑渠道' : '新增渠道'}
              </h3>
            </div>

            <div className="space-y-4">
              {/* 渠道名称 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  渠道名称 *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="例如: 本地 Ollama"
                />
                {formErrors.find(e => e.field === 'name') && (
                  <p className="text-red-600 text-sm mt-1">
                    {formErrors.find(e => e.field === 'name')?.message}
                  </p>
                )}
              </div>

              {/* 提供商选择 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  提供商 *
                </label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => handleFormChange('provider', value)}
                  onOpenChange={(open) => {
                    try {
                      console.debug('[DEBUG-Provider-Select] open:', open);
                    } catch {}
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  {/*
                    提升下拉菜单层级，确保位于“新增渠道”对话框遮罩(z-[1100])与内容容器(z-[1101])之上
                    避免点击后无显示的情况（被遮挡在遮罩之下）
                  */}
                  <SelectContent className="z-[1205] pointer-events-auto">
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI 兼容</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  API Key *
                </label>
                <Input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => handleFormChange('apiKey', e.target.value)}
                  placeholder="输入您的 API 密钥"
                />
                {formErrors.find(e => e.field === 'apiKey') && (
                  <p className="text-red-600 text-sm mt-1">
                    {formErrors.find(e => e.field === 'apiKey')?.message}
                  </p>
                )}
              </div>

              {/* Base URL (仅 OpenAI 兼容) */}
              {formData.provider === 'openai' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Base URL *
                  </label>
                  <Input
                    value={formData.baseUrl}
                    onChange={(e) => handleFormChange('baseUrl', e.target.value)}
                    placeholder="http://localhost:11434/v1"
                  />
                  {formErrors.find(e => e.field === 'baseUrl') && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.find(e => e.field === 'baseUrl')?.message}
                    </p>
                  )}
                </div>
              )}

              {/* 默认模型 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  默认模型 *
                </label>
                <Input
                  value={formData.defaultModel}
                  onChange={(e) => handleFormChange('defaultModel', e.target.value)}
                  placeholder="例如: gemini-2.5-pro 或 llama3"
                />
                {formErrors.find(e => e.field === 'defaultModel') && (
                  <p className="text-red-600 text-sm mt-1">
                    {formErrors.find(e => e.field === 'defaultModel')?.message}
                  </p>
                )}
              </div>

              {/* 超时设置 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  超时时间 (秒) *
                </label>
                <Input
                  type="number"
                  value={formData.timeout / 1000}
                  onChange={(e) => handleFormChange('timeout', parseInt(e.target.value) * 1000)}
                  min={MIN_CHANNEL_TIMEOUT / 1000}
                  max={MAX_CHANNEL_TIMEOUT / 1000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  范围: {MIN_CHANNEL_TIMEOUT/1000}-{MAX_CHANNEL_TIMEOUT/1000} 秒
                </p>
                {formErrors.find(e => e.field === 'timeout') && (
                  <p className="text-red-600 text-sm mt-1">
                    {formErrors.find(e => e.field === 'timeout')?.message}
                  </p>
                )}
              </div>

              {/* 描述 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  描述 (可选)
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="渠道描述信息"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={handleCloseForm}>
                取消
              </Button>
              <Button
                onClick={handleSubmitForm}
                disabled={formErrors.length > 0}
              >
                {isEditing ? '更新' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiChannelSettings;