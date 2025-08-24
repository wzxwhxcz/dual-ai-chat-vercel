import React, { useMemo } from 'react';
import { ApiChannel } from '../types';
import { useApiChannels } from '../hooks/useApiChannels';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Database, Settings, Star, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChannelSelectorProps {
  currentChannelId?: string;
  onChannelChange: (channelId: string | null) => void;
  showDefault?: boolean;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  currentChannelId,
  onChannelChange,
  showDefault = true,
  size = 'md',
  placeholder = '选择 API 渠道',
  disabled = false,
  className
}) => {
  const { channels, defaultChannelId, getDefaultChannel } = useApiChannels();

  // 计算当前选中的渠道
  const selectedChannel = useMemo(() => {
    if (currentChannelId) {
      return channels.find(c => c.id === currentChannelId && c.enabled !== false) || null;
    }
    return null;
  }, [currentChannelId, channels]);

  // 计算默认渠道
  const defaultChannel = useMemo(() => {
    return getDefaultChannel();
  }, [getDefaultChannel]);

  // 获取提供商图标
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return <Database size={14} className="text-blue-600" />;
      case 'gemini':
        return <Settings size={14} className="text-green-600" />;
      default:
        return <Settings size={14} className="text-gray-600" />;
    }
  };

  // 格式化渠道显示名称
  const formatChannelName = (channel: ApiChannel, isDefault: boolean) => {
    const defaultTag = isDefault ? ' (默认)' : '';
    return `${channel.name}${defaultTag}`;
  };

  // 渠道选项列表
  const channelOptions = useMemo(() => {
    const options: Array<{
      value: string;
      label: string;
      channel: ApiChannel;
      isDefault: boolean;
    }> = [];
  
    // 如果显示默认选项且有默认渠道（且启用）
    if (showDefault && defaultChannel && defaultChannel.enabled !== false) {
      options.push({
        value: 'default',
        label: `使用默认渠道 (${defaultChannel.name})`,
        channel: defaultChannel,
        isDefault: true
      });
    }
  
    // 添加所有启用的渠道
    channels.forEach(channel => {
      if (channel.enabled === false) return;
      const isChannelDefault = channel.id === defaultChannelId || channel.isDefault;
      options.push({
        value: channel.id,
        label: formatChannelName(channel, isChannelDefault),
        channel,
        isDefault: isChannelDefault
      });
    });
  
    return options;
  }, [channels, defaultChannel, defaultChannelId, showDefault]);

  // 处理选择变更
  const handleValueChange = (value: string) => {
    if (value === 'default') {
      onChannelChange(null); // null 表示使用默认渠道
    } else {
      onChannelChange(value);
    }
  };

  // 获取当前显示值
  const currentValue = useMemo(() => {
    if (!currentChannelId && showDefault) {
      return 'default';
    }
    return currentChannelId || '';
  }, [currentChannelId, showDefault]);

  // 如果没有可用渠道
  if (channels.length === 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 border border-dashed border-destructive/50 rounded-md bg-destructive/5",
        className
      )}>
        <AlertCircle size={16} className="text-destructive" />
        <span className="text-sm text-destructive">
          暂无可用的 API 渠道
        </span>
      </div>
    );
  }

  return (
    <Select
      value={currentValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger 
        className={cn(
          // 根据尺寸调整样式
          size === 'sm' && 'h-8 text-xs',
          size === 'md' && 'h-10 text-sm',
          size === 'lg' && 'h-12 text-base',
          className
        )}
      >
        <SelectValue placeholder={placeholder}>
          {selectedChannel ? (
            <div className="flex items-center gap-2">
              {getProviderIcon(selectedChannel.provider)}
              <span className="truncate">
                {formatChannelName(
                  selectedChannel, 
                  selectedChannel.id === defaultChannelId || selectedChannel.isDefault
                )}
              </span>
              {(selectedChannel.id === defaultChannelId || selectedChannel.isDefault) && (
                <Star size={12} className="text-yellow-500 flex-shrink-0" />
              )}
            </div>
          ) : showDefault && defaultChannel ? (
            <div className="flex items-center gap-2">
              {getProviderIcon(defaultChannel.provider)}
              <span className="truncate">使用默认渠道 ({defaultChannel.name})</span>
              <Star size={12} className="text-yellow-500 flex-shrink-0" />
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      
      <SelectContent>
        {channelOptions.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className="flex items-center"
          >
            <div className="flex items-center gap-2 w-full">
              {getProviderIcon(option.channel.provider)}
              <span className="flex-1 truncate">{option.label}</span>
              {option.isDefault && (
                <Star size={12} className="text-yellow-500 flex-shrink-0" />
              )}
            </div>
          </SelectItem>
        ))}
        
        {/* 分隔线和渠道详情 */}
        <div className="px-2 py-1 border-t mt-1">
          <div className="text-xs text-muted-foreground">
            {selectedChannel ? (
              <div className="space-y-1">
                <div>模型: {selectedChannel.defaultModel}</div>
                <div>超时: {selectedChannel.timeout / 1000}秒</div>
                {selectedChannel.metadata?.description && (
                  <div className="truncate" title={selectedChannel.metadata.description}>
                    {selectedChannel.metadata.description}
                  </div>
                )}
              </div>
            ) : (
              <div>共 {channels.length} 个可用渠道</div>
            )}
          </div>
        </div>
      </SelectContent>
    </Select>
  );
};

export default ChannelSelector;