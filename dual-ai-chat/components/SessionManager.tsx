import React, { useState, useRef, useMemo } from 'react';
import { ChatSession, ApiChannelOverride } from '../types';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Search,
  Download,
  Upload,
  CheckSquare,
  Square,
  FileText,
  AlertCircle
} from 'lucide-react';
import ChannelSelector from './ChannelSelector';

interface SessionManagerProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onCreateSession: (title?: string, channelId?: string, channelOverride?: ApiChannelOverride) => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onUpdateSessionChannel?: (sessionId: string, channelId?: string, channelOverride?: ApiChannelOverride) => void;
  onExportSessions?: (sessionIds?: string[]) => { success: boolean; count?: number; error?: string };
  onImportSessions?: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>;
  onSearchSessions?: (searchTerm: string) => ChatSession[];
  onClose: () => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  currentSessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
  onExportSessions,
  onImportSessions,
  onSearchSessions,
  onClose
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [importExportMessage, setImportExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewSessionChannelSelect, setShowNewSessionChannelSelect] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 使用增强搜索功能
  const filteredSessions = useMemo(() => {
    if (onSearchSessions && searchTerm) {
      return onSearchSessions(searchTerm);
    }
    return sessions.filter(session =>
      session.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sessions, searchTerm, onSearchSessions]);

  // 显示搜索结果中匹配的消息数量
  const getMatchingMessagesCount = (session: ChatSession): number => {
    if (!searchTerm) return 0;
    const term = searchTerm.toLowerCase();
    return session.messages.filter(msg => 
      msg.text.toLowerCase().includes(term)
    ).length;
  };

  const handleStartEdit = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = () => {
    if (editingSessionId && editTitle.trim()) {
      onRenameSession(editingSessionId, editTitle.trim());
    }
    setEditingSessionId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditTitle('');
  };


  const handleCreateWithChannel = (channelId?: string) => {
    onCreateSession(undefined, channelId, undefined); // 暂时不支持channelOverride
    setShowNewSessionChannelSelect(false);
  };

  const handleToggleSelection = (sessionId: string) => {
    const newSelection = new Set(selectedSessionIds);
    if (newSelection.has(sessionId)) {
      newSelection.delete(sessionId);
    } else {
      newSelection.add(sessionId);
    }
    setSelectedSessionIds(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const handleExport = () => {
    if (!onExportSessions) return;
    
    const sessionsToExport = isSelectionMode && selectedSessionIds.size > 0 
      ? Array.from(selectedSessionIds)
      : undefined;
    
    const result = onExportSessions(sessionsToExport);
    
    if (result.success) {
      setImportExportMessage({ 
        type: 'success', 
        text: `成功导出 ${result.count} 个会话` 
      });
      setIsSelectionMode(false);
      setSelectedSessionIds(new Set());
    } else {
      setImportExportMessage({ 
        type: 'error', 
        text: `导出失败: ${result.error}` 
      });
    }
    
    setTimeout(() => setImportExportMessage(null), 3000);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImportSessions || !event.target.files?.[0]) return;
    
    const file = event.target.files[0];
    const result = await onImportSessions(file);
    
    if (result.success) {
      setImportExportMessage({ 
        type: 'success', 
        text: `成功导入 ${result.count} 个会话` 
      });
    } else {
      setImportExportMessage({ 
        type: 'error', 
        text: `导入失败: ${result.error}` 
      });
    }
    
    setTimeout(() => setImportExportMessage(null), 3000);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <MessageSquare className="mr-2" size={20} />
            会话管理
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 消息提示 */}
        {importExportMessage && (
          <div className={`px-4 py-2 flex items-center ${
            importExportMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <AlertCircle size={16} className="mr-2" />
            {importExportMessage.text}
          </div>
        )}

        {/* 工具栏 */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setShowNewSessionChannelSelect(!showNewSessionChannelSelect)}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} className="mr-2" />
                新建会话
              </button>
              
              {showNewSessionChannelSelect && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-64">
                  <div className="p-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">选择API渠道（可选）</div>
                    <ChannelSelector
                      currentChannelId=""
                      onChannelChange={(channelId) => handleCreateWithChannel(channelId || undefined)}
                      showDefault={true}
                      size="sm"
                    />
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => {
                          onCreateSession();
                          setShowNewSessionChannelSelect(false);
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        使用默认设置创建
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {onExportSessions && (
              <button
                onClick={handleExport}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Download size={16} className="mr-2" />
                导出{isSelectionMode && selectedSessionIds.size > 0 ? ` (${selectedSessionIds.size})` : '全部'}
              </button>
            )}
            
            {onImportSessions && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  <Upload size={16} className="mr-2" />
                  导入
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </>
            )}
            
            {sessions.length > 0 && (
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedSessionIds(new Set());
                }}
                className={`flex items-center px-3 py-2 ${
                  isSelectionMode ? 'bg-gray-600' : 'bg-gray-500'
                } text-white rounded-md hover:bg-gray-700 transition-colors`}
              >
                {isSelectionMode ? <CheckSquare size={16} className="mr-2" /> : <Square size={16} className="mr-2" />}
                {isSelectionMode ? '取消选择' : '批量选择'}
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={onSearchSessions ? "搜索会话标题或消息内容..." : "搜索会话标题..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {isSelectionMode && filteredSessions.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                {selectedSessionIds.size === filteredSessions.length ? '取消全选' : '全选'}
              </button>
            )}
          </div>
        </div>

        {/* 会话列表 */}
        <div className="max-h-[calc(85vh-260px)] overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              {searchTerm ? '未找到匹配的会话' : '暂无会话历史'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSessions.map((session) => {
                const matchingMessages = getMatchingMessagesCount(session);
                return (
                  <div
                    key={session.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      session.id === currentSessionId ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {isSelectionMode && (
                        <button
                          onClick={() => handleToggleSelection(session.id)}
                          className="mr-3"
                        >
                          {selectedSessionIds.has(session.id) ? (
                            <CheckSquare size={20} className="text-blue-600" />
                          ) : (
                            <Square size={20} className="text-gray-400" />
                          )}
                        </button>
                      )}
                      
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          if (!isSelectionMode) {
                            onSwitchSession(session.id);
                            onClose();
                          }
                        }}
                      >
                        {editingSessionId === session.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit();
                              }}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <h3 className="font-medium text-gray-900 mb-1">{session.title}</h3>
                            <div className="flex items-center text-sm text-gray-500 space-x-4">
                              <span className="flex items-center">
                                <Clock size={14} className="mr-1" />
                                {formatDate(session.updatedAt)}
                              </span>
                              <span>{session.messages.length} 条消息</span>
                              {searchTerm && matchingMessages > 0 && (
                                <span className="text-blue-600 font-medium">
                                  {matchingMessages} 条匹配消息
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {!isSelectionMode && editingSessionId !== session.id && (
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(session);
                            }}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="重命名"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('确定要删除这个会话吗？')) {
                                onDeleteSession(session.id);
                              }
                            }}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-gray-200 text-sm text-gray-500 text-center">
          <div className="flex items-center justify-center space-x-4">
            <span>共 {sessions.length} 个会话</span>
            {searchTerm && (
              <span className="text-blue-600">
                找到 {filteredSessions.length} 个匹配结果
              </span>
            )}
            {isSelectionMode && selectedSessionIds.size > 0 && (
              <span className="text-green-600">
                已选择 {selectedSessionIds.size} 个会话
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionManager;