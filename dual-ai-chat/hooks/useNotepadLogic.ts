
import { useState, useCallback } from 'react';
import { MessageSender, MessagePurpose } from '../types';
import { applyNotepadModifications, ParsedAIResponse } from '../utils/appUtils';
import { useNotepadHistory } from './useNotepadHistory';

export const useNotepadLogic = (initialContent: string) => {
  const [notepadContent, setNotepadContent] = useState<string>(initialContent);
  const [lastNotepadUpdateBy, setLastNotepadUpdateBy] = useState<MessageSender | null>(null);
  
  const [notepadHistory, setNotepadHistory] = useState<string[]>([initialContent]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(0);
  
  // 集成版本历史
  const {
    addVersion,
    versions,
    currentVersionIndex,
    switchToVersion,
    exportHistory,
    clearHistory: clearVersionHistory
  } = useNotepadHistory();

  const _addHistoryEntry = useCallback((newContent: string, updatedBy: MessageSender | null, description?: string) => {
    const newHistorySlice = notepadHistory.slice(0, currentHistoryIndex + 1);
    const newFullHistory = [...newHistorySlice, newContent];
    
    setNotepadContent(newContent);
    setNotepadHistory(newFullHistory);
    setCurrentHistoryIndex(newFullHistory.length - 1);
    setLastNotepadUpdateBy(updatedBy);
    
    // 添加到版本历史
    if (newContent !== notepadContent) {
      addVersion(newContent, updatedBy, description || `由 ${updatedBy || '用户'} 更新`);
    }
  }, [notepadHistory, currentHistoryIndex, notepadContent, addVersion]);

  const processNotepadUpdateFromAI = useCallback((
    parsedResponse: ParsedAIResponse,
    sender: MessageSender,
    addSystemMessage: (text: string, sender: MessageSender, purpose: MessagePurpose) => void
  ) => {
    const update = parsedResponse.notepadUpdate;
    if (!update) return;

    let currentNotepadForModification = notepadContent;
    // If we are in a past history state, apply modifications based on that state for accuracy,
    // then it will become a new history entry.
    if (currentHistoryIndex < notepadHistory.length - 1) {
        currentNotepadForModification = notepadHistory[currentHistoryIndex];
    }


    if (update.modifications && update.modifications.length > 0) {
      const { newContent, errors: applyErrors } = applyNotepadModifications(currentNotepadForModification, update.modifications);
      _addHistoryEntry(newContent, sender, `AI (${sender}) 自动修改`);
      
      if (applyErrors.length > 0) {
        const errorText = `[系统] ${sender} 的部分记事本修改操作未成功执行:\n- ${applyErrors.join('\n- ')}`;
        addSystemMessage(errorText, MessageSender.System, MessagePurpose.SystemNotification);
      }
    }
    
    if (update.error) { 
      addSystemMessage(
        `[系统] ${sender} 尝试修改记事本时遇到问题: ${update.error}`,
        MessageSender.System,
        MessagePurpose.SystemNotification
      );
    }
  }, [notepadContent, _addHistoryEntry, currentHistoryIndex, notepadHistory]);

  const clearNotepadContent = useCallback(() => {
    _addHistoryEntry(initialContent, null, '清空记事本');
    clearVersionHistory();
  }, [initialContent, _addHistoryEntry, clearVersionHistory]);

  const undoNotepad = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      setNotepadContent(notepadHistory[newIndex]);
      setLastNotepadUpdateBy(null); // Or determine from history if stored
    }
  }, [currentHistoryIndex, notepadHistory]);

  const redoNotepad = useCallback(() => {
    if (currentHistoryIndex < notepadHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      setNotepadContent(notepadHistory[newIndex]);
      setLastNotepadUpdateBy(null); // Or determine from history if stored
    }
  }, [currentHistoryIndex, notepadHistory]);

  const canUndo = currentHistoryIndex > 0;
  const canRedo = currentHistoryIndex < notepadHistory.length - 1;
  
  // 手动设置内容（用于从版本历史恢复）
  const setNotepadContentManual = useCallback((content: string, author: MessageSender | null) => {
    _addHistoryEntry(content, author, '从版本历史恢复');
  }, [_addHistoryEntry]);
  
  // 切换到指定版本
  const restoreFromVersion = useCallback((versionId: string) => {
    const version = switchToVersion(versionId);
    if (version) {
      setNotepadContentManual(version.content, version.author);
    }
  }, [switchToVersion, setNotepadContentManual]);

  return {
    notepadContent,
    lastNotepadUpdateBy,
    processNotepadUpdateFromAI,
    clearNotepadContent,
    setNotepadContentManual,
    undoNotepad,
    redoNotepad,
    canUndo,
    canRedo,
    // 版本历史相关
    versions,
    currentVersionIndex,
    restoreFromVersion,
    exportHistory,
  };
};
