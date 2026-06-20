import { useState, useEffect, useRef } from "react";
import { getMySupportChat, sendSupportMessage } from "../api";
import { useAuth } from "../AuthContext";

export default function SupportChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // If not logged in, or if it's admin (admin has their own dashboard), hide the widget
  if (!user || user.user_type === "admin") {
    return null;
  }

  // Detect responsive breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadChat(true);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Background polling checking for unread support messages when closed
  useEffect(() => {
    if (!user || user.user_type === "admin") return;

    const checkUnread = async () => {
      if (isOpen) return;
      try {
        const d = await getMySupportChat(false);
        if (d.ok && d.room) {
          setUnreadCount(d.room.unread_count || 0);
        }
      } catch (err) {
        console.error("Failed to check support chat unread status:", err);
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [user, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const notifySupportUpdate = () => {
    window.dispatchEvent(new Event("support-notifications-updated"));
  };

  const loadChat = async (markRead = false) => {
    setLoading(true);
    try {
      const d = await getMySupportChat(markRead);
      if (d.ok) {
        setRoom(d.room);
        setMessages(d.messages);
        if (markRead) {
          setUnreadCount(0);
          notifySupportUpdate();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const textToSend = inputText;
    setInputText("");
    
    // Optimistic UI update
    const tempMsg = {
      id: "temp-" + Date.now(),
      message: textToSend,
      is_admin_sender: false,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const d = await sendSupportMessage(textToSend);
      if (d.ok) {
        loadChat(true);
        notifySupportUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  // ── Chat Content (shared between mobile/desktop) ──
  const chatContent = (
    <>
      {/* Header */}
      <div className="support-chat-header">
        {isMobile && (
          <button className="support-back-btn" onClick={() => setIsOpen(false)} aria-label="ย้อนกลับ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div className="support-chat-header-info">
          <div className="support-chat-header-avatar">🛡️</div>
          <div>
            <div className="support-chat-header-name">ทีมแอดมิน</div>
            <div className="support-chat-header-sub">ElderCareMatch Support</div>
          </div>
        </div>
        {!isMobile && (
          <button className="support-close-btn" onClick={() => setIsOpen(false)}>✕</button>
        )}
      </div>

      {/* Messages */}
      <div className="support-chat-body">
        {loading && messages.length === 0 ? (
          <div className="support-loading">กำลังโหลด...</div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="support-empty">
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>👋</div>
                <div>สวัสดีครับ/ค่ะ! มีอะไรให้ช่วยไหม?</div>
                <div style={{ fontSize: "13px", marginTop: "4px", opacity: 0.7 }}>ส่งข้อความหาแอดมินได้เลยครับ</div>
              </div>
            )}
            {messages.map((m, i) => {
              const showDate =
                i === 0 ||
                formatDate(m.created_at) !== formatDate(messages[i - 1].created_at);
              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="support-date-divider">{formatDate(m.created_at)}</div>
                  )}
                  <div className={`support-msg-row ${m.is_admin_sender ? "admin" : "user"}`}>
                    {m.is_admin_sender && (
                      <div className="support-msg-avatar">🛡️</div>
                    )}
                    <div className="support-msg-bubble">{m.message}</div>
                    <div className="support-msg-time">{formatTime(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form className="support-chat-input" onSubmit={handleSend}>
        <input
          ref={inputRef}
          type="text"
          placeholder="พิมพ์ข้อความ..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" disabled={!inputText.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </>
  );

  return (
    <div className="support-widget-container">
      {/* Mobile: Fullscreen overlay */}
      {isMobile && isOpen && (
        <div className="support-fullscreen">
          {chatContent}
        </div>
      )}

      {/* Desktop: Popup box */}
      {!isMobile && isOpen && (
        <div className="support-chat-box">
          {chatContent}
        </div>
      )}

      {/* Float button (always shown when closed) */}
      {!isOpen && (
        <button
          className="support-float-btn"
          onClick={() => setIsOpen(true)}
        >
          💬 แจ้งปัญหา/ติดต่อแอดมิน
          {unreadCount > 0 && (
            <span className="support-float-badge">{unreadCount}</span>
          )}
        </button>
      )}
    </div>
  );
}
