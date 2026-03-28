import { useState, useEffect, useRef } from 'react';
import { apiFetch, getUser } from '../utils/api';

export default function TeamChat({ teamId, teamName }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const user = getUser();

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const data = await apiFetch(`/messages/team/${teamId}`);
      setMessages(data);
      setError(null);
    } catch (err) {
      console.error('Team chat error:', err);
      setError(err.error || 'Failed to load team messages');
    }
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/messages/team/${teamId}`, {
        method: 'POST',
        body: JSON.stringify({ message: newMsg.trim() }),
      });
      setNewMsg('');
      setError(null);
      await loadMessages();
    } catch (err) {
      console.error('Send team message error:', err);
      alert(err.error || 'Failed to send message');
    }
    finally { setSending(false); }
  };

  const formatTime = (t) => new Date(t).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="event-chat">
      <div className="chat-header-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        🔒 Private team chat — only {teamName} members can see this
      </div>
      <div className="chat-messages">
        {error && (
          <div style={{ padding: 12, color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}
        {messages.length === 0 && !error && (
          <div className="chat-empty">No team messages yet. Say hello to your teammates!</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id;
          return (
            <div key={msg.id} className={`chat-bubble ${isMe ? 'me' : 'other'}`}>
              <div className="chat-bubble-header">
                <span className="chat-sender">{msg.users?.name || 'Member'}</span>
                <span className="chat-time">{formatTime(msg.created_at)}</span>
              </div>
              <div className="chat-text">{msg.message}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="chat-input-bar">
        <input
          className="form-control"
          placeholder="Message your team..."
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !newMsg.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
