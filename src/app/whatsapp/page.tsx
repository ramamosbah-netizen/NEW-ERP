// ============================================================
// JEET ERP — WhatsApp Chat Workspace
// Route: /whatsapp
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { 
  Search, 
  Send, 
  Settings, 
  User, 
  UserCheck, 
  FileText, 
  Bot, 
  X, 
  Check, 
  Link2,
  ExternalLink,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import './whatsapp.css';

// Component to handle signed URL resolution for secure private files
function SafeFilePreview({ storagePath, title, fileExt }: { storagePath: string, title: string, fileExt: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUrl() {
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600); // 1 hour token
        
        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (err) {
        console.error('Error signing document URL:', err);
      } finally {
        setLoading(false);
      }
    }
    getUrl();
  }, [storagePath]);

  if (loading) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generating secure link...</span>;
  }

  if (!signedUrl) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>Failed to load attachment</span>;
  }

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt.toLowerCase());

  if (isImage) {
    return (
      <div className="whatsapp-media-preview-container">
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <img src={signedUrl} alt={title} className="whatsapp-image-attach" />
        </a>
      </div>
    );
  }

  return (
    <div className="whatsapp-media-preview-container">
      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="whatsapp-doc-card">
        <FileText size={18} style={{ color: 'var(--primary)' }} />
        <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Secure PDF/Document ({fileExt.toUpperCase()})</span>
        </div>
        <ExternalLink size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </a>
    </div>
  );
}

export default function WhatsAppInbox() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [composerText, setComposerText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Link client modal states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [searchedClients, setSearchedClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientContracts, setClientContracts] = useState<any[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // Load custom hook
  const {
    chats,
    messages,
    loadingChats,
    loadingMessages,
    sendReply,
    updateStatus,
    linkClient
  } = useWhatsApp(selectedChatId);

  const messageAreaRef = useRef<HTMLDivElement>(null);

  // Resolve current active agent user session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  }, [messages, loadingMessages]);

  const activeChat = chats.find(c => c.id === selectedChatId);

  // Filter chats by search
  const filteredChats = chats.filter(c => {
    const term = searchQuery.toLowerCase();
    const phoneMatches = c.phone_number.toLowerCase().includes(term);
    const clientMatches = c.client?.name?.toLowerCase().includes(term);
    return phoneMatches || clientMatches;
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || !selectedChatId) return;

    const body = composerText;
    setComposerText('');
    await sendReply(body);
  };

  // Search clients for Link Modal
  useEffect(() => {
    if (!linkSearchQuery.trim()) {
      setSearchedClients([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      supabase
        .from('clients')
        .select('id, name, contact_phone')
        .ilike('name', `%${linkSearchQuery}%`)
        .limit(10)
        .then(({ data }) => setSearchedClients(data || []));
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [linkSearchQuery]);

  // Load contracts when client is selected in Link Modal
  useEffect(() => {
    if (!selectedClientId) {
      setClientContracts([]);
      return;
    }
    supabase
      .from('amc_contracts')
      .select('id, contract_number, site_name')
      .eq('client_id', selectedClientId)
      .eq('status', 'ACTIVE')
      .then(({ data }) => {
        setClientContracts(data || []);
        if (data && data.length > 0) {
          setSelectedContractId(data[0].id);
        } else {
          setSelectedContractId(null);
        }
      });
  }, [selectedClientId]);

  const handleLinkSubmit = async () => {
    if (!selectedChatId) return;
    await linkClient(selectedClientId, selectedContractId);
    setShowLinkModal(false);
    // Reset modal
    setSelectedClientId(null);
    setSelectedContractId(null);
    setLinkSearchQuery('');
  };

  return (
    <div className="whatsapp-container">
      {/* Sidebar Panel */}
      <aside className="whatsapp-sidebar">
        <div className="whatsapp-sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={20} style={{ color: 'var(--primary)' }} />
              WhatsApp Chats
            </h2>
            <Link href="/settings/whatsapp" className="logout-btn" style={{ padding: '0.4rem', borderRadius: '8px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }} title="WhatsApp settings">
              <Settings size={16} />
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="whatsapp-search-input" 
              placeholder="Search chat or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="whatsapp-chat-list">
          {loadingChats && chats.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner"></div></div>
          ) : filteredChats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No conversations found.</div>
          ) : (
            filteredChats.map((c) => {
              const lastMsgText = c.status === 'CLOSED' ? 'Session closed.' : 'Awaiting response...';
              return (
                <div 
                  key={c.id} 
                  className={`whatsapp-chat-card ${c.id === selectedChatId ? 'active' : ''}`}
                  onClick={() => setSelectedChatId(c.id)}
                >
                  <div className="whatsapp-chat-card-header">
                    <span className="whatsapp-chat-name">
                      {c.client?.name || `+${c.phone_number}`}
                    </span>
                    <span className="whatsapp-chat-time">
                      {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {c.client ? `+${c.phone_number}` : 'Unlinked phone'}
                    </span>
                    <span className={`whatsapp-status-badge ${
                      c.status === 'AUTO_REPLY' ? 'status-auto' : c.status === 'HUMAN_AGENT' ? 'status-agent' : 'status-closed'
                    }`}>
                      {c.status === 'AUTO_REPLY' ? 'AI Bot' : c.status === 'HUMAN_AGENT' ? 'Agent' : 'Closed'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <section className="whatsapp-chatpane">
        {activeChat ? (
          <>
            {/* Header Area */}
            <header className="whatsapp-pane-header">
              <div className="whatsapp-pane-header-info">
                <div className="whatsapp-recipient-title">
                  {activeChat.client?.name || `+${activeChat.phone_number}`}
                </div>
                <div className="whatsapp-recipient-subtitle">
                  {activeChat.contract ? (
                    <span>Contract: <strong style={{ color: 'var(--primary)' }}>{activeChat.contract.contract_number}</strong> ({activeChat.contract.site_name})</span>
                  ) : (
                    <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertCircle size={12} />
                      Unlinked number. Auto-ticketing is disabled.
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button 
                  className="logout-btn"
                  style={{ padding: '0.45rem 0.8rem', background: 'var(--surface-hover)', borderColor: 'var(--border-color)', color: '#fff' }}
                  onClick={() => setShowLinkModal(true)}
                >
                  <Link2 size={14} /> Link Client
                </button>

                {activeChat.status !== 'HUMAN_AGENT' ? (
                  <button 
                    className="quote-btn quote-btn-secondary"
                    style={{ padding: '0.45rem 0.8rem', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.3)', background: 'rgba(168, 85, 247, 0.06)' }}
                    onClick={() => updateStatus('HUMAN_AGENT', currentUserId)}
                  >
                    <UserCheck size={14} /> Take Over (Human)
                  </button>
                ) : (
                  <button 
                    className="quote-btn quote-btn-primary"
                    style={{ padding: '0.45rem 0.8rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}
                    onClick={() => updateStatus('AUTO_REPLY', null)}
                  >
                    <Bot size={14} /> Return to AI Bot
                  </button>
                )}

                {activeChat.status !== 'CLOSED' && (
                  <button 
                    className="logout-btn"
                    style={{ padding: '0.45rem 0.8rem' }}
                    onClick={() => updateStatus('CLOSED', null)}
                  >
                    <Check size={14} /> Close Session
                  </button>
                )}
              </div>
            </header>

            {/* Conversation Messages Thread */}
            <div className="whatsapp-message-area" ref={messageAreaRef}>
              {loadingMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', margin: 'auto' }}><div className="spinner"></div></div>
              ) : messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MessageSquare size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.1 }} />
                  <p>Send a message to begin the conversation log.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isSystemMsg = msg.direction === 'OUTBOUND' && msg.sender_name?.includes('System');
                  const isBotMsg = msg.direction === 'OUTBOUND' && msg.sender_name?.includes('AI');
                  
                  if (isSystemMsg) {
                    return (
                      <div key={msg.id || index} className="whatsapp-system-log">
                        <div className="whatsapp-system-log-inner">
                          ⚙️ {msg.message_body}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={msg.id || index} 
                      className={`whatsapp-message-bubble-wrapper ${msg.direction.toLowerCase()}`}
                    >
                      <div className="whatsapp-message-meta-header">
                        {msg.direction === 'INBOUND' ? msg.sender_name : (isBotMsg ? '🤖 JEET ERP AI' : `👤 Agent`)}
                      </div>
                      <div className="whatsapp-message-bubble">
                        {msg.message_body && <p style={{ margin: 0 }}>{msg.message_body}</p>}
                        
                        {/* Secure polymorphic files renderer */}
                        {msg.document && (
                          <SafeFilePreview 
                            storagePath={msg.document.storage_path} 
                            title={msg.document.title} 
                            fileExt={msg.document.file_ext} 
                          />
                        )}

                        <span className="whatsapp-bubble-time">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Input Composer */}
            <form className="whatsapp-composer" onSubmit={handleSend}>
              <input 
                type="text" 
                className="whatsapp-composer-input"
                placeholder={activeChat.status === 'CLOSED' ? "Session is closed. Type a message to reopen under Human Agent mode..." : "Type your message..."}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
              />
              <button 
                type="submit" 
                className="quote-btn quote-btn-primary"
                style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', display: 'flex', gap: '0.4rem', alignItems: 'center' }}
                disabled={!composerText.trim()}
              >
                Send <Send size={14} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={48} style={{ margin: '0 auto 1.5rem auto', opacity: 0.15, color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Select a Conversation</h3>
            <p style={{ fontSize: '0.85rem' }}>Select a chat session from the sidebar panel to view live messages and control intent dispatching.</p>
          </div>
        )}
      </section>

      {/* Linking Client Modal */}
      {showLinkModal && (
        <div className="whatsapp-modal-backdrop" onClick={() => setShowLinkModal(false)}>
          <div className="whatsapp-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link2 size={18} style={{ color: 'var(--primary)' }} />
                Link Phone to Client Account
              </h3>
              <button onClick={() => setShowLinkModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Search Client Account</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="whatsapp-search-input"
                    style={{ paddingLeft: '2.2rem' }}
                    placeholder="Type client name..."
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Searched Clients Result List */}
              {searchedClients.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                  {searchedClients.map(cli => (
                    <div 
                      key={cli.id} 
                      style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--surface-hover)', background: selectedClientId === cli.id ? 'rgba(0, 229, 160, 0.08)' : 'transparent', color: selectedClientId === cli.id ? 'var(--primary)' : '#fff', fontSize: '0.82rem' }}
                      onClick={() => {
                        setSelectedClientId(cli.id);
                        setSelectedContractId(null);
                      }}
                    >
                      {cli.name} <span style={{ float: 'right', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cli.contact_phone}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Contracts selection */}
              {selectedClientId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Select Active AMC Contract</label>
                  {clientContracts.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)', padding: '0.5rem', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', background: 'rgba(245,158,11,0.02)' }}>
                      No active AMC contracts found for this client. Auto-ticketing will remain deactivated.
                    </div>
                  ) : (
                    <select 
                      style={{ width: '100%', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem' }}
                      value={selectedContractId || ''}
                      onChange={(e) => setSelectedContractId(e.target.value)}
                    >
                      {clientContracts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.contract_number} ({c.site_name})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'rgba(0,0,0,0.15)' }}>
              <button 
                className="logout-btn" 
                style={{ padding: '0.45rem 0.9rem', background: 'none' }}
                onClick={() => setShowLinkModal(false)}
              >
                Cancel
              </button>
              <button 
                className="quote-btn quote-btn-primary" 
                style={{ padding: '0.45rem 1.1rem' }}
                disabled={!selectedClientId}
                onClick={handleLinkSubmit}
              >
                Link Client Phone
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
