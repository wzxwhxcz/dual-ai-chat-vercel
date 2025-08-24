# API 渠道管理架构设计

## 1. 数据与存储设计

### 1.1 渠道数据结构

```javascript
// 渠道实体结构
interface ApiChannel {
  id: string;                    // 唯一标识符 (UUID)
  name: string;                  // 渠道名称
  provider: 'openai' | 'gemini'; // 提供商类型
  apiKey: string;                // API 密钥
  baseUrl?: string;              // Base URL (仅 OpenAI 兼容)
  defaultModel: string;          // 默认模型
  timeout: number;               // 超时时间（毫秒）
  isDefault: boolean;            // 是否为全局默认
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 修改时间
  metadata?: {                   // 元数据
    version: string;             // 数据版本
    description?: string;        // 渠道描述
  };
}
```

### 1.2 存储架构

**localStorage 键名设计：**
- `dualAiChatApiChannels`: 渠道列表存储
- `dualAiChatDefaultChannelId`: 全局默认渠道ID
- `dualAiChatChannelDataVersion`: 数据版本（支持后续迁移）

**存储结构示例：**
```json
{
  "version": "1.0.0",
  "channels": [
    {
      "id": "channel-001",
      "name": "本地 Ollama",
      "provider": "openai",
      "apiKey": "",
      "baseUrl": "http://localhost:11434/v1",
      "defaultModel": "llama3",
      "timeout": 30000,
      "isDefault": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "metadata": {
        "version": "1.0.0",
        "description": "本地部署的 Ollama 服务"
      }
    },
    {
      "id": "channel-002",
      "name": "Google Gemini Pro",
      "provider": "gemini",
      "apiKey": "AIza***",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "defaultModel": "gemini-2.5-pro",
      "timeout": 45000,
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "metadata": {
        "version": "1.0.0"
      }
    }
  ],
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### 1.3 会话渠道关联

**会话数据结构扩展：**
```javascript
interface ChatSession {
  // ... 现有字段
  channelId?: string;           // 可选：会话使用的渠道ID
  channelOverride?: {           // 可选：会话级别渠道覆盖
    cognitoChannelId?: string;  // Cognito专用渠道
    museChannelId?: string;     // Muse专用渠道
  };
}
```

## 2. 服务路由与超时策略

### 2.1 统一路由层设计

**新增文件：`dual-ai-chat/services/apiChannelService.ts`**

```javascript
interface ApiChannelServiceConfig {
  channel: ApiChannel;
  messageHistory?: ChatMessage[];
  temperature?: number;
}

class ApiChannelService {
  // 根据渠道配置路由到对应服务
  static async generateResponse(
    prompt: string,
    config: ApiChannelServiceConfig,
    systemInstruction?: string,
    imagePart?: any,
    abortSignal?: AbortSignal
  ): Promise<ResponsePayload>

  // 流式响应路由
  static async generateStreamResponse(
    prompt: string,
    config: ApiChannelServiceConfig,
    callbacks: StreamCallbacks,
    systemInstruction?: string,
    imagePart?: any,
    abortSignal?: AbortSignal
  ): Promise<void>
}
```

### 2.2 渠道选择策略

**优先级顺序：**
1. 会话指定渠道（Session.channelId）
2. 全局默认渠道（DefaultChannelId）
3. 系统兜底渠道（第一个可用渠道）
4. 无可用渠道时阻止请求

### 2.3 超时与错误处理

**统一超时机制：**
```javascript
// 支持 AbortController + 定时器
const timeoutId = setTimeout(() => {
  abortController.abort(new Error('Request timeout'));
}, channel.timeout);

// 错误码标准化
enum ApiChannelErrorType {
  TIMEOUT = 'CHANNEL_TIMEOUT',
  NO_CHANNEL = 'NO_AVAILABLE_CHANNEL',
  INVALID_KEY = 'INVALID_API_KEY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND'
}
```

## 3. UI/交互设计

### 3.1 设置面板集成

**新增组件：`dual-ai-chat/components/ApiChannelSettings.tsx`**

**在 SettingsModal.tsx 中集成：**
- 新增"API 渠道"标签页
- 保持现有设置的兼容性
- 提供迁移向导

### 3.2 渠道管理界面功能

**核心功能：**
1. **渠道列表显示：**
   - 渠道名称、提供商图标、默认模型
   - 超时时间、默认标识
   - API Key 显示为掩码（`AIza****1234`）

2. **新增/编辑表单：**
   - 动态字段显示（OpenAI兼容显示Base URL）
   - 实时表单验证
   - 连接测试功能

3. **操作功能：**
   - 设为默认（单选）
   - 复制渠道配置
   - 删除确认对话框

### 3.3 安全性设计

**API Key 处理：**
- 输入时支持密码模式和明文模式切换
- 显示时永久掩码（前3后4字符）
- 复制时需要二次确认
- 控制台日志过滤敏感信息

## 4. 会话层集成

### 4.1 会话管理器扩展

**SessionManager.tsx 增强：**
- 会话创建时支持渠道选择
- 会话列表显示当前使用渠道
- 会话切换时渠道状态同步

### 4.2 渠道选择组件

**新增：`dual-ai-chat/components/ChannelSelector.tsx`**
```javascript
interface ChannelSelectorProps {
  currentChannelId?: string;
  onChannelChange: (channelId: string) => void;
  showDefault?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

### 4.3 渠道删除回退策略

**删除渠道时的处理：**
1. 检查是否有会话使用该渠道
2. 提供批量迁移选项
3. 自动回退到默认渠道
4. 记录迁移日志

## 5. 迁移与兼容策略

### 5.1 现有配置迁移

**迁移检测逻辑：**
```javascript
// 检测旧配置存在
const hasLegacyGeminiConfig = localStorage.getItem('dualAiChatUseCustomApiConfig');
const hasLegacyOpenAIConfig = localStorage.getItem('dualAiChatUseOpenAiApiConfig');

// 自动迁移为渠道
if (hasLegacyConfig && !hasChannelData) {
  await migrateFromLegacyConfig();
}
```

**迁移步骤：**
1. **检测阶段：** 应用启动时检测旧配置
2. **转换阶段：** 将现有配置转换为渠道格式
3. **清理阶段：** 迁移完成后清理旧配置键
4. **验证阶段：** 确保迁移后功能正常

### 5.2 版本兼容

**数据版本管理：**
```javascript
const CHANNEL_DATA_VERSIONS = {
  '1.0.0': 'initial_version',
  '1.1.0': 'added_metadata_support',
  '1.2.0': 'added_session_channel_mapping'
};
```

## 6. 测试用例与验证清单

### 6.1 功能测试用例

**渠道管理测试：**
- [ ] 创建新渠道（OpenAI 兼容 + Gemini）
- [ ] 编辑渠道信息
- [ ] 设置全局默认渠道
- [ ] 删除渠道及回退处理
- [ ] API Key 安全显示和复制

**会话集成测试：**
- [ ] 会话级别渠道选择
- [ ] 渠道切换时状态同步
- [ ] 渠道删除后会话回退
- [ ] 多会话使用不同渠道

**服务路由测试：**
- [ ] OpenAI 兼容服务调用
- [ ] Gemini 服务调用
- [ ] 超时处理
- [ ] 错误处理和重试
- [ ] 消息历史传递

**迁移测试：**
- [ ] 从旧版 Gemini 配置迁移
- [ ] 从旧版 OpenAI 配置迁移
- [ ] 无配置时的初始化
- [ ] 迁移后功能验证

### 6.2 用户体验验证

**可用性检查：**
- [ ] 首次使用引导流程
- [ ] 无渠道时的提示和引导
- [ ] 渠道连接失败时的错误提示
- [ ] 渠道切换响应速度
- [ ] 移动端适配

### 6.3 安全性验证

**安全检查：**
- [ ] API Key 不在控制台打印
- [ ] 本地存储数据不包含明文密钥
- [ ] 网络请求日志过滤敏感信息
- [ ] 渠道配置导出时密钥处理

## 7. 实施计划

### 7.1 需要修改的文件

**新增文件：**
- `dual-ai-chat/services/apiChannelService.ts` - 统一路由服务
- `dual-ai-chat/hooks/useApiChannels.ts` - 渠道管理 Hook
- `dual-ai-chat/components/ApiChannelSettings.tsx` - 渠道设置组件
- `dual-ai-chat/components/ChannelSelector.tsx` - 渠道选择器
- `dual-ai-chat/utils/channelMigration.ts` - 数据迁移工具

**修改文件：**
- `dual-ai-chat/types.ts` - 添加渠道相关类型定义
- `dual-ai-chat/constants.ts` - 添加渠道相关常量
- `dual-ai-chat/App.tsx` - 集成渠道管理状态
- `dual-ai-chat/hooks/useChatLogic.ts` - 集成渠道路由
- `dual-ai-chat/hooks/useChatSessions.ts` - 扩展会话结构
- `dual-ai-chat/components/SettingsModal.tsx` - 集成渠道设置
- `dual-ai-chat/components/SessionManager.tsx` - 添加渠道显示

### 7.2 实施顺序

**阶段一：核心数据层（2-3天）**
1. 定义类型和常量
2. 实现 useApiChannels Hook
3. 实现数据迁移逻辑
4. 基础存储测试

**阶段二：服务路由层（2-3天）**
5. 实现 ApiChannelService
6. 集成现有服务调用
7. 实现超时和错误处理
8. 服务路由测试

**阶段三：UI组件层（3-4天）**
9. 实现 ApiChannelSettings 组件
10. 实现 ChannelSelector 组件
11. 集成到 SettingsModal
12. UI 功能测试

**阶段四：会话集成层（2-3天）**
13. 扩展会话数据结构
14. 集成会话管理器
15. 实现会话渠道选择
16. 集成测试

**阶段五：完善与优化（2-3天）**
17. 完善错误处理
18. 用户体验优化
19. 性能优化
20. 全面测试和文档

### 7.3 风险评估与回滚方案

**主要风险点：**
1. **数据迁移风险：** 现有配置丢失
   - *缓解：* 迁移前备份，提供手动导入功能
2. **API 兼容性风险：** 现有调用方式改变
   - *缓解：* 保持向后兼容，渐进式迁移
3. **性能风险：** 路由层增加调用开销
   - *缓解：* 优化路由逻辑，缓存渠道配置

**回滚方案：**
1. **代码回滚：** Git 分支策略，关键节点tag
2. **数据回滚：** localStorage 备份恢复
3. **功能降级：** 禁用新功能，使用兼容模式

### 7.4 成功指标

**功能指标：**
- 支持管理至少10个不同渠道
- 渠道切换响应时间 < 500ms
- 数据迁移成功率 > 99%
- 新用户设置完成率 > 90%

**质量指标：**
- 单元测试覆盖率 > 80%
- 集成测试通过率 100%
- 用户反馈满意度 > 4.5/5
- 线上错误率 < 0.1%

## 8. 总结

本架构设计提供了完整的 API 渠道管理解决方案，具有以下特点：

1. **统一管理：** 集中管理所有 API 配置，支持多渠道
2. **灵活路由：** 智能选择最合适的 API 渠道
3. **无缝迁移：** 从现有配置平滑升级
4. **用户友好：** 直观的管理界面和操作体验
5. **安全可靠：** 完善的安全措施和错误处理
6. **可扩展：** 支持未来添加更多提供商类型

该设计既保持了现有功能的稳定性，又为未来的扩展奠定了坚实基础。