import { useState, useEffect, useRef } from 'react';
import { apiFetch, getUser } from '../utils/api';

export default function EventChat({ eventId, eventTitle }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const user = getUser();

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const data = await apiFetch(`/messages/${eventId}`);
      setMessages(data);
    } catch (err) { console.error(err); }
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/messages/${eventId}`, {
        method: 'POST',
        body: JSON.stringify({ message: newMsg.trim() }),
      });
      setNewMsg('');
      await loadMessages();
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const formatTime = (t) => new Date(t).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="event-chat">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Start the conversation!</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id;
          const isAdmin = msg.users?.role === 'admin';
          return (
            <div key={msg.id} className={`chat-bubble ${isMe ? 'me' : 'other'} ${isAdmin ? 'admin' : ''}`}>
              <div className="chat-bubble-header">
                <span className="chat-sender">
                  {isAdmin ? '🛡️ ' : ''}{msg.users?.name || 'User'}
                  {isAdmin && <span className="chat-admin-tag">Admin</span>}
                </span>
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
          placeholder="Type a message..."
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
