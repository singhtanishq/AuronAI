import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Menu,
  X,
  Plus,
  Search,
  Pin,
  PinOff,
  MoreVertical,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUIStore, useConversationStore, useSettingsStore } from '../../stores';
import { api } from '../../services/api';
import { Avatar, Button, Modal, Dropdown, TooltipTrigger } from '../ui';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '../ui/Toast';

interface ConversationItemProps {
  conversation: {
    id: string;
    title: string;
    pinned: boolean;
    archived: boolean;
    updatedAt: string;
    messageCount: number;
    lastMessagePreview?: string;
  };
  isActive: boolean;
  onSelect: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onPin,
  onArchive,
  onDelete,
  onRename,
}: ConversationItemProps) {
  const { addToast } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePin = () => {
    onPin();
    addToast(conversation.pinned ? 'Conversation unpinned' : 'Conversation pinned', 'success');
  };

  const handleArchive = () => {
    onArchive();
    addToast(conversation.archived ? 'Conversation restored' : 'Conversation archived', 'success');
  };

  const handleDelete = async () => {
    if (window.confirm('Delete conversation? This action cannot be undone.')) {
      onDelete();
      addToast('Conversation deleted', 'success');
    }
  };

  const handleRename = () => {
    const newTitle = window.prompt('Enter new title:', conversation.title);
    if (newTitle && newTitle.trim() && newTitle !== conversation.title) {
      onRename();
      addToast('Conversation renamed', 'success');
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={onSelect}
        className={clsx(
          'w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          isActive
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-text-primary'
        )}
        title={conversation.title}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={clsx('font-medium truncate', isActive ? 'font-semibold' : '')}>
              {conversation.title}
            </h4>
            {conversation.pinned && (
              <Pin className="flex-shrink-0 h-3.5 w-3.5 text-text-muted" aria-label="Pinned" />
            )}
          </div>
          {conversation.lastMessagePreview && (
            <p className="mt-1 text-xs text-text-muted truncate">
              {conversation.lastMessagePreview}
            </p>
          )}
          <p className="mt-1 text-xs text-text-muted">
            {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <TooltipTrigger
          content={showDropdown ? 'Close menu' : 'More options'}
          delay={0}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="flex-shrink-0 p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            aria-label="More options"
            aria-expanded={showDropdown}
          >
            <MoreVertical size={16} />
          </button>
        </TooltipTrigger>
      </button>

      {showDropdown && (
        <div
          className="fixed z-50 mt-1.5 right-0 w-48 rounded-lg bg-background-primary border border-border-light shadow-xl animate-fade-in dark:bg-surface-900 dark:border-border-dark"
          role="menu"
        >
          <div className="py-1">
            <button
              onClick={() => { handlePin(); setShowDropdown(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-100 dark:hover:bg-surface-800"
              role="menuitem"
            >
              {conversation.pinned ? <PinOff size={16} /> : <Pin size={16} />}
              {conversation.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => { handleArchive(); setShowDropdown(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-100 dark:hover:bg-surface-800"
              role="menuitem"
            >
              {conversation.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {conversation.archived ? 'Restore' : 'Archive'}
            </button>
            <button
              onClick={() => { handleRename(); setShowDropdown(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-100 dark:hover:bg-surface-800"
              role="menuitem"
            >
              <Edit size={16} />
              Rename
            </button>
            <button
              onClick={() => { handleDelete(); setShowDropdown(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-DEFAULT hover:bg-error-light dark:hover:bg-error-dark/20"
              role="menuitem"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed, theme, setTheme } = useUIStore();
  const { conversations, pinnedConversations, activeConversationId, isLoading } = useConversationStore();
  const { user, isAuthenticated, logout } = useAuth();
  const { preferences, setPreferences, models, ollamaHealthy } = useSettingsStore();
  const { addToast } = useToast();
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleNewChat = async () => {
    try {
      const response = await api.conversations.create();
      // The conversation will be added via the store
      addToast('New chat created', 'success');
    } catch {
      addToast('Failed to create new chat', 'error');
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = window.prompt('Type "DELETE ALL" to confirm:');
    if (confirmText === 'DELETE ALL') {
      try {
        await api.conversations.deleteAll();
        addToast('All conversations deleted', 'success');
        setShowDeleteAllModal(false);
      } catch {
        addToast('Failed to delete conversations', 'error');
      }
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setPreferences({ ...preferences!, theme: newTheme });
    api.settings.setTheme(newTheme);
  };

  if (!isAuthenticated) return null;

  const pinned = conversations.filter((c) => c.pinned && !c.archived);
  const regular = conversations.filter((c) => !c.pinned && !c.archived);

  return (
    <>
      <button
        className="lg:hidden btn-ghost fixed top-4 left-4 z-40"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={24} />
      </button>

      <aside
        ref={sidebarRef}
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-30 flex flex-col bg-background-primary border-r border-border-light transition-all duration-200 ease-out',
          'dark:bg-surface-900 dark:border-border-dark',
          sidebarCollapsed ? 'w-16' : 'w-72',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Sidebar"
      >
        {/* Header */}
        <div className={clsx('flex items-center h-16 px-4 border-b border-border-light dark:border-border-dark', sidebarCollapsed && 'justify-center')}>
          {!sidebarCollapsed && (
            <Link to="/chat" className="flex items-center gap-2" aria-label="Auron AI Home">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="font-semibold text-lg text-text-primary">Auron AI</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link to="/chat" className="flex items-center justify-center" aria-label="Auron AI Home">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </Link>
          )}
        </div>

        {/* New Chat & Search */}
        {!sidebarCollapsed && (
          <div className="p-4 space-y-3 border-b border-border-light dark:border-border-dark">
            <Button
              variant="primary"
              fullWidth
              onClick={handleNewChat}
              icon={<Plus size={18} />}
              className="justify-start gap-3"
            >
              <span>New Chat</span>
              <kbd className="ml-auto px-2 py-0.5 text-xs bg-surface-200 dark:bg-surface-700 rounded">
                Ctrl+N
              </kbd>
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="search"
                placeholder="Search chats..."
                className="w-full pl-10 pr-3 py-2 text-sm bg-surface-100 dark:bg-surface-800 border border-border-medium rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Handle search
                  }
                }}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs bg-surface-200 dark:bg-surface-700 rounded">
                Ctrl+K
              </kbd>
            </div>
          </div>
        )}

        {/* Conversation Lists */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Conversations">
          {pinned.length > 0 && (
            <div className={clsx('mb-4', sidebarCollapsed && 'hidden')}>
              <h5 className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Pinned
              </h5>
              {pinned.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversationId === conv.id}
                  onSelect={() => useConversationStore.getState().setActiveConversationId(conv.id)}
                  onPin={() => api.conversations.update(conv.id, { pinned: !conv.pinned })}
                  onArchive={() => api.conversations.update(conv.id, { archived: !conv.archived })}
                  onDelete={() => api.conversations.delete(conv.id)}
                  onRename={() => {
                    const newTitle = window.prompt('Enter new title:', conv.title);
                    if (newTitle?.trim()) api.conversations.update(conv.id, { title: newTitle.trim() });
                  }}
                />
              ))}
            </div>
          )}

          <div className={clsx(sidebarCollapsed && 'hidden')}>
            <h5 className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Recent
            </h5>
            {isLoading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse bg-surface-200 dark:bg-surface-700 rounded-lg" />
                ))}
              </div>
            ) : regular.length === 0 ? (
              <div className="px-3 py-8 text-center text-text-muted text-sm">
                No conversations yet
              </div>
            ) : (
              regular.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversationId === conv.id}
                  onSelect={() => useConversationStore.getState().setActiveConversationId(conv.id)}
                  onPin={() => api.conversations.update(conv.id, { pinned: !conv.pinned })}
                  onArchive={() => api.conversations.update(conv.id, { archived: !conv.archived })}
                  onDelete={() => api.conversations.delete(conv.id)}
                  onRename={() => {
                    const newTitle = window.prompt('Enter new title:', conv.title);
                    if (newTitle?.trim()) api.conversations.update(conv.id, { title: newTitle.trim() });
                  }}
                />
              ))
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className={clsx('p-3 border-t border-border-light dark:border-border-dark', sidebarCollapsed && 'hidden')}>
          <div className="flex items-center gap-3">
            <Avatar name={user?.name || 'User'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-text-primary truncate">{user?.name}</p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm" icon={<MoreVertical size={18} />} aria-label="User menu" />
              }
              items={[
                { label: 'Profile', icon: <User size={16} />, onClick: () => {}, shortcut: '' },
                { label: 'Settings', icon: <Settings size={16} />, onClick: () => {}, shortcut: '' },
                { label: 'Theme', icon: theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />, onClick: () => {}, shortcut: '' },
                { label: 'Logout', icon: <LogOut size={16} />, onClick: () => logout(), danger: true, shortcut: '' },
              ]}
              align="right"
            />
          </div>
        </div>

        {/* Collapsed footer */}
        {sidebarCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border-light dark:border-border-dark">
            <TooltipTrigger content="Toggle sidebar" delay={0}>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                icon={sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              />
            </TooltipTrigger>
          </div>
        )}

        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </aside>
    </>
  );
}