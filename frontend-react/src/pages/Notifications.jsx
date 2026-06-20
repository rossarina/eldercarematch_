import { useState, useEffect, useCallback, Fragment, useRef } from "react";
import { useAuth } from "../AuthContext";
import { getNotifications, respondHire, getChatRooms, markNotificationsRead, submitFeedback } from "../api";
import iconArrow from "../icon/arrow.png";
import iconBell from "../icon/bell.png";
import iconForm from "../icon/form.png";
import StatusIcon from "../icon/form.png";
import PeopleIcon from "../icon/people.png";

const VIEWED_SYSTEM_NOTIFICATION_IDS_KEY = "notificationsViewedSystemIds";

function readViewedSystemNotificationIds() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(VIEWED_SYSTEM_NOTIFICATION_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id)));
  } catch {
    return new Set();
  }
}

function storeViewedSystemNotificationIds(ids) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      VIEWED_SYSTEM_NOTIFICATION_IDS_KEY,
      JSON.stringify(Array.from(ids))
    );
  } catch {
    // Ignore storage failures.
  }
}

export default function Notifications({ onBack, onOpenChat }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [chatUnreadByRoom, setChatUnreadByRoom] = useState({});
  const [chatRooms, setChatRooms] = useState([]);
  const [activeTab, setActiveTab] = useState("latest");

  // Review states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewService, setReviewService] = useState(0);
  const [reviewPunctuality, setReviewPunctuality] = useState(0);
  const [reviewCommunication, setReviewCommunication] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { hire_request_id, caregiver_sheet_id, caregiver_name }
  const isCaregiver = user?.user_type === "caregiver";
  const prevNotificationsRef = useRef([]);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Auto-show review modal when a job status transitions to completed
  useEffect(() => {
    if (isCaregiver || !notifications.length) {
      if (notifications.length) {
        prevNotificationsRef.current = notifications;
      }
      return;
    }

    // Only check for transitions if we have a previous list of notifications to compare
    if (prevNotificationsRef.current.length > 0) {
      const newlyCompleted = notifications.find((n) => {
        if (n.is_system || n.status !== "completed" || n.feedback_submitted) return false;
        const prev = prevNotificationsRef.current.find((p) => p.id === n.id);
        // It transitioned to completed just now
        return prev && prev.status !== "completed";
      });

      if (newlyCompleted) {
        setReviewTarget({
          hire_request_id: newlyCompleted.id,
          caregiver_sheet_id: newlyCompleted.caregiver_sheet_id,
          caregiver_name: newlyCompleted.caregiver_name || newlyCompleted.caregiver_sheet_id,
        });
        setReviewService(0);
        setReviewPunctuality(0);
        setReviewCommunication(0);
        setReviewComment("");
        setShowReviewModal(true);
      }
    }

    prevNotificationsRef.current = notifications;
  }, [notifications, isCaregiver]);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChatUnread = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getChatRooms();
      const unreadMap = {};
      const rooms = data.rooms || [];
      rooms.forEach((room) => {
        if (room.unread_count > 0) {
          unreadMap[room.id] = room.unread_count;
        }
      });
      setChatUnreadByRoom(unreadMap);
      setChatRooms(rooms);
    } catch {
      // ignore chat badge failures
    }
  }, [user]);

  useEffect(() => {
    load();
    loadChatUnread();
    const timer = setInterval(() => {
      load();
      loadChatUnread();
    }, 10000); // poll ทุก 10 วินาที
    return () => {
      clearInterval(timer);
      const currentSystemNotificationIds = notificationsRef.current
        .filter((notif) => notif.is_system)
        .map((notif) => String(notif.db_id ?? notif.id));
      const nextViewedIds = readViewedSystemNotificationIds();
      currentSystemNotificationIds.forEach((id) => nextViewedIds.add(id));
      storeViewedSystemNotificationIds(nextViewedIds);
      markNotificationsRead()
        .then(() => window.dispatchEvent(new Event("app-notifications-updated")))
        .catch(() => {});
    };
  }, [load, loadChatUnread]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRespond = async (hireId, action) => {
    setActionLoading(`${hireId}-${action}`);
    try {
      const res = await respondHire(hireId, action);
      setToast(action === "accept" ? "รับงานสำเร็จ! ห้องแชทถูกสร้างแล้ว" : "ปฏิเสธงานแล้ว");
      if (action === "accept" && res.chat_room_id) {
        await load();
        onOpenChat?.(res.chat_room_id);
      } else {
        await load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget?.hire_request_id || !reviewTarget?.caregiver_sheet_id) return;
    if (!reviewService || !reviewPunctuality || !reviewCommunication) {
      setError("กรุณาให้คะแนนให้ครบทั้ง 3 ด้าน (อย่างน้อย 1 ดาว)");
      return;
    }

    const avgRating = Math.round((reviewService + reviewPunctuality + reviewCommunication) / 3);

    setReviewSubmitting(true);
    setError("");
    try {
      await submitFeedback({
        caregiver_sheet_id: reviewTarget.caregiver_sheet_id,
        hire_request_id: reviewTarget.hire_request_id,
        rating: avgRating,
        service_quality: reviewService,
        punctuality: reviewPunctuality,
        communication: reviewCommunication,
        comment: reviewComment.trim(),
      });
      setShowReviewModal(false);
      setToast("ส่งรีวิวเรียบร้อยแล้ว ขอบคุณสำหรับการให้คะแนน");
      // Update local notification item
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === reviewTarget.hire_request_id ? { ...n, feedback_submitted: true } : n
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: { label: "รอการตอบรับ", cls: "badge-pending" },
      accepted: { label: "รับงานแล้ว", cls: "badge-accepted" },
      rejected: { label: "ปฏิเสธแล้ว", cls: "badge-rejected" },
      completion_requested: { label: "ร้องขอจบงาน", cls: "badge-warn" },
      completed: { label: "งานเสร็จสิ้น", cls: "badge-completed" },
    };
    const s = map[status] || { label: status, cls: "" };
    return <span className={`notif-badge ${s.cls}`}>{s.label}</span>;
  };

  const activeJobsUnreadCount = chatRooms.reduce((sum, room) => sum + (chatUnreadByRoom[room.id] || 0), 0);

  const roomNotificationsByRoomId = notifications.reduce((map, notif) => {
    if (notif.chat_room_id) {
      map[notif.chat_room_id] = notif;
    }
    return map;
  }, {});

  const chatJobNotifications = chatRooms.filter(
    room => ["accepted", "completion_requested", "completed"].includes(room.status)
  );

  const viewedSystemNotificationIds = readViewedSystemNotificationIds();
  const latestSystemNotification = notifications.find((notif) => notif.is_system);
  const latestSystemNotificationKey = latestSystemNotification
    ? String(latestSystemNotification.db_id ?? latestSystemNotification.id)
    : null;

  const latestUnreadCount = notifications.filter(notif => {
    if (notif.is_system) {
      return !notif.is_read;
    } else {
      return user?.user_type === "caregiver" && notif.status === "pending" && !notif.is_superseded;
    }
  }).length;

  return (
    <div className="notif-container">
      {/* Header */}
      <div className="notif-header">
        <button className="ecm-back notif-back" type="button" onClick={onBack}>
          <img src={iconArrow} className="arrow-left" alt="" />ย้อนกลับ
        </button>
        <h1 className="notif-title">
          <img
            src={isCaregiver ? iconBell : iconForm}
            alt="icon"
            className="notif-title-icon"
          />
          การแจ้งเตือน
        </h1>
      </div>

      {/* Caregiver ID warning */}
      {isCaregiver && !user?.caregiver_id && (
        <div className="notif-warning">
          ⚠️ กรุณาระบุ <strong>รหัสผู้ดูแล (Caregiver ID)</strong> ในหน้าโปรไฟล์ก่อน
          เพื่อรับการแจ้งเตือนจากผู้สูงอายุ
        </div>
      )}

      {error && <div className="notif-error">{error}</div>}
      {toast && <div className="notif-toast">{toast}</div>}

      {loading ? (
        <div className="notif-loading">⏳ กำลังโหลด...</div>
      ) : notifications.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-icon">📭</div>
          <div className="notif-empty-text">
            {isCaregiver ? "ยังไม่มีคำขอจ้างงาน" : "ยังไม่ได้ส่งคำขอจ้างงาน"}
          </div>
        </div>
      ) : (
        <div className="notif-wrapper">
          <div className="notif-tabs">
            <button
              className={`notif-tab ${activeTab === "latest" ? "active" : ""}`}
              onClick={() => setActiveTab("latest")}
            >
              การแจ้งเตือนล่าสุด
              {latestUnreadCount > 0 && (
                <span className="notif-tab-badge">{latestUnreadCount}</span>
              )}
            </button>
            <button
              className={`notif-tab ${activeTab === "active_jobs" ? "active" : ""}`}
              onClick={() => setActiveTab("active_jobs")}
            >
              งานที่กำลังดำเนินการ
              {activeJobsUnreadCount > 0 && (
                <span className="notif-tab-badge">{activeJobsUnreadCount}</span>
              )}
            </button>
          </div>

          {activeTab === "active_jobs" && (
            chatJobNotifications.length > 0 ? (
              <div className="notif-active-chats" style={{ marginBottom: "24px" }}>
                {chatJobNotifications.map((room) => {
                  const roomNotif = roomNotificationsByRoomId[room.id] || {};
                  const isCompletedRoom = room.status === "completed";
                  const isReviewedRoom = !!roomNotif.feedback_submitted;
                  const showCompletionStripe = isCompletedRoom && !isReviewedRoom;
                  return (
                    <div
                      key={`chat-${room.id}`}
                      className="notif-card"
                      style={{
                        background: isCompletedRoom
                          ? isReviewedRoom
                            ? "var(--card-bg)"
                            : "#f8fafc"
                          : "#f0f9ff",
                        ...(showCompletionStripe
                          ? { borderLeft: "4px solid #64748b" }
                          : !isCompletedRoom
                            ? { borderLeft: "4px solid #3b82f6" }
                            : {}),
                        marginBottom: "12px"
                      }}
                    >
                      <div className="notif-card-top">
                        <div className="notif-card-info">
                          <div className="notif-who">
                            <img src={PeopleIcon} alt="คน" className="notif-who-icon" />
                            {isCaregiver ? (
                              <span>งานปัจจุบัน: <strong>{room.elder_name}</strong></span>
                            ) : (
                              <span>งานปัจจุบัน: ผู้ดูแล <strong>{room.caregiver_name || roomNotif.caregiver_sheet_id || room.caregiver_sheet_id}</strong></span>
                            )}
                          </div>
                        </div>
                        {statusBadge(room.status)}
                      </div>
                      <div className="notif-actions" style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <button
                          className="notif-btn notif-btn--chat"
                          onClick={() => onOpenChat?.(room.id)}
                        >
                          เปิดห้องแชท
                          {chatUnreadByRoom[room.id] > 0 && (
                            <span className="notif-dot notif-dot--chat">
                              {chatUnreadByRoom[room.id]}
                            </span>
                          )}
                        </button>
                        {!isCaregiver && room.status === "completed" && !roomNotif.feedback_submitted && (
                          <button
                            className="notif-btn notif-btn--review"
                            onClick={() => {
                              setReviewTarget({
                                hire_request_id: roomNotif.id || room.hire_request_id,
                                caregiver_sheet_id: roomNotif.caregiver_sheet_id || room.caregiver_sheet_id,
                                caregiver_name: room.caregiver_name || roomNotif.caregiver_name || room.caregiver_sheet_id
                              });
                              setReviewService(0);
                              setReviewPunctuality(0);
                              setReviewCommunication(0);
                              setReviewComment("");
                              setShowReviewModal(true);
                            }}
                          >
                            ★ ให้คะแนนผู้ดูแล
                          </button>
                        )}
                        {!isCaregiver && room.status === "completed" && roomNotif.feedback_submitted && (
                          <span style={{ color: "#10b981", fontWeight: "600", alignSelf: "center", fontSize: "0.9rem", marginLeft: "8px" }}>
                            ✓ ให้คะแนนแล้ว
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="notif-empty" style={{ padding: "60px 0", textAlign: "center", color: "#64748b", background: "var(--card-bg)", borderRadius: "18px", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "40px", marginBottom: "16px" }}>💬</div>
                <div>ยังไม่มีงานที่กำลังดำเนินการในขณะนี้</div>
              </div>
            )
          )}

          {activeTab === "latest" && (
            <div className="notif-list">
              {notifications.map((notif) => {
                if (notif.is_system) {
                  const notifKey = String(notif.db_id ?? notif.id);
                  const shouldHighlightLatest =
                    notifKey === latestSystemNotificationKey &&
                    !viewedSystemNotificationIds.has(notifKey);
                  return (
                    <div
                      key={notif.id}
                      className={`notif-card ${shouldHighlightLatest ? "notif-card--success" : ""}`}
                    >
                      <div className="notif-card-top">
                        <div className="notif-card-info">
                          <div className="notif-who" style={{ fontSize: "1rem", color: "#1e293b" }}>
                            <img src={iconBell} alt="bell" style={{ width: "20px", marginRight: "8px" }} />
                            {notif.message}
                          </div>
                          <div className="notif-time" style={{ marginTop: "8px" }}>
                            {new Date(notif.created_at).toLocaleString("th-TH", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isSuperseded = isCaregiver && !!notif.is_superseded;
                const showStatusBadge = !(isSuperseded && ["rejected", "completed"].includes(notif.status));

                return (
                  <Fragment key={notif.id}>
                    {/* กล่องที่ 1: แจ้งเตือนเหตุการณ์ (Event Notification) */}
                    <div
                      className={`notif-card ${notif.status === "pending" ? "notif-card--pending" : ""}`}
                      style={isSuperseded ? { opacity: 0.6 } : undefined}
                    >
                      <div className="notif-card-top">
                        <div className="notif-card-info">
                          {isCaregiver ? (
                            <>
                              <div className="notif-who">
                                <img src={PeopleIcon} alt="คน" className="notif-who-icon" />
                                {notif.status === "pending" && <span><strong>{notif.elder_name}</strong> ต้องการจ้างคุณ</span>}
                                {notif.status === "accepted" && <span>คุณได้ตอบรับงานของ <strong>{notif.elder_name}</strong> แล้ว</span>}
                                {notif.status === "rejected" && !isSuperseded && <span>คุณได้ปฏิเสธงานของ <strong>{notif.elder_name}</strong></span>}
                                {notif.status === "rejected" && isSuperseded && <span><strong>{notif.elder_name}</strong></span>}
                                {notif.status === "completion_requested" && <span><strong>{notif.elder_name}</strong> ขอปิดงาน (รอให้คุณกดยืนยันเพื่อรับเงิน)</span>}
                                {notif.status === "completed" && !isSuperseded && <span>งานเสร็จสิ้นกับ <strong>{notif.elder_name}</strong></span>}
                                {notif.status === "completed" && isSuperseded && <span><strong>{notif.elder_name}</strong></span>}
                              </div>
                              {notif.status === "pending" && <div className="notif-cgid">รหัสผู้ดูแล: {notif.caregiver_sheet_id}</div>}
                            </>
                          ) : (
                            <>
                              <div className="notif-who">
                                <img src={PeopleIcon} alt="คน" className="notif-who-icon" />
                                {notif.status === "pending" && <span>คุณได้ส่งคำขอจ้างไปยัง ผู้ดูแล <strong>{notif.caregiver_sheet_id}</strong></span>}
                                {notif.status === "accepted" && <span>ผู้ดูแล <strong>{notif.caregiver_sheet_id}</strong> ได้ตอบรับงานของคุณแล้ว</span>}
                                {notif.status === "rejected" && <span>ผู้ดูแล <strong>{notif.caregiver_sheet_id}</strong> ได้ปฏิเสธงานของคุณ</span>}
                                {notif.status === "completion_requested" && <span>คุณได้ขอปิดงานกับ ผู้ดูแล <strong>{notif.caregiver_sheet_id}</strong> (รอผู้ดูแลยืนยัน)</span>}
                                {notif.status === "completed" && <span>งานเสร็จสิ้นกับ ผู้ดูแล <strong>{notif.caregiver_sheet_id}</strong></span>}
                                {notif.caregiver_name && ` (${notif.caregiver_name})`}
                              </div>
                            </>
                          )}
                          {notif.message && (
                            <div className="notif-message">💬 "{notif.message}"</div>
                          )}
                          <div className="notif-time">
                            {new Date(notif.created_at).toLocaleString("th-TH", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                        </div>
                        {showStatusBadge && statusBadge(notif.status)}
                      </div>

                      {isSuperseded && (
                        <div style={{ padding: "12px", background: "#fee2e2", borderRadius: "8px", color: "#991b1b", fontSize: "0.9rem", marginTop: "8px", textAlign: "center" }}>
                          ⚠️ ผู้สูงอายุคนนี้ได้ผู้จ้างแล้ว
                        </div>
                      )}

                      {/* ปุ่มรับงาน/ปฏิเสธ อยู่ในกล่องแจ้งเตือน (กรณี pending) */}
                      <div className="notif-actions" style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        {isCaregiver && notif.status === "pending" && !isSuperseded && (
                          <>
                            <button
                              className="notif-btn notif-btn--accept"
                              disabled={!!actionLoading}
                              onClick={() => handleRespond(notif.id, "accept")}
                            >
                              {actionLoading === `${notif.id}-accept` ? "⏳..." : "รับงาน"}
                            </button>
                            <button
                              className="notif-btn notif-btn--reject"
                              disabled={!!actionLoading}
                              onClick={() => handleRespond(notif.id, "reject")}
                            >
                              {actionLoading === `${notif.id}-reject` ? "⏳..." : "ปฏิเสธ"}
                            </button>
                          </>
                        )}
                        {!isCaregiver && notif.status === "completed" && !notif.feedback_submitted && (
                          <button
                            className="notif-btn notif-btn--review"
                            onClick={() => {
                              setReviewTarget({
                                hire_request_id: notif.id,
                                caregiver_sheet_id: notif.caregiver_sheet_id,
                                caregiver_name: notif.caregiver_name || notif.caregiver_sheet_id
                              });
                              setReviewService(0);
                              setReviewPunctuality(0);
                              setReviewCommunication(0);
                              setReviewComment("");
                              setShowReviewModal(true);
                            }}
                          >
                            ★ ให้คะแนนผู้ดูแล
                          </button>
                        )}
                        {!isCaregiver && notif.status === "completed" && notif.feedback_submitted && (
                          <span style={{ color: "#10b981", fontWeight: "600", alignSelf: "center", fontSize: "0.9rem" }}>
                            ✓ ประเมินแล้ว
                          </span>
                        )}
                      </div>
                    </div>

                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showReviewModal && !isCaregiver && reviewTarget && (
        <div className="chat-modal-overlay">
          <div className="chat-modal-card chat-review-card">
            <div className="chat-modal-icon">★</div>
            <h3>รีวิวการดูแล</h3>
            <p>
              คุณได้รับการดูแลจาก <strong>{reviewTarget.caregiver_name}</strong> เป็นอย่างไรบ้าง
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
  );
}
