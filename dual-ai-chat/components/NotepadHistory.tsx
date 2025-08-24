import React, { useState } from 'react';
import { NotepadVersion } from '../types';
import { Clock, FileText, Download, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './ui/button';
import { MessageSender } from '../types';

interface NotepadHistoryProps {
  versions: NotepadVersion[];
  currentVersionIndex: number;
  onSelectVersion: (versionId: string) => void;
  onExportHistory: () => void;
  onClearHistory: () => void;
  onClose: () => void;
}

const NotepadHistory: React.FC<NotepadHistoryProps> = ({
  versions,
  currentVersionIndex,
  onSelectVersion,
  onExportHistory,
  onClearHistory,
  onClose
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    versions[currentVersionIndex]?.id || null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getAuthorIcon = (author: MessageSender | null) => {
    switch(author) {
      case MessageSender.User:
        return '👤';
      case MessageSender.Cognito:
        return '🧠';
      case MessageSender.Muse:
        return '✨';
      case MessageSender.System:
        return '⚙️';
      default:
        return '📝';
    }
  };

  const handleVersionClick = (version: NotepadVersion) => {
    setSelectedVersionId(version.id);
    setPreviewContent(version.content);
    setShowPreview(true);
  };

  const handleApplyVersion = () => {
    if (selectedVersionId) {
      onSelectVersion(selectedVersionId);
      setShowPreview(false);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const currentIndex = versions.findIndex(v => v.id === selectedVersionId);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(versions.length - 1, currentIndex + 1);
    }

    const newVersion = versions[newIndex];
    setSelectedVersionId(newVersion.id);
    setPreviewContent(newVersion.content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-11/12 max-w-6xl h-5/6 bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold">记事本版本历史</h2>
            <span className="text-sm text-gray-500">
              ({versions.length} 个版本)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onExportHistory}
              title="导出历史"
            >
              <Download size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearHistory}
              title="清空历史"
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-2">
              {versions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  暂无版本历史
                </div>
              ) : (
                versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`
                      p-3 mb-2 rounded-lg cursor-pointer transition-colors
                      ${version.id === selectedVersionId 
                        ? 'bg-blue-50 border-2 border-blue-300' 
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'}
                      ${index === currentVersionIndex ? 'ring-2 ring-green-400' : ''}
                    `}
                    onClick={() => handleVersionClick(version)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg" title={`作者: ${version.author || '手动编辑'}`}>
                            {getAuthorIcon(version.author)}
                          </span>
                          <span className="text-sm font-medium">
                            版本 {versions.length - index}
                          </span>
                          {index === currentVersionIndex && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                              当前
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(version.timestamp)}
                        </div>
                        {version.description && (
                          <div className="text-sm text-gray-600 mt-1">
                            {version.description}
                          </div>
                        )}
                        <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                          <span>{version.wordCount} 字</span>
                          <span>{version.lineCount} 行</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col">
            {showPreview ? (
              <>
                {/* Preview Header */}
                <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <FileText size={18} className="text-gray-600" />
                    <span className="font-medium">版本预览</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleNavigate('prev')}
                      disabled={versions.findIndex(v => v.id === selectedVersionId) === 0}
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleNavigate('next')}
                      disabled={versions.findIndex(v => v.id === selectedVersionId) === versions.length - 1}
                    >
                      <ChevronRight size={18} />
                    </Button>
                    <Button
                      onClick={handleApplyVersion}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      恢复此版本
                    </Button>
                  </div>
                </div>
                
                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-white">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {previewContent}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-3 opacity-50" />
                  <p>选择一个版本查看内容</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotepadHistory;