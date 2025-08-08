import { useState, useCallback, useEffect } from 'react';
import { CustomAIRole } from '../types';
import { CUSTOM_AI_ROLES_STORAGE_KEY, COGNITO_SYSTEM_PROMPT_HEADER, MUSE_SYSTEM_PROMPT_HEADER } from '../constants';
import { generateUniqueId } from '../utils/appUtils';

// 内置角色
const BUILT_IN_ROLES: CustomAIRole[] = [
  {
    id: 'cognito-default',
    name: 'cognito',
    displayName: 'Cognito (默认)',
    systemPrompt: COGNITO_SYSTEM_PROMPT_HEADER,
    icon: '💡',
    color: '#10b981',
    isBuiltIn: true,
    createdAt: new Date()
  },
  {
    id: 'muse-default',
    name: 'muse',
    displayName: 'Muse (默认)',
    systemPrompt: MUSE_SYSTEM_PROMPT_HEADER,
    icon: '⚡',
    color: '#8b5cf6',
    isBuiltIn: true,
    createdAt: new Date()
  },
  {
    id: 'analyst',
    name: 'analyst',
    displayName: '分析师',
    systemPrompt: '你是一个专业的分析师AI，擅长数据分析、逻辑推理和问题分解。你总是以数据为驱动，提供客观、准确的分析结果。请保持专业和严谨的态度。',
    icon: '📊',
    color: '#3b82f6',
    isBuiltIn: true,
    createdAt: new Date()
  },
  {
    id: 'creative',
    name: 'creative',
    displayName: '创意师',
    systemPrompt: '你是一个充满创意的AI，擅长头脑风暴、创新思维和艺术创作。你总是能够从独特的角度思考问题，提供富有想象力的解决方案。请保持开放和创新的态度。',
    icon: '🎨',
    color: '#f59e0b',
    isBuiltIn: true,
    createdAt: new Date()
  },
  {
    id: 'teacher',
    name: 'teacher',
    displayName: '教师',
    systemPrompt: '你是一个耐心的教师AI，擅长解释复杂概念、循序渐进地教学。你总是用简单易懂的方式讲解，确保学习者能够真正理解。请保持耐心和鼓励的态度。',
    icon: '👨‍🏫',
    color: '#06b6d4',
    isBuiltIn: true,
    createdAt: new Date()
  },
  {
    id: 'critic',
    name: 'critic',
    displayName: '评论家',
    systemPrompt: '你是一个严格的评论家AI，擅长批判性思维和质量评估。你总是能够发现问题和不足，提供建设性的批评和改进建议。请保持客观和犀利的态度。',
    icon: '🔍',
    color: '#ef4444',
    isBuiltIn: true,
    createdAt: new Date()
  }
];

export const useCustomRoles = () => {
  const [customRoles, setCustomRoles] = useState<CustomAIRole[]>([]);
  const [allRoles, setAllRoles] = useState<CustomAIRole[]>([]);

  // 从localStorage加载自定义角色
  const loadCustomRoles = useCallback(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_AI_ROLES_STORAGE_KEY);
      if (stored) {
        const parsed: CustomAIRole[] = JSON.parse(stored);
        const rolesWithDates = parsed.map(role => ({
          ...role,
          createdAt: new Date(role.createdAt)
        }));
        setCustomRoles(rolesWithDates);
      }
    } catch (error) {
      console.error('加载自定义角色失败:', error);
      setCustomRoles([]);
    }
  }, []);

  // 保存自定义角色到localStorage
  const saveCustomRoles = useCallback((roles: CustomAIRole[]) => {
    try {
      localStorage.setItem(CUSTOM_AI_ROLES_STORAGE_KEY, JSON.stringify(roles));
    } catch (error) {
      console.error('保存自定义角色失败:', error);
    }
  }, []);

  // 创建新角色
  const createRole = useCallback((roleData: Omit<CustomAIRole, 'id' | 'isBuiltIn' | 'createdAt'>) => {
    const newRole: CustomAIRole = {
      ...roleData,
      id: generateUniqueId(),
      isBuiltIn: false,
      createdAt: new Date()
    };

    setCustomRoles(prev => {
      const updated = [...prev, newRole];
      saveCustomRoles(updated);
      return updated;
    });

    return newRole.id;
  }, [saveCustomRoles]);

  // 更新角色
  const updateRole = useCallback((roleId: string, updates: Partial<Omit<CustomAIRole, 'id' | 'isBuiltIn' | 'createdAt'>>) => {
    setCustomRoles(prev => {
      const updated = prev.map(role => {
        if (role.id === roleId && !role.isBuiltIn) {
          return { ...role, ...updates };
        }
        return role;
      });
      saveCustomRoles(updated);
      return updated;
    });
  }, [saveCustomRoles]);

  // 删除角色
  const deleteRole = useCallback((roleId: string) => {
    setCustomRoles(prev => {
      const updated = prev.filter(role => role.id !== roleId && !role.isBuiltIn);
      saveCustomRoles(updated);
      return updated;
    });
  }, [saveCustomRoles]);

  // 根据ID获取角色
  const getRoleById = useCallback((roleId: string): CustomAIRole | undefined => {
    return allRoles.find(role => role.id === roleId);
  }, [allRoles]);

  // 根据name获取角色
  const getRoleByName = useCallback((roleName: string): CustomAIRole | undefined => {
    return allRoles.find(role => role.name === roleName);
  }, [allRoles]);

  // 复制角色
  const duplicateRole = useCallback((roleId: string, newName?: string) => {
    const originalRole = getRoleById(roleId);
    if (!originalRole) return null;

    const duplicatedRole: CustomAIRole = {
      ...originalRole,
      id: generateUniqueId(),
      name: newName || `${originalRole.name}_copy`,
      displayName: `${originalRole.displayName} (副本)`,
      isBuiltIn: false,
      createdAt: new Date()
    };

    setCustomRoles(prev => {
      const updated = [...prev, duplicatedRole];
      saveCustomRoles(updated);
      return updated;
    });

    return duplicatedRole.id;
  }, [getRoleById, saveCustomRoles]);

  // 更新所有角色列表
  useEffect(() => {
    setAllRoles([...BUILT_IN_ROLES, ...customRoles]);
  }, [customRoles]);

  // 初始化时加载自定义角色
  useEffect(() => {
    loadCustomRoles();
  }, [loadCustomRoles]);

  return {
    customRoles,
    allRoles,
    builtInRoles: BUILT_IN_ROLES,
    createRole,
    updateRole,
    deleteRole,
    getRoleById,
    getRoleByName,
    duplicateRole,
    loadCustomRoles
  };
};