import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  ArrowLeft,
  Paperclip,
  FileText,
  X,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Pin,
  History,
  Plus,
  Wand2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  attachmentMimeType?: string;
  generatedImageUrl?: string;
  pinned?: boolean;
  engine?: string;
}

interface ChatSessionItem {
  id: string;
  title: string;
  updatedAt: string;
  pinned: boolean;
  messages: ChatMessage[];
}

interface EduSyncAiTutorProps {
  studentName: string;
  defaultCourse?: string;
  onBack?: () => void;
}

const STORAGE_KEY_SESSIONS = 'waqar_gemini_chat_sessions_v2';

export const EduSyncAiTutor: React.FC<EduSyncAiTutorProps> = ({
  studentName,
  defaultCourse = 'All Subjects & Computer Science',
  onBack,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [longPressedSessionId, setLongPressedSessionId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // File / Image Attachment State
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentMimeType, setAttachmentMimeType] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Chat Sessions & Pinned Threads (Starts completely empty — NO pre-filled welcome message!)
  const [sessions, setSessions] = useState<ChatSessionItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: `session-${Date.now()}`,
        title: 'New Conversation',
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pinned: false,
        messages: [],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || 'default');

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ||
    sessions[0] || {
      id: 'default',
      title: 'New Conversation',
      updatedAt: '',
      pinned: false,
      messages: [],
    };

  const messages = activeSession.messages;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch {
      // ignore storage quota
    }
  }, [sessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const updateActiveSessionMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setSessions((prevSessions) =>
      prevSessions.map((sess) => {
        if (sess.id !== activeSession.id) return sess;
        const nextMessages = updater(sess.messages);
        const firstUserMsg = nextMessages.find((m) => m.role === 'user');
        const nextTitle = firstUserMsg
          ? firstUserMsg.text.slice(0, 42) + (firstUserMsg.text.length > 42 ? '...' : '')
          : sess.title;
        return {
          ...sess,
          title: nextTitle,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messages: nextMessages,
        };
      })
    );
  };

  const handleStartNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSess: ChatSessionItem = {
      id: newId,
      title: 'New Conversation',
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pinned: false,
      messages: [],
    };
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newId);
    setShowHistoryDrawer(false);
  };

  const handleTogglePinSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
    );
    setLongPressedSessionId(null);
  };

  const handleSessionPointerDown = (sessionId: string) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressedSessionId(sessionId);
    }, 450);
  };

  const handleSessionPointerUp = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTogglePinMessage = (msgId: string) => {
    updateActiveSessionMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, pinned: !m.pinned } : m))
    );
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingMsgId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg.text);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    setAttachmentMimeType(file.type || 'application/octet-stream');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setAttachmentDataUrl('');
    setAttachmentName('');
    setAttachmentMimeType('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (customPrompt?: string, forceMode: 'tutor' | 'image' = 'tutor') => {
    const question = (customPrompt ?? prompt).trim();
    if ((!question && !attachmentDataUrl) || loading) return;

    const displayQuestion =
      question || (attachmentName ? `Analyze attached file: ${attachmentName}` : '');

    const currentAttachmentUrl = attachmentDataUrl;
    const currentAttachmentName = attachmentName;
    const currentAttachmentMime = attachmentMimeType;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: forceMode === 'image' ? `Create Image: ${displayQuestion}` : displayQuestion,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachmentName: currentAttachmentName || undefined,
      attachmentDataUrl: currentAttachmentUrl || undefined,
      attachmentMimeType: currentAttachmentMime || undefined,
    };

    updateActiveSessionMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setPrompt('');
    clearAttachment();
    setLoading(true);

    try {
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: displayQuestion,
          subject: defaultCourse,
          mode: forceMode,
          attachmentDataUrl: currentAttachmentUrl || undefined,
          attachmentName: currentAttachmentName || undefined,
          attachmentMimeType: currentAttachmentMime || undefined,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await response.json();
      const replyText =
        response.ok && data.reply
          ? data.reply
          : data.error || 'Unable to process request right now.';

      updateActiveSessionMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          generatedImageUrl: data.generatedImageUrl || undefined,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          engine: data.engine || 'edusense-fast-ai',
        },
      ]);
    } catch {
      updateActiveSessionMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          text: 'Network error while connecting to EduSense AI. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div className="relative rounded-3xl bg-[#0E131F] text-slate-100 border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-[540px]">
      {/* Clean Top Header Bar (Only Back + History Drawer — NO Gemini, Pin, or New Chat in top bar) */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-[#131926] border-b border-slate-800/90">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHistoryDrawer((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showHistoryDrawer
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title="View Chat History (Long press any chat to Pin)"
          >
            <History className="w-4 h-4" />
            <span>History ({sessions.length})</span>
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-400">
          EduSense AI Tutor
        </div>
      </div>

      {/* Slide-Over Chat History Drawer (Long Press any Chat to reveal Pin option) */}
      {showHistoryDrawer && (
        <div className="bg-[#161F30] border-b border-slate-700 p-4 space-y-2.5 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 block">
                Recent & Pinned Conversations
              </span>
              <span className="text-[11px] text-slate-400">
                Long-press any conversation to Pin or Unpin it
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartNewChat}
                className="px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Fresh</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {sortedSessions.map((sess) => {
              const showPinAction = longPressedSessionId === sess.id || sess.pinned;
              return (
                <div
                  key={sess.id}
                  onMouseDown={() => handleSessionPointerDown(sess.id)}
                  onMouseUp={handleSessionPointerUp}
                  onMouseLeave={handleSessionPointerUp}
                  onTouchStart={() => handleSessionPointerDown(sess.id)}
                  onTouchEnd={handleSessionPointerUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setLongPressedSessionId(sess.id);
                  }}
                  onClick={() => {
                    if (longPressedSessionId === sess.id) return;
                    setActiveSessionId(sess.id);
                    setShowHistoryDrawer(false);
                  }}
                  className={`p-2.5 rounded-2xl flex items-center justify-between gap-2 cursor-pointer transition-colors select-none ${
                    sess.id === activeSession.id
                      ? 'bg-blue-600/25 border border-blue-500/40 text-white'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="truncate flex-1">
                    <div className="text-sm font-bold truncate flex items-center gap-1.5">
                      {sess.pinned && <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <span className="truncate">{sess.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {sess.messages.length} messages • {sess.updatedAt}
                    </div>
                  </div>
                  {showPinAction && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePinSession(sess.id);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        sess.pinned
                          ? 'text-amber-300 bg-amber-500/20 border border-amber-400/40'
                          : 'text-sky-300 bg-sky-500/20 border border-sky-400/40'
                      }`}
                      title="Pin / Unpin Conversation"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{sess.pinned ? 'Unpin' : 'Pin Chat'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Conversation Viewport (No pre-written example chips!) */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-5 max-h-[420px]">
        {messages.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center mx-auto shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Hello, {studentName}
              </h3>
              <p className="text-sm sm:text-base text-slate-400 font-medium">
                Type any question below or tap Create Image for instant visual diagrams
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-3xl px-4.5 py-3.5 shadow-md ${
                  msg.role === 'user'
                    ? 'bg-[#253047] text-white rounded-br-sm'
                    : 'bg-[#161F30] text-slate-100 border border-slate-800 rounded-bl-sm'
                }`}
              >
                {msg.pinned && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 mb-1.5">
                    <Pin className="w-3 h-3" />
                    <span>Pinned</span>
                  </div>
                )}

                {msg.attachmentName && (
                  <div className="mb-2.5 p-2 rounded-2xl bg-slate-900/60 border border-slate-700">
                    {msg.attachmentDataUrl && msg.attachmentDataUrl.startsWith('data:image/') ? (
                      <img
                        src={msg.attachmentDataUrl}
                        alt={msg.attachmentName}
                        className="max-h-44 rounded-xl object-contain mb-1.5"
                      />
                    ) : null}
                    <div className="flex items-center gap-1.5 text-xs font-mono text-sky-300 truncate">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate">{msg.attachmentName}</span>
                    </div>
                  </div>
                )}

                {/* Larger, Clear Typography (16px) */}
                <div className="whitespace-pre-wrap text-[15px] sm:text-[16px] leading-relaxed font-normal">
                  {msg.text}
                </div>

                {msg.generatedImageUrl && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-sky-500/40 bg-slate-950">
                    <img
                      src={msg.generatedImageUrl}
                      alt="Generated by EduSense"
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* Action Toolbar under Assistant Messages: Listen (TTS), Copy, Pin */}
                {msg.role === 'assistant' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSpeakMessage(msg)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        speakingMsgId === msg.id
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Listen to response"
                    >
                      {speakingMsgId === msg.id ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePinMessage(msg.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        msg.pinned
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Pin response"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{msg.pinned ? 'Pinned' : 'Pin'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2.5 text-sm text-sky-400 font-semibold px-2 py-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>EduSense is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Attached File Preview Chip */}
      {attachmentName && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-slate-200">
          <div className="flex items-center gap-2 truncate">
            {attachmentDataUrl.startsWith('data:image/') ? (
              <img
                src={attachmentDataUrl}
                alt="Preview"
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
            ) : (
              <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span className="font-bold truncate">{attachmentName}</span>
          </div>
          <button
            type="button"
            onClick={clearAttachment}
            className="p-1 rounded-full hover:bg-slate-700 text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Prompt Bar with Attach, Create Image, and Send */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(undefined, 'tutor');
        }}
        className="p-3 bg-[#131926] border-t border-slate-800/90 flex items-center gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.csv,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          title="Attach Image or File"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            const imgTopic = prompt.trim() || 'Modern Computer Architecture Diagram';
            setPrompt('');
            handleSend(imgTopic, 'image');
          }}
          disabled={loading}
          className="px-3 h-10 rounded-full bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          title="Create Image"
        >
          <Wand2 className="w-3.5 h-3.5 text-purple-300" />
          <span className="hidden sm:inline">Create Image</span>
        </button>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask EduSense anything..."
          className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-full px-4 py-2.5 text-[15px] text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
        />

        <button
          type="submit"
          disabled={loading || (!prompt.trim() && !attachmentDataUrl)}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white flex items-center justify-center shadow transition-all cursor-pointer shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
