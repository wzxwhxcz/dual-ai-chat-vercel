import { useState, useCallback, useEffect } from 'react';
import {
  ApiChannel,
  ApiChannelStorageData,
  ApiChannelValidationError,
  ApiChannelTestResult
} from '../types';
import {
  API_CHANNELS_STORAGE_KEY,
  DEFAULT_CHANNEL_ID_STORAGE_KEY,
  CHANNEL_DATA_VERSION_STORAGE_KEY,
  CHANNEL_DATA_VERSION,
  MIN_CHANNEL_TIMEOUT,
  MAX_CHANNEL_TIMEOUT,
  DEFAULT_CHANNEL_TEMPLATES
} from '../constants';
import { generateUniqueId } from '../utils/appUtils';

// 跨组件同步事件（同窗口内 localStorage 不会触发 storage 事件，需自定义事件通知）
const CHANNELS_UPDATED_EVENT = 'api-channels-updated';

export const useApiChannels = () => {
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 加载渠道数据
  const loadChannels = useCallback(() => {
    try {
      const storedData = localStorage.getItem(API_CHANNELS_STORAGE_KEY);
      const storedDefaultId = localStorage.getItem(DEFAULT_CHANNEL_ID_STORAGE_KEY);
      
      if (storedData) {
        const parsedData: ApiChannelStorageData = JSON.parse(storedData);
        const channelsWithDates = parsedData.channels.map(channel => ({
          ...channel,
          createdAt: new Date(channel.createdAt),
          updatedAt: new Date(channel.updatedAt),
          // 兼容旧数据：默认启用
          enabled: channel.enabled !== false,
        }));
        setChannels(channelsWithDates);
      } else {
        setChannels([]);
      }
      
      setDefaultChannelId(storedDefaultId);
    } catch (error) {
      console.error('加载API渠道数据失败:', error);
      setChannels([]);
      setDefaultChannelId(null);
    }
  }, []);

  // 保存渠道数据（保存后通过自定义事件通知其他组件实例刷新）
  const saveChannels = useCallback((channelsToSave: ApiChannel[]) => {
    try {
      const storageData: ApiChannelStorageData = {
        version: CHANNEL_DATA_VERSION,
        channels: channelsToSave,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(API_CHANNELS_STORAGE_KEY, JSON.stringify(storageData));
      localStorage.setItem(CHANNEL_DATA_VERSION_STORAGE_KEY, CHANNEL_DATA_VERSION);

      // 通知同窗口内的其他 useApiChannels 实例刷新
      try {
        window.dispatchEvent(new CustomEvent(CHANNELS_UPDATED_EVENT));
      } catch {}
    } catch (error) {
      console.error('保存API渠道数据失败:', error);
      throw new Error('保存渠道数据失败，请检查存储空间');
    }
  }, []);

  // 保存默认渠道ID（保存后通知刷新）
  const saveDefaultChannelId = useCallback((channelId: string | null) => {
    try {
      if (channelId) {
        localStorage.setItem(DEFAULT_CHANNEL_ID_STORAGE_KEY, channelId);
      } else {
        localStorage.removeItem(DEFAULT_CHANNEL_ID_STORAGE_KEY);
      }
      try {
        window.dispatchEvent(new CustomEvent(CHANNELS_UPDATED_EVENT));
      } catch {}
    } catch (error) {
      console.error('保存默认渠道ID失败:', error);
    }
  }, []);

  // 验证渠道数据
  const validateChannel = useCallback((channel: Partial<ApiChannel>): ApiChannelValidationError[] => {
    const errors: ApiChannelValidationError[] = [];

    if (!channel.name || channel.name.trim().length === 0) {
      errors.push({ field: 'name', message: '渠道名称不能为空' });
    } else if (channel.name.trim().length > 50) {
      errors.push({ field: 'name', message: '渠道名称不能超过50个字符' });
    }

    if (!channel.provider || !['openai', 'gemini'].includes(channel.provider)) {
      errors.push({ field: 'provider', message: '必须选择有效的提供商' });
    }

    if (!channel.defaultModel || channel.defaultModel.trim().length === 0) {
      errors.push({ field: 'defaultModel', message: '必须指定默认模型' });
    }

    if (channel.provider === 'openai' && (!channel.baseUrl || channel.baseUrl.trim().length === 0)) {
      errors.push({ field: 'baseUrl', message: 'OpenAI兼容渠道必须提供Base URL' });
    }

    if (channel.baseUrl && channel.baseUrl.trim().length > 0) {
      try {
        new URL(channel.baseUrl);
      } catch {
        errors.push({ field: 'baseUrl', message: 'Base URL格式无效' });
      }
    }

    if (typeof channel.timeout !== 'number' || channel.timeout < MIN_CHANNEL_TIMEOUT || channel.timeout > MAX_CHANNEL_TIMEOUT) {
      errors.push({ 
        field: 'timeout', 
        message: `超时时间必须在${MIN_CHANNEL_TIMEOUT/1000}秒到${MAX_CHANNEL_TIMEOUT/1000}秒之间` 
      });
    }

    return errors;
  }, []);

  // 创建新渠道
  const createChannel = useCallback(async (channelData: Omit<ApiChannel, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'>): Promise<ApiChannel> => {
    const errors = validateChannel(channelData);
    if (errors.length > 0) {
      throw new Error(`验证失败: ${errors[0].message}`);
    }

    // 检查名称是否重复
    const existingChannel = channels.find(c => c.name.toLowerCase() === channelData.name.toLowerCase());
    if (existingChannel) {
      throw new Error('渠道名称已存在');
    }

    const newChannel: ApiChannel = {
      ...channelData,
      id: generateUniqueId(),
      isDefault: channels.length === 0, // 第一个渠道自动设为默认
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        version: CHANNEL_DATA_VERSION,
        ...channelData.metadata
      }
    };

    const updatedChannels = [...channels, newChannel];
    setChannels(updatedChannels);
    saveChannels(updatedChannels);

    // 如果这是第一个渠道，设为默认
    if (newChannel.isDefault) {
      setDefaultChannelId(newChannel.id);
      saveDefaultChannelId(newChannel.id);
    }

    return newChannel;
  }, [channels, validateChannel, saveChannels, saveDefaultChannelId]);

  // 更新渠道
  const updateChannel = useCallback(async (channelId: string, updates: Partial<ApiChannel>): Promise<ApiChannel> => {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      throw new Error('渠道不存在');
    }

    const currentChannel = channels[channelIndex];
    const updatedChannelData = { ...currentChannel, ...updates, updatedAt: new Date() };
    
    const errors = validateChannel(updatedChannelData);
    if (errors.length > 0) {
      throw new Error(`验证失败: ${errors[0].message}`);
    }

    // 检查名称是否与其他渠道重复
    if (updates.name) {
      const existingChannel = channels.find(c => c.id !== channelId && c.name.toLowerCase() === updates.name!.toLowerCase());
      if (existingChannel) {
        throw new Error('渠道名称已存在');
      }
    }

    const updatedChannels = channels.map((channel, index) => 
      index === channelIndex ? updatedChannelData : channel
    );

    setChannels(updatedChannels);
    saveChannels(updatedChannels);

    return updatedChannelData;
  }, [channels, validateChannel, saveChannels]);

  // 删除渠道
  const deleteChannel = useCallback(async (channelId: string): Promise<void> => {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      throw new Error('渠道不存在');
    }

    const channelToDelete = channels[channelIndex];
    const updatedChannels = channels.filter(c => c.id !== channelId);

    // 如果删除的是默认渠道，设置新的默认渠道
    if (channelToDelete.isDefault && updatedChannels.length > 0) {
      updatedChannels[0].isDefault = true;
      setDefaultChannelId(updatedChannels[0].id);
      saveDefaultChannelId(updatedChannels[0].id);
    } else if (channelToDelete.isDefault) {
      setDefaultChannelId(null);
      saveDefaultChannelId(null);
    }

    setChannels(updatedChannels);
    saveChannels(updatedChannels);
  }, [channels, saveChannels, saveDefaultChannelId]);

  // 启用/禁用渠道
  const setChannelEnabled = useCallback(async (channelId: string, enabled: boolean): Promise<void> => {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      throw new Error('渠道不存在');
    }
    const updated = { ...channels[channelIndex], enabled, updatedAt: new Date() };
    const updatedChannels = channels.map((c, i) => (i === channelIndex ? updated : c));
    setChannels(updatedChannels);
    saveChannels(updatedChannels);
  }, [channels, saveChannels]);

  // 设置默认渠道
  const setAsDefault = useCallback(async (channelId: string): Promise<void> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      throw new Error('渠道不存在');
    }

    const updatedChannels = channels.map(c => ({
      ...c,
      isDefault: c.id === channelId,
      updatedAt: c.id === channelId ? new Date() : c.updatedAt
    }));

    setChannels(updatedChannels);
    saveChannels(updatedChannels);
    setDefaultChannelId(channelId);
    saveDefaultChannelId(channelId);
  }, [channels, saveChannels, saveDefaultChannelId]);

  // 测试渠道连接
  const testChannel = useCallback(async (channel: ApiChannel): Promise<ApiChannelTestResult> => {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      // 创建AbortController用于超时控制
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, channel.timeout);

      // 根据提供商类型进行不同的测试
      if (channel.provider === 'openai') {
        const response = await fetch(`${channel.baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${channel.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const latency = Date.now() - startTime;
        return { success: true, latency };
      } else if (channel.provider === 'gemini') {
        // 对于Gemini，我们使用一个简单的模型列表请求来测试连接
        const testUrl = `${channel.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models?key=${channel.apiKey}`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const latency = Date.now() - startTime;
        return { success: true, latency };
      }

      throw new Error('不支持的提供商类型');
    } catch (error) {
      const latency = Date.now() - startTime;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: '连接超时', latency };
        }
        return { success: false, error: error.message, latency };
      }
      
      return { success: false, error: '未知错误', latency };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取默认渠道
  const getDefaultChannel = useCallback((): ApiChannel | null => {
    // 1) 优先返回默认ID对应且启用的渠道
    if (defaultChannelId) {
      const channel = channels.find(c => c.id === defaultChannelId && c.enabled !== false);
      if (channel) return channel;
    }
  
    // 2) 其次返回标记为默认且启用的渠道
    const defaultEnabled = channels.find(c => c.isDefault && c.enabled !== false);
    if (defaultEnabled) return defaultEnabled;
  
    // 3) 否则返回第一个启用的渠道
    const firstEnabled = channels.find(c => c.enabled !== false);
    if (firstEnabled) return firstEnabled || null;
  
    // 4) 如果全都禁用或没有渠道，返回 null
    return null;
  }, [channels, defaultChannelId]);

  // 根据ID获取渠道
  const getChannelById = useCallback((channelId: string): ApiChannel | null => {
    return channels.find(c => c.id === channelId) || null;
  }, [channels]);

  // 创建默认渠道模板
  const createChannelFromTemplate = useCallback(async (templateType: keyof typeof DEFAULT_CHANNEL_TEMPLATES, apiKey: string): Promise<ApiChannel> => {
    const template = DEFAULT_CHANNEL_TEMPLATES[templateType];
    if (!template) {
      throw new Error('未知的渠道模板');
    }

    return createChannel({
      ...template,
      apiKey: apiKey.trim(),
      metadata: {
        version: CHANNEL_DATA_VERSION,
        description: `从${template.name}模板创建`
      }
    });
  }, [createChannel]);

  // 复制渠道
  const duplicateChannel = useCallback(async (channelId: string): Promise<ApiChannel> => {
    const originalChannel = channels.find(c => c.id === channelId);
    if (!originalChannel) {
      throw new Error('原渠道不存在');
    }

    const duplicatedChannelData = {
      ...originalChannel,
      name: `${originalChannel.name} (副本)`,
      apiKey: '', // 出于安全考虑，不复制API密钥
      metadata: {
        version: originalChannel.metadata?.version || CHANNEL_DATA_VERSION,
        description: `从"${originalChannel.name}"复制`,
        ...originalChannel.metadata
      }
    };

    // 移除不应该复制的字段
    const { id, createdAt, updatedAt, isDefault, ...channelDataToCopy } = duplicatedChannelData;
    
    return createChannel(channelDataToCopy);
  }, [channels, createChannel]);

  // 初始化时加载渠道
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // 跨组件同步：监听 storage（跨标签页）与自定义事件（同标签页）以刷新列表
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === API_CHANNELS_STORAGE_KEY ||
        e.key === DEFAULT_CHANNEL_ID_STORAGE_KEY ||
        e.key === CHANNEL_DATA_VERSION_STORAGE_KEY
      ) {
        loadChannels();
      }
    };
    const onCustom = () => loadChannels();

    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANNELS_UPDATED_EVENT as any, onCustom as any);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANNELS_UPDATED_EVENT as any, onCustom as any);
    };
  }, [loadChannels]);

  return {
    channels,
    defaultChannelId,
    isLoading,
    loadChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    setAsDefault,
    setChannelEnabled,
    testChannel,
    getDefaultChannel,
    getChannelById,
    createChannelFromTemplate,
    duplicateChannel,
    validateChannel
  };
};