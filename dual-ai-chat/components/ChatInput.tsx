
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, XCircle, StopCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string, imageFile?: File | null) => void;
  isLoading: boolean;
  isApiKeyMissing: boolean;
  onStopGenerating: () => void; // New prop
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, isApiKeyMissing, onStopGenerating }) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedImage) {
      const objectUrl = URL.createObjectURL(selectedImage);
      setImagePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setImagePreviewUrl(null);
  }, [selectedImage]);

  const handleImageFile = (file: File | null) => {
    if (file && ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setSelectedImage(file);
    } else if (file) {
      alert('不支持的文件类型。请选择 JPG, PNG, GIF, 或 WEBP 格式的图片。');
      setSelectedImage(null);
    } else {
      setSelectedImage(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
  };

  const triggerSendMessage = () => {
    if ((inputValue.trim() || selectedImage) && !isLoading && !isApiKeyMissing) {
      onSendMessage(inputValue.trim(), selectedImage);
      setInputValue('');
      removeImage();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This will only be called if the button's type is "submit" (i.e., !isLoading)
    triggerSendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only trigger send if not loading; stop button handles its own click
      if (!isLoading) {
        triggerSendMessage();
      }
    }
    // No specific action needed for Shift+Enter, as the default textarea behavior is to add a newline.
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (ACCEPTED_IMAGE_TYPES.includes(items[i].type)) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  };

  const isDisabledInput = isLoading || isApiKeyMissing;

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-4 pb-0 mb-0 bg-background border-t border-border">
      {imagePreviewUrl && selectedImage && (
        <div className="mb-2 p-2 bg-muted rounded-md relative max-w-xs border border-border">
          <img src={imagePreviewUrl} alt={selectedImage.name || "图片预览"} className="max-h-24 max-w-full rounded" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={removeImage}
            className="absolute top-1 right-1 h-6 w-6 bg-black/40 text-white rounded-full hover:bg-black/60"
            aria-label="移除图片"
          >
            <XCircle size={16} />
          </Button>
          <div className="text-xs text-muted-foreground mt-1 truncate">{selectedImage.name} ({(selectedImage.size / 1024).toFixed(1)} KB)</div>
        </div>
      )}
      <div className="flex items-end space-x-2">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          placeholder="询问任何问题"
          className={cn(
            "flex-grow resize-none min-h-[48px] max-h-[120px] sm:max-h-[150px] text-base",
            isDraggingOver && "ring-2 ring-primary"
          )}
          rows={1}
          disabled={isDisabledInput}
          aria-label="聊天输入框"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          aria-label="选择图片文件"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleFileButtonClick}
          disabled={isDisabledInput}
          aria-label="添加图片附件"
          title="添加图片"
          className="h-[48px] w-[48px] shrink-0"
        >
          <Paperclip size={18} className="sm:w-5 sm:h-5" />
        </Button>
        <Button
          type={isLoading ? "button" : "submit"}
          variant={isLoading ? "destructive" : "default"}
          size="icon"
          onClick={isLoading ? onStopGenerating : undefined}
          disabled={!isLoading && (isApiKeyMissing || (!inputValue.trim() && !selectedImage))}
          aria-label={isLoading ? "停止生成" : "发送消息"}
          title={isLoading ? "停止生成" : "发送消息"}
          className="h-[48px] w-[48px] shrink-0"
        >
          {isLoading ? <StopCircle size={18} className="sm:w-5 sm:h-5" /> : <Send size={18} className="sm:w-5 sm:h-5" />}
        </Button>
      </div>
    </form>
  );
};

export default ChatInput;
