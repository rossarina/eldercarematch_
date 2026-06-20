import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../AuthContext";
import { getChatMessages, sendChatMessage, sendChatImage, getChatRooms, completeHire, requestCompleteHire, submitFeedback, getPayment } from "../api";
import AlertIcon from "../icon/alert.png";
import iconArrow from "../icon/arrow.png";
import Payment from "./Payment";

export default function Chat({ roomId, onBack, promptpayConfig }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(roomId || null);
  const [messages, setMessages] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [myUserId, setMyUserId] = useState(null);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [requestingCompletion, setRequestingCompletion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewService, setReviewService] = useState(0);
  const [reviewPunctuality, setReviewPunctuality] = useState(0);
  const [reviewCommunication, setReviewCommunication] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // โหลดรายการห้องแชท
  const loadRooms = useCallback(async () => {
    try {
      const data = await getChatRooms();
      setRooms(data.rooms || []);
    } catch (err) {
      console.warn(err.message);
    }
  }, []);

  // โหลดข้อความในห้องปัจจุบัน
  const loadMessages = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const data = await getChatMessages(activeRoomId);
      setMessages(data.messages || []);
      setRoomInfo((prevRoomInfo) => {
        const room = data.room;
        if (
          prevRoomInfo &&
          prevRoomInfo.is_active &&
          !room?.is_active &&
          room?.status === "completed" &&
          !room?.feedback_submitted
        ) {
          const amIElder = room.elder_user_id
            ? String(room.elder_user_id) === String(data.my_user_id)
            : false;
          if (amIElder) {
            setReviewService(0);
            setReviewPunctuality(0);
            setReviewCommunication(0);
            setReviewComment("");
            setShowReviewModal(true);
          }
        }
        return room;
      });
      setMyUserId(data.my_user_id);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeRoomId]);

  // โหลดสถานะการชำระเงิน
  useEffect(() => {
    if (!roomInfo?.hire_request_id) return;
    getPayment(roomInfo.hire_request_id)
      .then((data) => setPaymentInfo(data.payment || null))
      .catch(() => {});
  }, [roomInfo?.hire_request_id]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!activeRoomId) return;
    setLoading(true);
    loadMessages();
    const timer = setInterval(loadMessages, 5000); // poll ทุก 5 วินาที
    return () => clearInterval(timer);
  }, [loadMessages, activeRoomId]);

  // Scroll ไปล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || sending || !activeRoomId) return;
    if (!roomInfo?.is_active) return;
    const text = inputText.trim();
    setInputText("");
    const img = selectedImage;
    setSelectedImage(null);
    setImagePreview(null);
    setSending(true);
    try {
      if (img) {
        await sendChatImage(activeRoomId, img, text);
      } else {
        await sendChatMessage(activeRoomId, text);
      }
      await loadMessages();
    } catch (err) {
      setError(err.message);
      setInputText(text);
      if (img) {
        setSelectedImage(img);
        setImagePreview(URL.createObjectURL(img));
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleComplete = async () => {
    if (!roomInfo?.hire_request_id) return;
    
    if (user?.user_type === "elder") {
      if (!paymentInfo) {
        setShowConfirmModal(false);
        setShowPayment(true);
        setToast("ยังไม่มีการชำระเงิน กรุณาชำระก่อนส่งคำขอจบงาน");
        return;
      }
      setRequestingCompletion(true);
      setShowConfirmModal(false);
      try {
        await requestCompleteHire(roomInfo.hire_request_id);
        setToast("ส่งคำขอจบงานเรียบร้อย รอผู้ดูแลยืนยัน");
        await loadMessages();
      } catch (err) {
        setError(err.message);
      } finally {
        setRequestingCompletion(false);
      }
    } else {
      setCompleting(true);
      setShowConfirmModal(false);
      try {
        await completeHire(roomInfo.hire_request_id);
        setToast("จบงานเรียบร้อย ห้องแชทถูกปิด");
        await loadMessages();
      } catch (err) {
        setError(err.message);
      } finally {
        setCompleting(false);
      }
    }
  };

  const handleRequestCompletion = async () => {
    if (!roomInfo?.hire_request_id) return;
    if (!paymentInfo) {
      setShowPayment(true);
      setToast("ยังไม่มีการชำระเงิน กรุณาชำระก่อนยื่นคำขอจบงาน");
      return;
    }

    setRequestingCompletion(true);
    try {
      await requestCompleteHire(roomInfo.hire_request_id);
      setToast("ส่งคำขอจบงานเรียบร้อยแล้ว รอผู้ดูแลยืนยัน");
      await loadMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestingCompletion(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!roomInfo?.hire_request_id || !roomInfo?.caregiver_sheet_id) return;
    if (!reviewService || !reviewPunctuality || !reviewCommunication) {
      setError("กรุณาให้คะแนนให้ครบทั้ง 3 ด้าน (อย่างน้อย 1 ดาว)");
      return;
    }

    const avgRating = Math.round((reviewService + reviewPunctuality + reviewCommunication) / 3);

    setReviewSubmitting(true);
    setError("");
    try {
      await submitFeedback({
        caregiver_sheet_id: roomInfo.caregiver_sheet_id,
        hire_request_id: roomInfo.hire_request_id,
        rating: avgRating,
        service_quality: reviewService,
        punctuality: reviewPunctuality,
        communication: reviewCommunication,
        comment: reviewComment.trim(),
      });
      setShowReviewModal(false);
      setRoomInfo((prev) => prev ? { ...prev, feedback_submitted: true } : prev);
      setToast("ส่งรีวิวเรียบร้อยแล้ว ขอบคุณสำหรับการให้คะแนน");
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openReviewModal = () => {
    setReviewService(0);
    setReviewPunctuality(0);
    setReviewCommunication(0);
    setReviewComment("");
    setShowReviewModal(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getRoomStatusLabel = (room) => {
    if (!room?.is_active || room?.status === "completed") return "จบงานแล้ว";
    if (room?.status === "completion_requested") return "รอยืนยันจบงาน";
    if (room?.status === "accepted") return "กำลังดูแล";
    return "";
  };

  const otherName = roomInfo
    ? user?.user_type === "elder"
      ? roomInfo.caregiver_name
      : roomInfo.elder_name
    : "";
  // รูปโปรไฟล์ของอีกฝ่าย (backend ส่งมาใน roomInfo)
  const otherImage = roomInfo
    ? user?.user_type === "elder"
      ? (roomInfo.caregiver_profile_image || roomInfo.caregiver_avatar_url || null)
      : (roomInfo.elder_profile_image || roomInfo.elder_avatar_url || null)
    : null;
  const isElder = user?.user_type === "elder";
  const canReviewCaregiver = roomInfo && !roomInfo.is_active && isElder && roomInfo.status === 'completed' && !roomInfo.feedback_submitted && roomInfo.caregiver_sheet_id;

  const showSidebar = rooms.length > 1 && !isMobile;
  const showRoomList = isMobile && !activeRoomId;

  // ── Render Payment Overlay ──
  if (showPayment && roomInfo) {
    return (
      <Payment
        hireRequestId={roomInfo.hire_request_id}
        caregiverName={isElder ? otherName : user?.full_name}
        agreedWage={null}
        promptpayConfig={promptpayConfig}
        onBack={() => setShowPayment(false)}
        onPaid={(p) => {
          setPaymentInfo(p);
          setShowPayment(false);
          setToast("ชำระเงินสำเร็จ! เงินจะโอนให้ผู้ดูแลเมื่อจบงาน");
        }}
      />
    );
  }

  if (showRoomList) {
    return (
      <div className="chat-wrapper">
        <div className="chat-topbar">
          <button className="ecm-back" type="button" onClick={onBack}>
            <img src={iconArrow} alt="ย้อนกลับ" className="arrow-left" />
          </button>
          <div className="chat-topbar-info">
            <div className="chat-topbar-name">ห้องแชท</div>
            <div className="chat-topbar-sub">เลือกห้องแชทเพื่อเริ่มคุย</div>
          </div>
        </div>
        <div className="chat-rooms-list">
          {loading && rooms.length === 0 ? (
            <div className="chat-loading">⏳ กำลังโหลด...</div>
          ) : rooms.length === 0 ? (
            <div className="chat-empty">ยังไม่มีห้องแชท</div>
          ) : (
            rooms.map((room) => {
              const name = user?.user_type === "elder" ? room.caregiver_name : room.elder_name;
              const statusLabel = getRoomStatusLabel(room);
              return (
                <div
                  key={room.id}
                  className="chat-room-item"
                  onClick={() => setActiveRoomId(room.id)}
                >
                  <div className="chat-room-avatar">{name?.[0] || "?"}</div>
                  <div className="chat-room-meta">
                    <div className="chat-room-name">{name}</div>
                    <div className={`chat-room-status ${!room.is_active || room.status === "completed" ? "done" : ""}`}>
                      {statusLabel || `งาน #${room.hire_request_id}`}
                    </div>
                    {room.last_message && (
                      <div className="chat-room-last">{room.last_message}</div>
                    )}
                  </div>
                  {room.unread_count > 0 && (
                    <span className="chat-unread">{room.unread_count}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-wrapper">
      {/* Sidebar (ถ้ามีหลายห้อง) */}
      {showSidebar && (
        <div className="chat-sidebar">
          <div className="chat-sidebar-title">ห้องแชท</div>
          {rooms.map((room) => {
            const name = user?.user_type === "elder" ? room.caregiver_name : room.elder_name;
            const statusLabel = getRoomStatusLabel(room);
            return (
              <div
                key={room.id}
                className={`chat-room-item ${room.id === activeRoomId ? "active" : ""}`}
                onClick={() => setActiveRoomId(room.id)}
              >
                <div className="chat-room-avatar">{name?.[0] || "?"}</div>
                <div className="chat-room-meta">
                  <div className="chat-room-name">{name}</div>
                  <div className={`chat-room-status ${!room.is_active || room.status === "completed" ? "done" : ""}`}>
                    {statusLabel || `งาน #${room.hire_request_id}`}
                  </div>
                  {room.last_message && (
                    <div className="chat-room-last">{room.last_message}</div>
                  )}
                </div>
                {room.unread_count > 0 && (
                  <span className="chat-unread">{room.unread_count}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main chat area */}
      <div className="chat-main">
        {/* Top bar */}
        <div className="chat-topbar">
          <button className="ecm-back" type="button" onClick={onBack}>
            <img src={iconArrow} alt="ย้อนกลับ" className="arrow-left" />
          </button>
          <div className="chat-topbar-avatar">
            {otherImage
              ? <img src={otherImage} alt={otherName || "avatar"} />
              : (otherName?.[0] || "?")}
          </div>
          <div className="chat-topbar-info">
            <div className="chat-topbar-name">{otherName || "แชท"}</div>
            {roomInfo?.caregiver_sheet_id && (
              <div className="chat-topbar-sub">ID: {roomInfo.caregiver_sheet_id}</div>
            )}
          </div>
          <div className="chat-topbar-actions">
            {roomInfo && !roomInfo.is_active && (
              <span className="chat-closed-badge">จบงานแล้ว</span>
            )}
            {canReviewCaregiver && (
              <button
                className="chat-request-end-btn"
                type="button"
                onClick={openReviewModal}
              >
                ให้คะแนนผู้ดูแล
              </button>
            )}
            {roomInfo?.is_active && isElder && (
              <button
                className="chat-pay-btn"
                type="button"
                onClick={() => setShowPayment(true)}
                title="ชำระเงิน Escrow"
              >
                {paymentInfo ? (
                  ["held", "pending_confirm"].includes(paymentInfo.status) ? "ชำระแล้ว" : "โอนแล้ว"
                ) : "ชำระเงิน"}
              </button>
            )}
            {roomInfo?.is_active && isElder && (
              <button
                className="chat-end-btn"
                type="button"
                onClick={() => {
                  setShowConfirmModal(true);
                }}
                disabled={completing}
              >
                {completing ? "กำลังโหลด..." : "จบงาน"}
              </button>
            )}
            {roomInfo?.is_active && !isElder && (
              <button
                className="chat-end-btn"
                onClick={() => {
                  setShowConfirmModal(true);
                }}
                disabled={completing}
              >
                {completing ? "กำลังโหลด..." : "ยืนยันจบงาน"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="chat-error">{error}</div>}

        {/* Messages */}
        <div className="chat-messages">
          {loading && !messages.length ? (
            <div className="chat-loading">⏳ กำลังโหลด...</div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">ยังไม่มีข้อความ ส่งข้อความแรกเลย!</div>
          ) : (
            <>
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === myUserId;
                const showDate =
                  i === 0 ||
                  formatDate(msg.created_at) !== formatDate(messages[i - 1].created_at);
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="chat-date-divider">{formatDate(msg.created_at)}</div>
                    )}
                    <div className={`chat-bubble-row ${isMe ? "me" : "other"}`}>
                      {!isMe && (
                        <div className="chat-avatar-sm">
                          {otherImage
                            ? <img src={otherImage} alt={otherName || "avatar"} />
                            : (msg.sender_name?.[0] || "?")}
                        </div>
                      )}
                      <div className={`chat-bubble ${isMe ? "bubble-me" : "bubble-other"}`}>
                        {msg.image_url && (
                          <div className="chat-bubble-image">
                            <a href={msg.image_url} target="_blank" rel="noreferrer">
                              <img src={msg.image_url} alt="chat attachment" style={{ maxWidth: "200px", borderRadius: "8px", marginBottom: msg.message ? "8px" : "0", cursor: "pointer" }} />
                            </a>
                          </div>
                        )}
                        {msg.message && <div className="chat-bubble-text">{msg.message}</div>}
                        <div className="chat-bubble-time">{formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        {roomInfo && !roomInfo.is_active ? (
          <div className="chat-closed-notice">
            <span>✅ การแชทสิ้นสุดแล้ว (งานเสร็จสิ้น)</span>
            {canReviewCaregiver && (
              <button className="chat-review-closed-btn" type="button" onClick={openReviewModal}>
                ให้คะแนนผู้ดูแล
              </button>
            )}
          </div>
        ) : (
          <div className="chat-input-container" style={{ flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--card-bg)" }}>
            {imagePreview && (
              <div className="chat-image-preview" style={{ padding: "12px 20px", background: "rgba(142, 115, 91, 0.05)", borderTop: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "12px" }}>
                <img src={imagePreview} alt="preview" style={{ height: "60px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border-color)" }} />
                <button type="button" onClick={() => { setSelectedImage(null); setImagePreview(null); }} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>✖ ยกเลิกรูป</button>
              </div>
            )}
            <form className="chat-input-bar" onSubmit={handleSend} style={{ borderTop: imagePreview ? "none" : undefined, paddingTop: imagePreview ? "8px" : undefined }}>
              <label className="chat-image-btn" style={{ cursor: "pointer", width: "48px", height: "48px", flexShrink: 0, marginRight: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-sub)", borderRadius: "50%" }} title="แนบรูปภาพ">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <input type="file" accept="image/*" hidden onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setSelectedImage(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                  e.target.value = null;
                }} disabled={sending || !activeRoomId} />
              </label>
              <textarea
                ref={inputRef}
                className="chat-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์ข้อความ... (Enter ส่ง)"
                rows={1}
                disabled={sending || !activeRoomId}
              />
              <button
                className="chat-send-btn"
                type="submit"
                disabled={(!inputText.trim() && !selectedImage) || sending || !activeRoomId}
              >
                {sending ? "⏳" : "➤"}
              </button>
            </form>
          </div>
        )}
        {toast && <div className="chat-toast">{toast}</div>}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="chat-modal-overlay">
            <div className="chat-modal-card">
              <img src={AlertIcon} alt="Alert" className="chat-modal-icon" />
              <h3>{user?.user_type === "elder" ? "ยืนยันการส่งคำขอจบงาน?" : "ยืนยันการจบงาน?"}</h3>
              <p>คุณแน่ใจหรือไม่ว่าต้องการจบงานนี้?<br/><span>หลังจากนี้จะไม่สามารถแชทกันได้อีก</span></p>
              <div className="chat-modal-actions">
                <button className="btn-cancel" onClick={() => setShowConfirmModal(false)}>
                  ยกเลิก
                </button>
                <button className="btn-confirm" onClick={handleComplete}>
                  {user?.user_type === "elder" ? "ส่งคำขอ" : "ยืนยันจบงาน"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showReviewModal && isElder && (
          <div className="chat-modal-overlay">
            <div className="chat-modal-card chat-review-card">
              <div className="chat-modal-icon">★</div>
              <h3>รีวิวการดูแล</h3>
              <p>
                คุณได้รับการดูแลจาก <strong>{otherName || roomInfo?.caregiver_sheet_id}</strong> เป็นอย่างไรบ้าง
                <br />
                <span>ให้คะแนนเป็นดาวและเขียนคอมเมนต์ได้เลย</span>
              </p>
              <div className="chat-review-stars-group">
                <div className="chat-review-row">
                  <span>บริการ:</span>
                  <div className="chat-review-stars" role="radiogroup">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" className={`chat-star-btn ${star <= reviewService ? "active" : ""}`} onClick={() => setReviewService(star)}>★</button>
                    ))}
                  </div>
                </div>
                <div className="chat-review-row">
                  <span>ตรงเวลา:</span>
                  <div className="chat-review-stars" role="radiogroup">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" className={`chat-star-btn ${star <= reviewPunctuality ? "active" : ""}`} onClick={() => setReviewPunctuality(star)}>★</button>
                    ))}
                  </div>
                </div>
                <div className="chat-review-row">
                  <span>สื่อสาร:</span>
                  <div className="chat-review-stars" role="radiogroup">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" className={`chat-star-btn ${star <= reviewCommunication ? "active" : ""}`} onClick={() => setReviewCommunication(star)}>★</button>
                    ))}
                  </div>
                </div>
              </div>
              <textarea
                className="chat-review-textarea"
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="พิมพ์คอมเมนต์เกี่ยวกับการดูแล เช่น ดูแลดี ตรงเวลา สื่อสารดี"
              />
              <div className="chat-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowReviewModal(false)}
                  disabled={reviewSubmitting}
                >
                  ข้ามก่อน
                </button>
                <button
                  type="button"
                  className="btn-confirm"
                  onClick={handleSubmitReview}
                  disabled={reviewSubmitting || !reviewService || !reviewPunctuality || !reviewCommunication}
                >
                  {reviewSubmitting ? "กำลังส่ง..." : "ส่งรีวิว"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
