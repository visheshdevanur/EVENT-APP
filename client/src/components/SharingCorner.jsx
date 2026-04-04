import { useState, useEffect, useRef } from 'react';
import { apiFetch, API_BASE, getUser } from '../utils/api';

export default function SharingCorner() {
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const fileInputRef = useRef(null);
  const user = getUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      const data = await apiFetch('/sharing');
      setPosts(data);
    } catch (err) {
      console.error('Failed to load sharing posts:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    // Generate preview
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setMediaPreview({ url, type });
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;
    setPosting(true);
    try {
      const formData = new FormData();
      if (content.trim()) formData.append('content', content.trim());
      if (mediaFile) formData.append('media', mediaFile);

      const res = await fetch(`${API_BASE}/sharing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw data;

      setPosts((prev) => [data, ...prev]);
      setContent('');
      clearMedia();
    } catch (err) {
      alert(err.error || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm('Delete this post?')) return;
    try {
      await apiFetch(`/sharing/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(err.error || 'Failed to delete post');
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const filteredPosts = posts.filter((post) => {
    const q = searchQuery.toLowerCase();
    return (
      (post.content || '').toLowerCase().includes(q) ||
      (post.user_name || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="sharing-corner">
        <div className="loading-center"><div className="spinner"></div></div>
      </div>
    );
  }

  return (
    <div className="sharing-corner">
      <div className="sharing-header">
        <div className="sharing-header-icon">📸</div>
        <div>
          <h4 className="sharing-title">Global Sharing Feed</h4>
          <p className="sharing-subtitle">See what everyone is up to and share your moments!</p>
        </div>
      </div>

      {/* ─── Create Post Form ─── */}
      <form className="sharing-create-form" onSubmit={handleSubmit}>
        <div className="sharing-create-top">
          <div className="sharing-avatar sharing-avatar-sm">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <textarea
            className="sharing-textarea"
            placeholder="Share your thoughts or an update with everyone..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
          />
        </div>

        {/* Media Preview */}
        {mediaPreview && (
          <div className="sharing-media-preview">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.url} alt="Preview" />
            ) : (
              <video src={mediaPreview.url} controls />
            )}
            <button type="button" className="sharing-preview-remove" onClick={clearMedia}>✕</button>
          </div>
        )}

        <div className="sharing-create-actions">
          <div className="sharing-create-btns">
            <button type="button" className="sharing-attach-btn" onClick={() => fileInputRef.current?.click()}>
              🖼️ Photo/Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={handleMediaChange}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={posting || (!content.trim() && !mediaFile)}>
            {posting ? 'Posting...' : '🚀 Post'}
          </button>
        </div>
      </form>

      {/* ─── Search Bar ─── */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="form-control search-input"
          style={{ width: '100%' }}
          placeholder="🔍 Search posts by content or author..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ─── Feed ─── */}
      <div className="sharing-feed">
        {filteredPosts.length === 0 ? (
          <div className="sharing-empty">
            <div className="sharing-empty-icon">📷</div>
            <p>{searchQuery ? 'No posts match your search.' : 'No posts yet. Be the first to share!'}</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="sharing-post">
              <div className="sharing-post-header">
                <div 
                  className="sharing-avatar sharing-avatar-sm" 
                  onClick={() => setSelectedUser(post)}
                  style={{ cursor: 'pointer' }}
                  title="View Profile"
                >
                  {post.user_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="sharing-post-user-info">
                  <span 
                    className="sharing-post-name"
                    onClick={() => setSelectedUser(post)}
                    style={{ cursor: 'pointer' }}
                    title="View Profile"
                  >
                    {post.user_name}
                    {post.user_role === 'admin' && <span className="sharing-admin-tag">Admin</span>}
                    {post.user_role === 'superadmin' && <span className="sharing-admin-tag superadmin">Super</span>}
                  </span>
                  <span className="sharing-post-time">{timeAgo(post.created_at)}</span>
                </div>
                {(post.user_id === user?.id || isAdmin) && (
                  <button className="sharing-delete-btn" onClick={() => handleDelete(post.id)} title="Delete post">
                    🗑
                  </button>
                )}
              </div>

              {post.content && <p className="sharing-post-content">{post.content}</p>}

              {post.media_url && post.media_type === 'image' && (
                <div className="sharing-post-media">
                  <img src={post.media_url} alt="Post media" loading="lazy" />
                </div>
              )}

              {post.media_url && post.media_type === 'video' && (
                <div className="sharing-post-media">
                  <video src={post.media_url} controls preload="metadata" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ─── User Profile Modal ─── */}
      {selectedUser && (
        <div className="qr-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="qr-modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center' }}>
            <button className="qr-modal-close" onClick={() => setSelectedUser(null)}>✕</button>
            <div className="sharing-avatar" style={{ width: 64, height: 64, fontSize: '1.5rem', margin: '0 auto 16px' }}>
              {selectedUser.user_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <h3 style={{ marginBottom: 4 }}>{selectedUser.user_name}</h3>
            <div style={{ marginBottom: 16 }}>
              <span className={`status-badge ${selectedUser.user_role === 'admin' || selectedUser.user_role === 'superadmin' ? 'status-ongoing' : 'status-open'}`}>
                {selectedUser.user_role}
              </span>
            </div>
            
            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>🎓 USN / ID:</strong> <code style={{color: 'var(--text-primary)'}}>{selectedUser.user_student_id || 'N/A'}</code>
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>✉️ Email:</strong> <span style={{color: 'var(--text-primary)'}}>{selectedUser.user_email || 'N/A'}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
