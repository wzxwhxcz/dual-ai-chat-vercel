import React, { useState } from 'react';
import { ChatSession } from '../types';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Clock,
  Search
} from 'lucide-react';

interface SessionManagerProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onCreateSession: (title?: string) => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onClose: () => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  currentSessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
  onClose
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] mx-4">
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

        {/* 工具栏 */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onCreateSession()}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2" />
              新建会话
            </button>
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索会话..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 会话列表 */}
        <div className="max-h-96 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? '未找到匹配的会话' : '暂无会话历史'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    session.id === currentSessionId ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        onSwitchSession(session.id);
                        onClose();
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
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
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
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {editingSessionId !== session.id && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleStartEdit(session)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="重命名"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
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
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-gray-200 text-sm text-gray-500 text-center">
          共 {sessions.length} 个会话
        </div>
      </div>
    </div>
  );
};

export default SessionManager;