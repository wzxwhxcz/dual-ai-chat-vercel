import { useState, useCallback, useEffect } from 'react';
import { ChatSession, ChatMessage } from '../types';
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
  const createNewSession = useCallback((title?: string): string => {
    const newSession: ChatSession = {
      id: generateUniqueId(),
      title: title || `会话 ${new Date().toLocaleString()}`,
      messages: [],
      notepadContent: '这是共享记事本。\nCognito 和 Muse 可以在讨论过程中共同编辑和使用它。',
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

  // 获取当前会话
  const getCurrentSession = useCallback((): ChatSession | null => {
    if (!currentSessionId) return null;
    return sessions.find(session => session.id === currentSessionId) || null;
  }, [currentSessionId, sessions]);

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
    loadSessions
  };
};