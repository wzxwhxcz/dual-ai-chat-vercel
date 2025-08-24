import { ApiChannel } from '../types';
import {
  API_CHANNELS_STORAGE_KEY,
  DEFAULT_CHANNEL_ID_STORAGE_KEY,
  CHANNEL_DATA_VERSION_STORAGE_KEY,
  CHANNEL_DATA_VERSION,
  DEFAULT_CHANNEL_TIMEOUT,
  DEFAULT_CHANNEL_TEMPLATES,
  // 旧版配置键名
  USE_CUSTOM_API_CONFIG_STORAGE_KEY,
  CUSTOM_API_ENDPOINT_STORAGE_KEY,
  CUSTOM_API_KEY_STORAGE_KEY,
  USE_OPENAI_API_CONFIG_STORAGE_KEY,
  OPENAI_API_BASE_URL_STORAGE_KEY,
  OPENAI_API_KEY_STORAGE_KEY,
  OPENAI_COGNITO_MODEL_ID_STORAGE_KEY,
  OPENAI_MUSE_MODEL_ID_STORAGE_KEY
} from '../constants';
import { generateUniqueId } from './appUtils';

export interface MigrationResult {
  success: boolean;
  migratedChannels: number;
  errors: string[];
  backupData?: any;
}

/**
 * 检测是否存在旧版配置需要迁移
 */
export const detectLegacyConfig = (): boolean => {
  const hasLegacyGeminiConfig = localStorage.getItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY) === 'true';
  const hasLegacyOpenAIConfig = localStorage.getItem(USE_OPENAI_API_CONFIG_STORAGE_KEY) === 'true';
  const hasChannelData = localStorage.getItem(API_CHANNELS_STORAGE_KEY) !== null;
  
  return (hasLegacyGeminiConfig || hasLegacyOpenAIConfig) && !hasChannelData;
};

/**
 * 备份旧版配置数据
 */
export const backupLegacyConfig = (): any => {
  const backup = {
    timestamp: new Date().toISOString(),
    geminiConfig: {
      useCustomApiConfig: localStorage.getItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY),
      customApiEndpoint: localStorage.getItem(CUSTOM_API_ENDPOINT_STORAGE_KEY),
      customApiKey: localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY)
    },
    openaiConfig: {
      useOpenAiApiConfig: localStorage.getItem(USE_OPENAI_API_CONFIG_STORAGE_KEY),
      openAiApiBaseUrl: localStorage.getItem(OPENAI_API_BASE_URL_STORAGE_KEY),
      openAiApiKey: localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY),
      openAiCognitoModelId: localStorage.getItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY),
      openAiMuseModelId: localStorage.getItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY)
    }
  };
  
  // 保存备份到 localStorage
  localStorage.setItem('dualAiChatLegacyConfigBackup', JSON.stringify(backup));
  
  return backup;
};

/**
 * 从旧版 Gemini 配置迁移到渠道
 */
const migrateLegacyGeminiConfig = (): ApiChannel | null => {
  const useCustomConfig = localStorage.getItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY) === 'true';
  const customApiKey = localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY);
  const customApiEndpoint = localStorage.getItem(CUSTOM_API_ENDPOINT_STORAGE_KEY);
  
  if (!useCustomConfig || !customApiKey || customApiKey.trim() === '') {
    return null;
  }
  
  const channel: ApiChannel = {
    id: generateUniqueId(),
    name: '迁移的 Gemini 配置',
    provider: 'gemini',
    apiKey: customApiKey.trim(),
    baseUrl: customApiEndpoint || 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: DEFAULT_CHANNEL_TEMPLATES.GEMINI.defaultModel,
    timeout: DEFAULT_CHANNEL_TIMEOUT,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      version: CHANNEL_DATA_VERSION,
      description: '从旧版 Gemini 自定义配置迁移'
    }
  };
  
  return channel;
};

/**
 * 从旧版 OpenAI 配置迁移到渠道
 */
const migrateLegacyOpenAIConfig = (): ApiChannel | null => {
  const useOpenAiConfig = localStorage.getItem(USE_OPENAI_API_CONFIG_STORAGE_KEY) === 'true';
  const openAiApiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
  const openAiApiBaseUrl = localStorage.getItem(OPENAI_API_BASE_URL_STORAGE_KEY);
  const cognitoModelId = localStorage.getItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY);
  const museModelId = localStorage.getItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY);
  
  if (!useOpenAiConfig || !openAiApiBaseUrl || openAiApiBaseUrl.trim() === '') {
    return null;
  }
  
  // 选择一个模型作为默认（优先 Cognito 模型）
  const defaultModel = cognitoModelId || museModelId || DEFAULT_CHANNEL_TEMPLATES.OPENAI_LOCALHOST.defaultModel;
  
  const channel: ApiChannel = {
    id: generateUniqueId(),
    name: '迁移的 OpenAI 配置',
    provider: 'openai',
    apiKey: openAiApiKey?.trim() || '',
    baseUrl: openAiApiBaseUrl.trim(),
    defaultModel: defaultModel,
    timeout: DEFAULT_CHANNEL_TIMEOUT,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      version: CHANNEL_DATA_VERSION,
      description: '从旧版 OpenAI 兼容配置迁移',
      originalCognitoModel: cognitoModelId,
      originalMuseModel: museModelId
    }
  };
  
  return channel;
};

/**
 * 清理旧版配置键
 */
const cleanupLegacyConfig = (): void => {
  const keysToRemove = [
    USE_CUSTOM_API_CONFIG_STORAGE_KEY,
    CUSTOM_API_ENDPOINT_STORAGE_KEY,
    CUSTOM_API_KEY_STORAGE_KEY,
    USE_OPENAI_API_CONFIG_STORAGE_KEY,
    OPENAI_API_BASE_URL_STORAGE_KEY,
    OPENAI_API_KEY_STORAGE_KEY,
    OPENAI_COGNITO_MODEL_ID_STORAGE_KEY,
    OPENAI_MUSE_MODEL_ID_STORAGE_KEY
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
};

/**
 * 执行完整的数据迁移
 */
export const migrateFromLegacyConfig = async (): Promise<MigrationResult> => {
  const result: MigrationResult = {
    success: false,
    migratedChannels: 0,
    errors: []
  };
  
  try {
    // 检测是否需要迁移
    if (!detectLegacyConfig()) {
      result.success = true;
      return result;
    }
    
    // 备份旧配置
    result.backupData = backupLegacyConfig();
    
    const migratedChannels: ApiChannel[] = [];
    
    // 迁移 Gemini 配置
    try {
      const geminiChannel = migrateLegacyGeminiConfig();
      if (geminiChannel) {
        migratedChannels.push(geminiChannel);
      }
    } catch (error) {
      result.errors.push(`Gemini 配置迁移失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
    
    // 迁移 OpenAI 配置
    try {
      const openaiChannel = migrateLegacyOpenAIConfig();
      if (openaiChannel) {
        // 如果已经有 Gemini 渠道，OpenAI 渠道不设为默认
        if (migratedChannels.length > 0) {
          openaiChannel.isDefault = false;
        }
        migratedChannels.push(openaiChannel);
      }
    } catch (error) {
      result.errors.push(`OpenAI 配置迁移失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
    
    // 保存迁移的渠道数据
    if (migratedChannels.length > 0) {
      const channelStorageData = {
        version: CHANNEL_DATA_VERSION,
        channels: migratedChannels,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(API_CHANNELS_STORAGE_KEY, JSON.stringify(channelStorageData));
      localStorage.setItem(CHANNEL_DATA_VERSION_STORAGE_KEY, CHANNEL_DATA_VERSION);
      
      // 设置默认渠道
      const defaultChannel = migratedChannels.find(c => c.isDefault);
      if (defaultChannel) {
        localStorage.setItem(DEFAULT_CHANNEL_ID_STORAGE_KEY, defaultChannel.id);
      }
      
      result.migratedChannels = migratedChannels.length;
    }
    
    // 清理旧配置（仅在迁移成功后执行）
    if (result.errors.length === 0) {
      cleanupLegacyConfig();
    }
    
    result.success = true;
    
    console.log(`数据迁移完成: 迁移了 ${result.migratedChannels} 个渠道`);
    
    return result;
    
  } catch (error) {
    result.errors.push(`迁移过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    return result;
  }
};

/**
 * 验证迁移结果
 */
export const validateMigration = (): boolean => {
  try {
    const channelData = localStorage.getItem(API_CHANNELS_STORAGE_KEY);
    if (!channelData) {
      return false;
    }
    
    const parsedData = JSON.parse(channelData);
    
    // 验证数据结构
    if (!parsedData.version || !Array.isArray(parsedData.channels)) {
      return false;
    }
    
    // 验证每个渠道数据
    for (const channel of parsedData.channels) {
      if (!channel.id || !channel.name || !channel.provider || !channel.defaultModel) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('迁移验证失败:', error);
    return false;
  }
};

/**
 * 恢复备份配置（紧急回滚）
 */
export const restoreBackupConfig = (): boolean => {
  try {
    const backupData = localStorage.getItem('dualAiChatLegacyConfigBackup');
    if (!backupData) {
      console.warn('没有找到备份数据');
      return false;
    }
    
    const backup = JSON.parse(backupData);
    
    // 恢复 Gemini 配置
    if (backup.geminiConfig.useCustomApiConfig) {
      localStorage.setItem(USE_CUSTOM_API_CONFIG_STORAGE_KEY, backup.geminiConfig.useCustomApiConfig);
      if (backup.geminiConfig.customApiEndpoint) {
        localStorage.setItem(CUSTOM_API_ENDPOINT_STORAGE_KEY, backup.geminiConfig.customApiEndpoint);
      }
      if (backup.geminiConfig.customApiKey) {
        localStorage.setItem(CUSTOM_API_KEY_STORAGE_KEY, backup.geminiConfig.customApiKey);
      }
    }
    
    // 恢复 OpenAI 配置
    if (backup.openaiConfig.useOpenAiApiConfig) {
      localStorage.setItem(USE_OPENAI_API_CONFIG_STORAGE_KEY, backup.openaiConfig.useOpenAiApiConfig);
      if (backup.openaiConfig.openAiApiBaseUrl) {
        localStorage.setItem(OPENAI_API_BASE_URL_STORAGE_KEY, backup.openaiConfig.openAiApiBaseUrl);
      }
      if (backup.openaiConfig.openAiApiKey) {
        localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, backup.openaiConfig.openAiApiKey);
      }
      if (backup.openaiConfig.openAiCognitoModelId) {
        localStorage.setItem(OPENAI_COGNITO_MODEL_ID_STORAGE_KEY, backup.openaiConfig.openAiCognitoModelId);
      }
      if (backup.openaiConfig.openAiMuseModelId) {
        localStorage.setItem(OPENAI_MUSE_MODEL_ID_STORAGE_KEY, backup.openaiConfig.openAiMuseModelId);
      }
    }
    
    // 移除新的渠道数据
    localStorage.removeItem(API_CHANNELS_STORAGE_KEY);
    localStorage.removeItem(DEFAULT_CHANNEL_ID_STORAGE_KEY);
    localStorage.removeItem(CHANNEL_DATA_VERSION_STORAGE_KEY);
    
    console.log('成功恢复备份配置');
    return true;
    
  } catch (error) {
    console.error('恢复备份配置失败:', error);
    return false;
  }
};

/**
 * 获取迁移状态信息
 */
export const getMigrationStatus = () => {
  const hasLegacyConfig = detectLegacyConfig();
  const hasChannelData = localStorage.getItem(API_CHANNELS_STORAGE_KEY) !== null;
  const hasBackup = localStorage.getItem('dualAiChatLegacyConfigBackup') !== null;
  
  return {
    needsMigration: hasLegacyConfig,
    hasMigratedData: hasChannelData,
    hasBackup: hasBackup,
    dataVersion: localStorage.getItem(CHANNEL_DATA_VERSION_STORAGE_KEY) || 'unknown'
  };
};