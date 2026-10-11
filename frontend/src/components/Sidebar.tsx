import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  MoreVertical,
  Pencil,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  User as UserIcon,
  LogOut,
  Moon,
  Sun,
  Monitor,
  MessageSquare,
  Archive,
  ArchiveRestore,
  X,
  ArchiveX,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUIStore, useConversationStore, useChatStore } from '../stores';
import { api } from '../services/api';
import { Avatar, Button, Dropdown, Input, Modal, SkeletonConversationList, Tooltip, ConfirmDialog } from './ui';
import { formatRelativeTime } from '../utils/format';
import type { ConversationWithMeta } from '../types';

interface ConversationRowProps {
  conversation: ConversationWithMeta;
  isActive: boolean;
  isGenerating: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function ConversationRow({
  conversation,
  isActive,
  isGenerating,
  collapsed,
  onSelect,
  onTogglePin,
  onArchive,
  onDelete,
  onRename,
}: ConversationRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Collapsed rail: a single icon per conversation — no truncated text.
  if (collapsed) {
    return (
      <Tooltip content={conversation.title} placement="right">
        <button
          type="button"
          onClick={onSelect}
          className={clsx(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            isActive
              ? 'bg-accent-subtle text-accent'
              : 'text-content-muted hover:bg-surface-hover hover:text-content-primary'
          )}
          aria-label={conversation.title}
          aria-current={isActive ? 'true' : undefined}
        >
          {conversation.pinned ? <Pin size={15} /> : <MessageSquare size={15} />}
        </button>
      </Tooltip>
    );
  }

  const row = (
    <div className="group/row relative">
      <button
        type="button"
        onClick={onSelect}
        className={clsx(
          'w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-fast ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isActive
            ? 'bg-accent-subtle text-content-primary'
            : 'text-content-primary hover:bg-surface-hover'
        )}
        aria-current={isActive ? 'true' : undefined}
        title={collapsed ? conversation.title : undefined}
      >
        <div className="flex items-center gap-1.5">
          {conversation.pinned && <Pin size={11} className="shrink-0 text-accent" aria-label="Pinned" />}
          <span className={clsx('min-w-0 flex-1 truncate text-sm', isActive ? 'font-semibold' : 'font-medium')}>
            {conversation.title}
          </span>
        </div>
        {!collapsed && (
          <div className="mt-0.5 flex items-baseline gap-2">
            {conversation.lastMessagePreview && (
              <span className="min-w-0 flex-1 truncate text-xs text-content-muted">
                {conversation.lastMessagePreview}
              </span>
            )}
            <span className="shrink-0 text-[0.68rem] text-content-muted">
              {formatRelativeTime(conversation.updatedAt)}
            </span>
          </div>
        )}
      </button>

      {!collapsed && (
        <div
          className={clsx(
            'absolute right-1.5 top-1.5 transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100'
          )}
        >
          <Dropdown
            align="right"
            width={190}
            trigger={
              <button
                type="button"
                className="icon-btn h-6 w-6 bg-surface-primary/80 backdrop-blur-sm"
                aria-label={`Options for ${conversation.title}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <MoreVertical size={14} />
              </button>
            }
            items={[
              {
                label: conversation.pinned ? 'Unpin' : 'Pin',
                icon: conversation.pinned ? <PinOff size={15} /> : <Pin size={15} />,
                onClick: onTogglePin,
              },
              {
                label: conversation.archived ? 'Restore' : 'Archive',
                icon: conversation.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />,
                onClick: onArchive,
              },
              {
                label: 'Rename',
                icon: <Pencil size={15} />,
                onClick: onRename,
              },
              {
                label: 'Delete',
                icon: <Trash2 size={15} />,
                danger: true,
                onClick: onDelete,
              },
            ]}
          />
        </div>
      )}

      {isGenerating && !collapsed && (
        <span
          className="absolute bottom-2 right-3 h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
          aria-label="Generating"
        />
      )}
    </div>
  );

  return row;
}

interface RenameDialogState {
  conversationId: string;
  currentTitle: string;
}

/** Tracks the lg breakpoint so collapse semantics stay desktop-only. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  return isDesktop;
}

export function Sidebar() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const isMobileSidebarOpen = useUIStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const searchQuery = useConversationStore((s) => s.searchQuery);
  const searchResults = useConversationStore((s) => s.searchResults);
  const isSearching = useConversationStore((s) => s.isSearching);
  const setSearchQuery = useConversationStore((s) => s.setSearchQuery);
  const setSearchResults = useConversationStore((s) => s.setSearchResults);
  const setSearching = useConversationStore((s) => s.setSearching);
  const updateConversation = useConversationStore((s) => s.updateConversation);
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const generations = useChatStore((s) => s.generations);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [renameTarget, setRenameTarget] = useState<RenameDialogState | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ConversationWithMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const isDesktop = useIsDesktop();

  // Collapse is a desktop-only concept: on mobile the sidebar is a drawer and
  // always renders expanded, so a persisted collapsed flag can't break it.
  const collapsed = sidebarCollapsed && isDesktop;

  /* ------------------------------ data helpers ------------------------------ */

  const refreshList = useCallback(async () => {
    try {
      const response = await api.conversations.list({ page: 1, pageSize: 100, includeArchived: true });
      useConversationStore.getState().setConversations(response.data);
    } catch {
      // Non-fatal; the list stays as-is.
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void refreshList();
  }, [isAuthenticated, refreshList]);

  // Keep the sidebar in sync when a title changes anywhere in the app.
  useEffect(() => {
    if (isAuthenticated) void refreshList();
  }, [isAuthenticated, refreshList]);

  /* --------------------------------- search --------------------------------- */

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const response = await api.conversations.search(query.trim(), 30);
      setSearchResults(response.conversations);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [setSearchResults, setSearching]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => void runSearch(value), 250);
    },
    [setSearchQuery, runSearch]
  );

  // Ctrl/Cmd+K focuses search, Ctrl/Cmd+N starts a new chat, Escape closes mobile.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileSidebarOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/chat');
      } else if (e.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, setMobileSidebarOpen]);

  /* -------------------------------- mutations -------------------------------- */

  const handleNewChat = useCallback(() => {
    navigate('/chat');
    setMobileSidebarOpen(false);
  }, [navigate, setMobileSidebarOpen]);

  const handleSelect = useCallback(
    (id: string) => {
      navigate(`/chat/${id}`);
      setMobileSidebarOpen(false);
    },
    [navigate, setMobileSidebarOpen]
  );

  const handleTogglePin = useCallback(
    async (conversation: ConversationWithMeta) => {
      const nextPinned = !conversation.pinned;
      // Optimistic update with rollback on failure.
      updateConversation(conversation.id, { pinned: nextPinned });
      try {
        await api.conversations.update(conversation.id, { pinned: nextPinned });
        await refreshList();
      } catch {
        updateConversation(conversation.id, { pinned: conversation.pinned });
      }
    },
    [updateConversation, refreshList]
  );

  const handleToggleArchive = useCallback(
    async (conversation: ConversationWithMeta) => {
      const nextArchived = !conversation.archived;
      updateConversation(conversation.id, { archived: nextArchived });
      try {
        await api.conversations.update(conversation.id, { archived: nextArchived });
        await refreshList();
        if (activeConversationId === conversation.id && nextArchived) {
          navigate('/chat');
        }
      } catch {
        updateConversation(conversation.id, { archived: conversation.archived });
      }
    },
    [updateConversation, refreshList, activeConversationId, navigate]
  );

  const handleRename = useCallback(async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title || title === renameTarget.currentTitle) {
      setRenameTarget(null);
      return;
    }
    updateConversation(renameTarget.conversationId, { title });
    setRenameTarget(null);
    try {
      await api.conversations.update(renameTarget.conversationId, { title });
      await refreshList();
    } catch {
      updateConversation(renameTarget.conversationId, { title: renameTarget.currentTitle });
    }
  }, [renameTarget, renameValue, updateConversation, refreshList]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.conversations.delete(deleteTarget.id);
      removeConversation(deleteTarget.id);
      setDeleteTarget(null);
      if (activeConversationId === deleteTarget.id) {
        navigate('/chat');
      }
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, removeConversation, activeConversationId, navigate]);

  const handleThemeCycle = useCallback(() => {
    const themes = ['light', 'dark', 'system'] as const;
    setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);
  }, [theme, setTheme]);

  /* --------------------------------- derived --------------------------------- */

  const { pinned, recent, archived } = useMemo(() => {
    const source = searchQuery.trim() ? searchResults || [] : conversations;
    return {
      pinned: source.filter((c) => c.pinned && !c.archived),
      recent: source.filter((c) => !c.pinned && !c.archived),
      archived: source.filter((c) => c.archived),
    };
  }, [conversations, searchResults, searchQuery]);

  if (!isAuthenticated) return null;

  const renderRows = (items: ConversationWithMeta[]) =>
    items.map((conversation) => (
      <ConversationRow
        key={conversation.id}
        conversation={conversation}
        isActive={activeConversationId === conversation.id}
        isGenerating={Boolean(generations[conversation.id])}
        collapsed={collapsed}
        onSelect={() => handleSelect(conversation.id)}
        onTogglePin={() => void handleTogglePin(conversation)}
        onArchive={() => void handleToggleArchive(conversation)}
        onDelete={() => setDeleteTarget(conversation)}
        onRename={() => {
          setRenameTarget({ conversationId: conversation.id, currentTitle: conversation.title });
          setRenameValue(conversation.title);
        }}
      />
    ));

  const sectionHeader = (label: string, count?: number) => (
    <h3 className="px-2.5 pb-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-wider text-content-muted">
      {label}
      {count !== undefined && count > 0 && <span className="ml-1.5 normal-case">{count}</span>}
    </h3>
  );

  const listBody = searchQuery.trim() ? (
    <>
      {sectionHeader('Search results')}
      {isSearching ? (
        <div className="px-1.5 pt-2"><SkeletonConversationList count={3} /></div>
      ) : pinned.length + recent.length === 0 ? (
        <p className="px-2.5 py-6 text-center text-sm text-content-muted">No conversations match “{searchQuery.trim()}”.</p>
      ) : (
        <div className="space-y-0.5 pt-1">{renderRows([...pinned, ...recent])}</div>
      )}
    </>
  ) : (
    <>
      {pinned.length > 0 && (
        <>
          {sectionHeader('Pinned')}
          <div className="space-y-0.5">{renderRows(pinned)}</div>
        </>
      )}
      {sectionHeader('Recent')}
      <div className="space-y-0.5">{renderRows(recent)}</div>
      {archived.length > 0 && (
        <div className="mt-2 border-t border-line-subtle pt-1">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-content-muted transition-colors hover:bg-surface-hover hover:text-content-secondary"
            aria-expanded={showArchived}
          >
            <ArchiveX size={13} />
            Archived
            <span className="ml-auto rounded-full bg-surface-secondary px-1.5 text-[0.68rem]">{archived.length}</span>
          </button>
          {showArchived && <div className="space-y-0.5 pt-1">{renderRows(archived)}</div>}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] animate-fade-in lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line-subtle bg-surface-primary',
          'transition-transform duration-base ease-out lg:static lg:z-auto lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-72 w-72',
          isMobileSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        )}
        aria-label="Conversations sidebar"
      >
        {/* Brand */}
        <div className={clsx('flex h-14 shrink-0 items-center border-b border-line-subtle', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Auron AI home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-solid">
              <svg className="h-4.5 w-4.5 text-white" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </span>
            {!collapsed && <span className="text-[1.05rem] font-bold tracking-tight text-content-primary">Auron AI</span>}
          </button>
          {!collapsed && (
            <button type="button" onClick={() => setMobileSidebarOpen(false)} className="icon-btn lg:hidden" aria-label="Close sidebar">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Primary actions */}
        <div className={clsx('shrink-0 space-y-2 border-b border-line-subtle p-3', collapsed && 'px-2')}>
          <Tooltip content="New chat · Ctrl+N" placement="right">
            <Button
              variant="primary"
              fullWidth={collapsed ? false : true}
              iconOnly={collapsed}
              icon={<Plus size={17} />}
              onClick={handleNewChat}
              aria-label="New chat"
              className="justify-start"
            >
              {!collapsed && 'New chat'}
            </Button>
          </Tooltip>
          {!collapsed && (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search chats…"
                aria-label="Search conversations"
                className="w-full rounded-lg border border-line-subtle bg-surface-secondary py-2 pl-9 pr-12 text-sm text-content-primary placeholder:text-content-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line-subtle bg-surface-primary px-1.5 py-0.5 font-mono text-[0.65rem] text-content-muted">
                ⌘K
              </kbd>
            </div>
          )}
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2" aria-label="Conversation list">
          {collapsed ? (
            <div className="space-y-1">
              {conversations.filter((c) => !c.archived).slice(0, 8).map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={activeConversationId === conversation.id}
                  isGenerating={Boolean(generations[conversation.id])}
                  collapsed
                  onSelect={() => handleSelect(conversation.id)}
                  onTogglePin={() => void handleTogglePin(conversation)}
                  onArchive={() => void handleToggleArchive(conversation)}
                  onDelete={() => setDeleteTarget(conversation)}
                  onRename={() => {
                    setRenameTarget({ conversationId: conversation.id, currentTitle: conversation.title });
                    setRenameValue(conversation.title);
                  }}
                />
              ))}
            </div>
          ) : (
            listBody
          )}
        </nav>

        {/* Footer */}
        <div className={clsx('shrink-0 border-t border-line-subtle p-3', collapsed && 'px-2')}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Tooltip content="Expand sidebar" placement="right">
                <Button variant="ghost" iconOnly icon={<PanelLeftOpen size={17} />} onClick={toggleSidebar} aria-label="Expand sidebar" />
              </Tooltip>
              <Dropdown
                align="left"
                width={190}
                trigger={
                  <button type="button" className="mt-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Account menu">
                    <Avatar name={user?.name || 'User'} size="sm" color={user?.avatarColor} />
                  </button>
                }
                items={accountMenuItems(handleThemeCycle, theme, () => navigate('/profile'), () => navigate('/settings'), logout)}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Dropdown
                  align="left"
                  width={210}
                  trigger={
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Account menu">
                      <Avatar name={user?.name || 'User'} size="sm" color={user?.avatarColor} />
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-sm font-medium text-content-primary">{user?.name}</span>
                        <span className="block truncate text-xs text-content-muted">{user?.email}</span>
                      </span>
                    </button>
                  }
                  items={accountMenuItems(handleThemeCycle, theme, () => navigate('/profile'), () => navigate('/settings'), logout)}
                />
                <span className="hidden lg:block">
                  <Tooltip content="Collapse sidebar">
                    <Button variant="ghost" iconOnly icon={<PanelLeftClose size={17} />} onClick={toggleSidebar} aria-label="Collapse sidebar" />
                  </Tooltip>
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Rename dialog */}
      <Modal
        isOpen={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename conversation"
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleRename();
          }}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            maxLength={200}
          />
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" type="button" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!renameValue.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete conversation?"
        description={`“${deleteTarget?.title ?? ''}” and all of its messages will be permanently deleted.`}
        confirmLabel="Delete"
        danger
        loading={isDeleting}
      />
    </>
  );
}

function accountMenuItems(
  onThemeCycle: () => void,
  theme: 'light' | 'dark' | 'system',
  onProfile: () => void,
  onSettings: () => void,
  onLogout: () => void
) {
  const themeIcon = theme === 'dark' ? <Moon size={15} /> : theme === 'light' ? <Sun size={15} /> : <Monitor size={15} />;
  const themeLabel = `Theme: ${theme}`;
  return [
    { label: 'Profile', icon: <UserIcon size={15} />, onClick: onProfile },
    { label: 'Settings', icon: <SettingsIcon size={15} />, onClick: onSettings },
    { label: themeLabel, icon: themeIcon, onClick: onThemeCycle },
    { label: 'Log out', icon: <LogOut size={15} />, onClick: onLogout, danger: true },
  ];
}
