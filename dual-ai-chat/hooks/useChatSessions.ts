import { useState, useCallback, useEffect } from 'react';
import { ChatSession, ChatMessage, ApiChannelOverride } from '../types';
import { CHAT_SESSIONS_STORAGE_KEY, CURRENT_SESSION_ID_STORAGE_KEY } from '../constants';
import { generateUniqueId } from '../utils/appUtils';

export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // 从localStorage加载会话
  const loadSessions = useCallback(() => {
    try {
      const storedSessions = localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      const storedCurrentId = localStorage.getItem(CURRENT_SESSION_ID_STORAGE_KEY);
      
      if (storedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(storedSessions);
        // 转换日期字符串为Date对象
        const sessionsWithDates = parsedSessions.map(session => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setSessions(sessionsWithDates);
      }
      
      setCurrentSessionId(storedCurrentId);
    } catch (error) {
      console.error('加载会话历史失败:', error);
      setSessions([]);
      setCurrentSessionId(null);
    }
  }, []);

  // 保存会话到localStorage
  const saveSessions = useCallback((sessionsToSave: ChatSession[]) => {
    try {
      localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessionsToSave));
    } catch (error) {
      console.error('保存会话历史失败:', error);
    }
  }, []);

  // 保存当前会话ID
  const saveCurrentSessionId = useCallback((sessionId: string | null) => {
    try {
      if (sessionId) {
        localStorage.setItem(CURRENT_SESSION_ID_STORAGE_KEY, sessionId);
      } else {
        localStorage.removeItem(CURRENT_SESSION_ID_STORAGE_KEY);
      }
    } catch (error) {
      console.error('保存当前会话ID失败:', error);
    }
  }, []);

  // 创建新会话
  const createNewSession = useCallback((title?: string, channelId?: string, channelOverride?: ApiChannelOverride): string => {
    const newSession: ChatSession = {
      id: generateUniqueId(),
      title: title || `会话 ${new Date().toLocaleString()}`,
      messages: [],
      notepadContent: '这是共享记事本。\nCognito 和 Muse 可以在讨论过程中共同编辑和使用它。',
      notepadHistory: { versions: [], currentVersionIndex: -1 }, // 初始化记事本历史
      channelId: channelId || undefined, // 会话关联的渠道ID
      channelOverride: channelOverride || undefined, // 会话级别的渠道覆盖设置
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setSessions(prev => {
      const updated = [newSession, ...prev];
      saveSessions(updated);
      return updated;
    });

    setCurrentSessionId(newSession.id);
    saveCurrentSessionId(newSession.id);
    
    return newSession.id;
  }, [saveSessions, saveCurrentSessionId]);

  // 更新当前会话
  const updateCurrentSession = useCallback((messages: ChatMessage[], notepadContent: string) => {
    if (!currentSessionId) return;

    setSessions(prev => {
      const updated = prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...messages],
            notepadContent,
            updatedAt: new Date()
          };
        }
        return session;
      });
      saveSessions(updated);
      return updated;
    });
  }, [currentSessionId, saveSessions]);

  // 切换到指定会话
  const switchToSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    saveCurrentSessionId(sessionId);
  }, [saveCurrentSessionId]);

  // 删除会话
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const updated = prev.filter(session => session.id !== sessionId);
      saveSessions(updated);
      return updated;
    });

    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      saveCurrentSessionId(null);
    }
  }, [currentSessionId, saveSessions, saveCurrentSessionId]);

  // 重命名会话
  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    setSessions(prev => {
      const updated = prev.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            title: newTitle,
            updatedAt: new Date()
          };
        }
        return session;
      });
      saveSessions(updated);
      return updated;
    });
  }, [saveSessions]);

  // 更新会话的渠道设置
  const updateSessionChannel = useCallback((sessionId: string, channelId?: string, channelOverride?: ApiChannelOverride) => {
    setSessions(prev => {
      const updated = prev.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            channelId: channelId || undefined,
            channelOverride: channelOverride || undefined,
            updatedAt: new Date()
          };
        }
        return session;
      });
      saveSessions(updated);
      return updated;
    });
  }, [saveSessions]);

  // 获取会话的渠道设置
  const getSessionChannel = useCallback((sessionId: string): { channelId?: string; channelOverride?: ApiChannelOverride } => {
    const session = sessions.find(s => s.id === sessionId);
    return {
      channelId: session?.channelId,
      channelOverride: session?.channelOverride
    };
  }, [sessions]);

  // 清除会话的渠道设置
  const clearSessionChannel = useCallback((sessionId: string) => {
    updateSessionChannel(sessionId, undefined, undefined);
  }, [updateSessionChannel]);

  // 获取当前会话
  const getCurrentSession = useCallback((): ChatSession | null => {
    if (!currentSessionId) return null;
    return sessions.find(session => session.id === currentSessionId) || null;
  }, [currentSessionId, sessions]);

  // 导出会话数据
  const exportSessions = useCallback((sessionIds?: string[]) => {
    try {
      const sessionsToExport = sessionIds
        ? sessions.filter(s => sessionIds.includes(s.id))
        : sessions;
      
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        sessions: sessionsToExport,
        metadata: {
          totalSessions: sessionsToExport.length,
          totalMessages: sessionsToExport.reduce((acc, s) => acc + s.messages.length, 0)
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-sessions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true, count: sessionsToExport.length };
    } catch (error) {
      console.error('导出会话失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, [sessions]);

  // 导入会话数据
  const importSessions = useCallback((file: File): Promise<{ success: boolean; count?: number; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importData = JSON.parse(content);
          
          // 验证数据格式
          if (!importData.sessions || !Array.isArray(importData.sessions)) {
            throw new Error('无效的会话数据格式');
          }

          // 转换日期并生成新ID（避免ID冲突）
          const importedSessions: ChatSession[] = importData.sessions.map((session: any) => ({
            ...session,
            id: generateUniqueId(), // 生成新ID避免冲突
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
            messages: session.messages.map((msg: any) => ({
              ...msg,
              id: generateUniqueId(),
              timestamp: new Date(msg.timestamp)
            }))
          }));

          setSessions(prev => {
            const updated = [...importedSessions, ...prev];
            saveSessions(updated);
            return updated;
          });

          resolve({ success: true, count: importedSessions.length });
        } catch (error) {
          console.error('导入会话失败:', error);
          resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, error: '读取文件失败' });
      };

      reader.readAsText(file);
    });
  }, [saveSessions]);

  // 搜索会话（增强版：搜索标题和消息内容）
  const searchSessions = useCallback((searchTerm: string): ChatSession[] => {
    if (!searchTerm.trim()) return sessions;
    
    const term = searchTerm.toLowerCase();
    return sessions.filter(session => {
      // 搜索标题
      if (session.title.toLowerCase().includes(term)) return true;
      
      // 搜索消息内容
      return session.messages.some(msg =>
        msg.text.toLowerCase().includes(term)
      );
    });
  }, [sessions]);

  // 初始化时加载会话
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    currentSessionId,
    getCurrentSession,
    createNewSession,
    updateCurrentSession,
    switchToSession,
    deleteSession,
    renameSession,
    updateSessionChannel,
    getSessionChannel,
    clearSessionChannel,
    loadSessions,
    exportSessions,
    importSessions,
    searchSessions
  };
};