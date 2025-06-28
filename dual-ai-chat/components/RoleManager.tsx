import React, { useState } from 'react';
import { CustomAIRole } from '../types';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy, 
  Save, 
  X,
  Palette,
  Smile
} from 'lucide-react';

interface RoleManagerProps {
  roles: CustomAIRole[];
  currentCognitoRole: CustomAIRole;
  currentMuseRole: CustomAIRole;
  onCreateRole: (roleData: Omit<CustomAIRole, 'id' | 'isBuiltIn' | 'createdAt'>) => void;
  onUpdateRole: (roleId: string, updates: Partial<Omit<CustomAIRole, 'id' | 'isBuiltIn' | 'createdAt'>>) => void;
  onDeleteRole: (roleId: string) => void;
  onDuplicateRole: (roleId: string) => void;
  onSelectRole: (roleName: string, type: 'cognito' | 'muse') => void;
  onClose: () => void;
}

interface RoleFormData {
  name: string;
  displayName: string;
  systemPrompt: string;
  icon: string;
  color: string;
}

const EMOJI_OPTIONS = ['🤖', '💡', '⚡', '🎨', '📊', '🔍', '👨‍🏫', '🧠', '💭', '🔬', '📝', '🎯', '⭐', '🚀', '💯'];
const COLOR_OPTIONS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4',
  '#84cc16', '#f97316', '#ec4899', '#6366f1', '#14b8a6', '#a855f7'
];

const RoleManager: React.FC<RoleManagerProps> = ({
  roles,
  currentCognitoRole,
  currentMuseRole,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onDuplicateRole,
  onSelectRole,
  onClose
}) => {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    displayName: '',
    systemPrompt: '',
    icon: '🤖',
    color: '#10b981'
  });
  const [activeTab, setActiveTab] = useState<'all' | 'custom'>('all');

  const filteredRoles = activeTab === 'all' ? roles : roles.filter(role => !role.isBuiltIn);

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      systemPrompt: '',
      icon: '🤖',
      color: '#10b981'
    });
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
    setEditingRoleId(null);
  };

  const handleStartEdit = (role: CustomAIRole) => {
    if (role.isBuiltIn) return;
    setFormData({
      name: role.name,
      displayName: role.displayName,
      systemPrompt: role.systemPrompt,
      icon: role.icon,
      color: role.color
    });
    setEditingRoleId(role.id);
    setIsCreating(false);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.displayName.trim() || !formData.systemPrompt.trim()) {
      alert('请填写所有必填字段');
      return;
    }

    if (isCreating) {
      onCreateRole(formData);
    } else if (editingRoleId) {
      onUpdateRole(editingRoleId, formData);
    }

    handleCancel();
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingRoleId(null);
    resetForm();
  };

  const isEditing = isCreating || editingRoleId !== null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] mx-4 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Users className="mr-2" size={20} />
            AI角色管理
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧角色列表 */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            {/* 标签页 */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'all'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                所有角色
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'custom'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                自定义角色
              </button>
            </div>

            {/* 工具栏 */}
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={handleStartCreate}
                className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} className="mr-2" />
                创建新角色
              </button>
            </div>

            {/* 角色列表 */}
            <div className="flex-1 overflow-y-auto">
              {filteredRoles.map((role) => (
                <div
                  key={role.id}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    editingRoleId === role.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <span 
                        className="text-xl"
                        style={{ color: role.color }}
                      >
                        {role.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {role.displayName}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {role.isBuiltIn ? '内置' : '自定义'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {role.name === currentCognitoRole.name && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          Cognito
                        </span>
                      )}
                      {role.name === currentMuseRole.name && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          Muse
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center space-x-2">
                    <button
                      onClick={() => onSelectRole(role.name, 'cognito')}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors"
                    >
                      设为Cognito
                    </button>
                    <button
                      onClick={() => onSelectRole(role.name, 'muse')}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded transition-colors"
                    >
                      设为Muse
                    </button>
                    
                    {!role.isBuiltIn && (
                      <>
                        <button
                          onClick={() => handleStartEdit(role)}
                          className="text-blue-600 hover:text-blue-700"
                          title="编辑"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDuplicateRole(role.id)}
                          className="text-gray-600 hover:text-gray-700"
                          title="复制"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定要删除这个角色吗？')) {
                              onDeleteRole(role.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧编辑表单 */}
          <div className="flex-1 flex flex-col">
            {isEditing ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {isCreating ? '创建新角色' : '编辑角色'}
                  </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        角色名称 *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例如: analyst"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        显示名称 *
                      </label>
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例如: 分析师"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        图标
                      </label>
                      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setFormData({ ...formData, icon: emoji })}
                            className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                              formData.icon === emoji ? 'bg-blue-100' : 'hover:bg-gray-100'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        颜色
                      </label>
                      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setFormData({ ...formData, color })}
                            className={`w-8 h-8 rounded border-2 transition-transform ${
                              formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      系统提示词 *
                    </label>
                    <textarea
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="定义AI角色的行为和个性..."
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Save size={16} className="mr-2" />
                    保存
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>选择一个角色进行编辑</p>
                  <p className="text-sm mt-2">或创建一个新的自定义角色</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleManager;