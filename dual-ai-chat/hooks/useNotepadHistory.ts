import { useState, useCallback, useEffect } from 'react';
import { MessageSender, NotepadVersion, NotepadHistoryState } from '../types';

const NOTEPAD_HISTORY_STORAGE_KEY_PREFIX = 'dualAiChatNotepadHistory_';
const MAX_HISTORY_VERSIONS = 50; // 最多保存50个版本

export const useNotepadHistory = (sessionId?: string) => {
  // 从localStorage加载历史
  const loadHistory = useCallback((sessionId?: string): NotepadHistoryState => {
    if (!sessionId) {
      return { versions: [], currentVersionIndex: -1 };
    }
    
    try {
      const storageKey = `${NOTEPAD_HISTORY_STORAGE_KEY_PREFIX}${sessionId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 转换日期字符串为Date对象
        parsed.versions = parsed.versions.map((v: any) => ({
          ...v,
          timestamp: new Date(v.timestamp)
        }));
        return parsed;
      }
    } catch (error) {
      console.error('加载记事本历史失败:', error);
    }
    return { versions: [], currentVersionIndex: -1 };
  }, []);

  const [historyState, setHistoryState] = useState<NotepadHistoryState>(() => loadHistory(sessionId));

  // 当sessionId变化时，重新加载历史
  useEffect(() => {
    setHistoryState(loadHistory(sessionId));
  }, [sessionId, loadHistory]);

  // 保存历史到localStorage
  const saveHistory = useCallback((state: NotepadHistoryState, sessionId?: string) => {
    if (!sessionId) return;
    
    try {
      const storageKey = `${NOTEPAD_HISTORY_STORAGE_KEY_PREFIX}${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('保存记事本历史失败:', error);
    }
  }, []);

  // 添加新版本
  const addVersion = useCallback((
    content: string, 
    author: MessageSender | null, 
    description?: string
  ): string => {
    if (!sessionId) return '';
    
    const versionId = `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newVersion: NotepadVersion = {
      id: versionId,
      content,
      timestamp: new Date(),
      author,
      description,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      lineCount: content.split('\n').length
    };

    setHistoryState(prev => {
      // 如果不在最新版本，删除后续版本
      let versions = prev.currentVersionIndex < prev.versions.length - 1
        ? prev.versions.slice(0, prev.currentVersionIndex + 1)
        : [...prev.versions];
      
      // 添加新版本
      versions.push(newVersion);
      
      // 限制版本数量
      if (versions.length > MAX_HISTORY_VERSIONS) {
        versions = versions.slice(-MAX_HISTORY_VERSIONS);
      }

      const newState = {
        versions,
        currentVersionIndex: versions.length - 1
      };

      saveHistory(newState, sessionId);
      return newState;
    });

    return versionId;
  }, [saveHistory, sessionId]);

  // 切换到指定版本
  const switchToVersion = useCallback((versionId: string): NotepadVersion | null => {
    const versionIndex = historyState.versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) return null;

    setHistoryState(prev => {
      const newState = { ...prev, currentVersionIndex: versionIndex };
      saveHistory(newState, sessionId);
      return newState;
    });

    return historyState.versions[versionIndex];
  }, [historyState.versions, saveHistory, sessionId]);

  // 获取当前版本
  const getCurrentVersion = useCallback((): NotepadVersion | null => {
    if (historyState.currentVersionIndex === -1 || 
        historyState.currentVersionIndex >= historyState.versions.length) {
      return null;
    }
    return historyState.versions[historyState.currentVersionIndex];
  }, [historyState]);

  // 获取版本差异摘要
  const getVersionDiff = useCallback((
    versionId1: string, 
    versionId2: string
  ): { added: number; removed: number; modified: number } | null => {
    const v1 = historyState.versions.find(v => v.id === versionId1);
    const v2 = historyState.versions.find(v => v.id === versionId2);
    
    if (!v1 || !v2) return null;

    const lines1 = v1.content.split('\n');
    const lines2 = v2.content.split('\n');
    
    let added = 0, removed = 0, modified = 0;
    
    const maxLen = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= lines1.length) {
        added++;
      } else if (i >= lines2.length) {
        removed++;
      } else if (lines1[i] !== lines2[i]) {
        modified++;
      }
    }

    return { added, removed, modified };
  }, [historyState.versions]);

  // 清空历史
  const clearHistory = useCallback(() => {
    const newState: NotepadHistoryState = {
      versions: [],
      currentVersionIndex: -1
    };
    setHistoryState(newState);
    saveHistory(newState, sessionId);
  }, [saveHistory, sessionId]);

  // 导出历史
  const exportHistory = useCallback(() => {
    const exportData = {
      exportDate: new Date().toISOString(),
      versions: historyState.versions,
      totalVersions: historyState.versions.length,
      sessionId: sessionId
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notepad-history-${sessionId || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [historyState.versions, sessionId]);

  return {
    versions: historyState.versions,
    currentVersionIndex: historyState.currentVersionIndex,
    addVersion,
    switchToVersion,
    getCurrentVersion,
    getVersionDiff,
    clearHistory,
    exportHistory,
    canUndo: historyState.currentVersionIndex > 0,
    canRedo: historyState.currentVersionIndex < historyState.versions.length - 1
  };
};