import { useState, useEffect, useCallback } from "react";
import iconAi from "../icon/ai.png";
import iconBell from "../icon/bell.png";
import iconCharity from "../icon/charity.png";
import iconCheckmark from "../icon/checkmark.png";
import iconCross from "../icon/cross.png";
import iconDollar from "../icon/dollar.png";
import iconGroup from "../icon/group.png";
import iconHandshake from "../icon/handshake.png";
import iconHourglass from "../icon/hourglass.png";
import iconPeople from "../icon/people.png";
import iconPerson from "../icon/person.png";
import iconStar from "../icon/star.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function adminRequest(path, options = {}) {
  const token = localStorage.getItem("adminToken");
  return fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    ...options,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    return data;
  });
}

function iconText(src, text, alt = text) {
  return (
    <span className="adm-icon-text">
      <img src={src} alt={alt} className="adm-ui-icon" />
      <span>{text}</span>
    </span>
  );
}

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: iconAi },
  { id: "users", label: "จัดการผู้ใช้", icon: iconGroup },
  { id: "matches", label: "การจับคู่", icon: iconHandshake },
  { id: "payments", label: "การชำระเงิน", icon: iconDollar },
  { id: "feedback", label: "Feedback", icon: iconStar },
  { id: "chat", label: "ห้องแชท", icon: iconPeople },
  { id: "support", label: "ข้อความจากผู้ใช้", icon: iconBell },
  { id: "settings", label: "ตั้งค่าระบบ", icon: iconAi },
  { id: "admin_manage", label: "จัดการ Admin", icon: iconCharity },
];

export default function AdminDashboard({ admin, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userFilter, setUserFilter] = useState({ type: "", status: "pending", page: 1 });
  const [matches, setMatches] = useState([]);
  const [matchTotal, setMatchTotal] = useState(0);
  const [matchFilter, setMatchFilter] = useState({ status: "", page: 1 });
  const [payments, setPayments] = useState([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentFilter, setPaymentFilter] = useState({ status: "", page: 1 });
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [chatTotal, setChatTotal] = useState(0);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [retraining, setRetraining] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ email: "", password: "", full_name: "", secret: "" });
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: "", msg: "", onConfirm: null });
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [supportRooms, setSupportRooms] = useState([]);
  const [selectedSupport, setSelectedSupport] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState("");
  const [totalSupportUnread, setTotalSupportUnread] = useState(0);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  const openConfirm = (title, msg, onConfirm) => setConfirmModal({ open: true, title, msg, onConfirm });
  const closeConfirm = () => setConfirmModal({ open: false, title: "", msg: "", onConfirm: null });

  // ── Data Loaders ─────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const d = await adminRequest("/admin/dashboard");
    if (d.ok) setStats(d.stats);
    setLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: userFilter.page, per_page: 15 });
    if (userFilter.type) params.set("type", userFilter.type);
    if (userFilter.status) params.set("status", userFilter.status);
    const d = await adminRequest(`/admin/users?${params}`);
    if (d.ok) { setUsers(d.users); setUserTotal(d.total); }
    setLoading(false);
  }, [userFilter]);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: matchFilter.page, per_page: 15 });
    if (matchFilter.status) params.set("status", matchFilter.status);
    const d = await adminRequest(`/admin/matches?${params}`);
    if (d.ok) { setMatches(d.matches); setMatchTotal(d.total); }
    setLoading(false);
  }, [matchFilter]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: paymentFilter.page, per_page: 15 });
    if (paymentFilter.status) params.set("status", paymentFilter.status);
    const d = await adminRequest(`/admin/payments?${params}`);
    if (d.ok) { setPayments(d.payments); setPaymentTotal(d.total); }
    setLoading(false);
  }, [paymentFilter]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    const d = await adminRequest("/admin/feedback?per_page=20");
    if (d.ok) { setFeedbacks(d.feedbacks); setFeedbackSummary(d.summary); }
    setLoading(false);
  }, []);

  const loadChatRooms = useCallback(async () => {
    setLoading(true);
    const d = await adminRequest("/admin/chat-rooms?per_page=20");
    if (d.ok) { setChatRooms(d.chat_rooms || []); setChatTotal(d.total || 0); }
    setLoading(false);
  }, []);

  const loadSettings = useCallback(async () => {
    const d = await adminRequest("/admin/settings");
    if (d.ok) setSettings(d.settings);
  }, []);

  // Poll unread support count every 30 seconds
  useEffect(() => {
    async function fetchUnread() {
      const d = await adminRequest("/admin/support/chats");
      if (d.ok) {
        const total = (d.rooms || []).reduce((sum, r) => sum + (r.unread_count || 0), 0);
        setTotalSupportUnread(total);
      }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === "dashboard") loadDashboard();
    else if (tab === "users") loadUsers();
    else if (tab === "matches") loadMatches();
    else if (tab === "payments") loadPayments();
    else if (tab === "feedback") loadFeedback();
    else if (tab === "chat") loadChatRooms();
    else if (tab === "support") loadSupportChats();
    else if (tab === "settings") loadSettings();
  }, [tab, loadDashboard, loadUsers, loadMatches, loadPayments, loadFeedback, loadChatRooms, loadSettings]);

  useEffect(() => { if (tab === "users") loadUsers(); }, [userFilter, tab, loadUsers]);
  useEffect(() => { if (tab === "matches") loadMatches(); }, [matchFilter, tab, loadMatches]);
  useEffect(() => { if (tab === "payments") loadPayments(); }, [paymentFilter, tab, loadPayments]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function approveUser(userId) {
    const d = await adminRequest(`/admin/users/${userId}/approve`, { method: "PUT" });
    if (d.ok) { showToast(d.message); loadUsers(); loadDashboard(); }
    else showToast(d.message || "เกิดข้อผิดพลาด", "error");
  }
  async function rejectUser(userId) {
    openConfirm("ปฏิเสธผู้ใช้", "คุณแน่ใจหรือไม่ที่จะปฏิเสธผู้ใช้นี้?", async () => {
      const d = await adminRequest(`/admin/users/${userId}/reject`, { method: "PUT" });
      if (d.ok) { showToast(d.message); loadUsers(); loadDashboard(); }
      else showToast(d.message || "เกิดข้อผิดพลาด", "error");
      closeConfirm();
    });
  }
  async function toggleActive(userId, currentActive) {
    const action = currentActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน";
    openConfirm(`${action}บัญชี`, `คุณต้องการ${action}บัญชีนี้ใช่ไหม?`, async () => {
      const d = await adminRequest(`/admin/users/${userId}/toggle-active`, { method: "PUT" });
      if (d.ok) { showToast(d.message); loadUsers(); }
      else showToast(d.message || "เกิดข้อผิดพลาด", "error");
      closeConfirm();
    });
  }
  async function confirmSlip(hireId) {
    const d = await adminRequest(`/payment/${hireId}/confirm-slip`, { method: "PUT" });
    if (d.ok) { showToast("ยืนยันสลิปสำเร็จ"); setSelectedPayment(null); loadPayments(); }
    else showToast(d.message || "เกิดข้อผิดพลาด", "error");
  }
  async function releasePayment(hireId) {
    openConfirm("Release เงิน", "คุณต้องการ release เงินให้ผู้ดูแลใช่ไหม?", async () => {
      const d = await adminRequest(`/payment/${hireId}/release`, { method: "PUT" });
      if (d.ok) { showToast("Release เงินสำเร็จ"); loadPayments(); }
      else showToast(d.message || "เกิดข้อผิดพลาด", "error");
      closeConfirm();
    });
  }
  async function handleRetrain() {
    setRetraining(true);
    const d = await adminRequest("/admin/feedback/retrain", { method: "POST" });
    if (d.ok) showToast(d.message); else showToast(d.message || "เกิดข้อผิดพลาด", "error");
    setRetraining(false);
  }
  async function saveSettings() {
    const d = await adminRequest("/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
    if (d.ok) { showToast("บันทึกการตั้งค่าสำเร็จ"); setSettings(d.settings); }
    else showToast(d.message || "เกิดข้อผิดพลาด", "error");
  }
  async function handleCreateAdmin(e) {
    e.preventDefault();
    setCreateAdminLoading(true);
    const d = await adminRequest("/admin/create-new", {
      method: "POST",
      body: JSON.stringify(newAdminForm),
    });
    if (d.ok) {
      showToast("สร้าง Admin สำเร็จ");
      setNewAdminForm({ email: "", password: "", full_name: "", secret: "" });
    } else {
      showToast(d.message || "เกิดข้อผิดพลาด", "error");
    }
    setCreateAdminLoading(false);
  }

  async function viewChat(roomId) {
    setLoading(true);
    const d = await adminRequest(`/chat/${roomId}`);
    if (d.ok) {
      setSelectedChat(d.room);
      setChatMessages(d.messages);
    } else {
      showToast(d.message || "ไม่สามารถดึงข้อมูลแชทได้", "error");
    }
    setLoading(false);
  }

  async function loadSupportChats() {
    setLoading(true);
    const d = await adminRequest("/admin/support/chats");
    if (d.ok) {
      setSupportRooms(d.rooms);
      const total = (d.rooms || []).reduce((sum, r) => sum + (r.unread_count || 0), 0);
      setTotalSupportUnread(total);
    }
    setLoading(false);
  }

  async function viewSupportChat(roomId) {
    setLoading(true);
    const d = await adminRequest(`/admin/support/chats/${roomId}`);
    if (d.ok) {
      setSelectedSupport(d.room);
      setSupportMessages(d.messages);
    } else {
      showToast(d.message || "ไม่สามารถดึงแชทได้", "error");
    }
    setLoading(false);
  }


  async function closeSupportChat(roomId) {
    if (!window.confirm("ต้องการปิดเคสนี้หรือไม่?")) return;
    setLoading(true);
    const d = await adminRequest(`/admin/support/chats/${roomId}/close`, { method: "POST" });
    if (d.ok) {
      showToast("ปิดเคสเรียบร้อย");
      setSelectedSupport(d.room);
      setSupportRooms(prev => prev.map(r => r.id === roomId ? { ...r, is_active: false } : r));
    } else {
      showToast(d.message || "ไม่สามารถปิดเคสได้", "error");
    }
    setLoading(false);
  }
  async function handleAdminSupportSend(e) {
    e.preventDefault();
    if (!supportInput.trim()) return;
    const d = await adminRequest(`/admin/support/chats/${selectedSupport.id}`, {
      method: "POST",
      body: JSON.stringify({ message: supportInput }),
    });
    if (d.ok) {
      setSupportInput("");
      viewSupportChat(selectedSupport.id);
    } else {
      showToast(d.message || "ส่งข้อความไม่สำเร็จ", "error");
    }
  }

  // ── Helper renders ────────────────────────────────────────────────────────────
  const statusBadge = (s) => {
    const map = {
      pending: ["adm-badge-warn", iconHourglass, "รอดำเนินการ"],
      approved: ["adm-badge-ok", iconCheckmark, "อนุมัติ"],
      rejected: ["adm-badge-err", iconCross, "ปฏิเสธ"],
      accepted: ["adm-badge-ok", iconCheckmark, "รับงาน"],
      completion_requested: ["adm-badge-warn", iconHourglass, "ขอจบงาน"],
      completed: ["adm-badge-info", iconCheckmark, "เสร็จสิ้น"],
      held: ["adm-badge-info", iconDollar, "พักเงิน"],
      pending_confirm: ["adm-badge-warn", iconBell, "รอยืนยันสลิป"],
      released: ["adm-badge-ok", iconCheckmark, "โอนแล้ว"],
      refunded: ["adm-badge-err", iconCharity, "คืนเงิน"],
    };
    const [cls, src, label] = map[s] || ["adm-badge-info", iconAi, s];
    return <span className={`adm-badge ${cls}`}>{iconText(src, label)}</span>;
  };

  const stars = (n) => "★".repeat(Math.round(n || 0)) + "☆".repeat(5 - Math.round(n || 0));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" }) : "-";
  const fmtMoney = (n) => n ? Number(n).toLocaleString("th-TH") + " ฿" : "-";

  return (
    <div className="adm-layout">
      {/* Sidebar */}
      <aside className={`adm-sidebar${sidebarOpen ? "" : " collapsed"}`}>
        <div className="adm-sidebar-logo">
          <div className="adm-sidebar-logo-icon"><img src={iconAi} alt="logo" className="adm-ui-icon adm-ui-icon-lg" /></div>
          {sidebarOpen && (
            <div>
              <div className="adm-sidebar-brand">ElderCare</div>
              <div className="adm-sidebar-sub">Admin Panel</div>
            </div>
          )}
          <button className="adm-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>
        <nav className="adm-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              className={`adm-nav-item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              title={t.label}
            >
              <span className="adm-nav-icon"><img src={t.icon} alt={t.label} className="adm-ui-icon" /></span>
              {sidebarOpen && <span className="adm-nav-text">{t.label}</span>}
              {t.id === "support" && totalSupportUnread > 0 && (
                <span className="adm-nav-badge">{totalSupportUnread}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-sidebar-user">
          <div className="adm-sidebar-avatar">{admin?.full_name?.[0] || "A"}</div>
          {sidebarOpen && (
            <div className="adm-sidebar-info">
              <div className="adm-sidebar-name">{admin?.full_name}</div>
              <div className="adm-sidebar-role">Administrator</div>
            </div>
          )}
          <button className="adm-logout-btn" onClick={onLogout} title="ออกจากระบบ">ออก</button>
        </div>
      </aside>

      {/* Main */}
      <main className="adm-main">
        {/* Toast */}
        {toast.msg && (
          <div className={`adm-toast ${toast.type === "error" ? "adm-toast-error" : ""}`}>
            {toast.type === "error" ? <img src={iconBell} alt="" className="adm-ui-icon adm-ui-icon-sm" /> : <img src={iconCheckmark} alt="" className="adm-ui-icon adm-ui-icon-sm" />}{toast.msg}
          </div>
        )}

        {/* Confirm Modal */}
        {confirmModal.open && (
          <div className="adm-modal-overlay" onClick={closeConfirm}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="adm-modal-title">{confirmModal.title}</div>
              <div className="adm-modal-body">{confirmModal.msg}</div>
              <div className="adm-modal-actions">
                <button className="adm-btn-secondary" onClick={closeConfirm}>ยกเลิก</button>
                <button className="adm-btn-danger" onClick={confirmModal.onConfirm}>ยืนยัน</button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Detail Modal */}
        {selectedPayment && (
          <div className="adm-modal-overlay" onClick={() => setSelectedPayment(null)}>
            <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="adm-modal-title">{iconText(iconDollar, `รายละเอียดการชำระเงิน #${selectedPayment.id}`)}</div>
              <div className="adm-payment-detail">
                <div className="adm-payment-row"><span>งาน</span><b>#{selectedPayment.hire_request_id}</b></div>
                <div className="adm-payment-row"><span>ผู้สูงอายุ</span><b>{selectedPayment.elder_name}</b></div>
                <div className="adm-payment-row"><span>ผู้ดูแล</span><b>{selectedPayment.caregiver_name || selectedPayment.caregiver_sheet_id}</b></div>
                <div className="adm-payment-row"><span>ยอดชำระ</span><b className="adm-money">{fmtMoney(selectedPayment.amount)}</b></div>
                <div className="adm-payment-row"><span>ค่าธรรมเนียม ({selectedPayment.platform_fee_pct}%)</span><b>{fmtMoney(selectedPayment.platform_fee)}</b></div>
                <div className="adm-payment-row"><span>ผู้ดูแลได้รับ</span><b className="adm-money-green">{fmtMoney(selectedPayment.caregiver_payout)}</b></div>
                <div className="adm-payment-row"><span>วิธีชำระเงิน</span><b>{selectedPayment.payment_method}</b></div>
                <div className="adm-payment-row"><span>สถานะ</span>{statusBadge(selectedPayment.status)}</div>
                <div className="adm-payment-row"><span>ชำระเมื่อ</span><b>{fmtDate(selectedPayment.held_at)}</b></div>
                {selectedPayment.released_at && <div className="adm-payment-row"><span>Release เมื่อ</span><b>{fmtDate(selectedPayment.released_at)}</b></div>}
                {selectedPayment.slip_url && (
                  <div className="adm-payment-slip">
                    <div className="adm-slip-label">สลิปการโอนเงิน</div>
                    <a href={selectedPayment.slip_url} target="_blank" rel="noreferrer" className="adm-slip-link">
                      <img src={selectedPayment.slip_url} alt="slip" className="adm-slip-img" onError={(e) => { e.target.style.display = "none"; }} />
                      <div>เปิดสลิป ↗</div>
                    </a>
                  </div>
                )}
                {selectedPayment.caregiver_payout_promptpay && (
                  <div className="adm-payment-row"><span>PromptPay ผู้ดูแล</span><b>{selectedPayment.caregiver_payout_promptpay}</b></div>
                )}
                {selectedPayment.caregiver_payout_bank_account && (
                  <div className="adm-payment-row"><span>เลขบัญชี</span><b>{selectedPayment.caregiver_payout_bank_name} {selectedPayment.caregiver_payout_bank_account} ({selectedPayment.caregiver_payout_account_name})</b></div>
                )}
              </div>
              <div className="adm-modal-actions">
                <button className="adm-btn-secondary" onClick={() => setSelectedPayment(null)}>ปิด</button>
                {selectedPayment.status === "pending_confirm" && (
                  <button className="adm-btn-approve" onClick={() => confirmSlip(selectedPayment.hire_request_id)}>{iconText(iconCheckmark, "ยืนยันสลิป")}</button>
                )}
                {selectedPayment.status === "held" && (
                  <button className="adm-btn-primary" onClick={() => releasePayment(selectedPayment.hire_request_id)}>Release เงิน</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat Detail Modal */}
        {selectedChat && (
          <div className="adm-modal-overlay" onClick={() => setSelectedChat(null)}>
            <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="adm-modal-title">{iconText(iconPeople, `ประวัติแชทห้อง #${selectedChat.id}`)}</div>
              <div className="adm-chat-meta">
                <span>ผู้สูงอายุ: <b>{selectedChat.elder_name}</b></span>
                <span>ผู้ดูแล: <b>{selectedChat.caregiver_name}</b></span>
              </div>
              <div className="adm-chat-history">
                {chatMessages.length === 0 ? (
                  <div className="adm-empty">ไม่มีข้อความในห้องแชทนี้</div>
                ) : (
                  chatMessages.map(m => {
                    const senderRole = m.sender_id === selectedChat.elder_user_id ? "elder" : "caregiver";
                    return (
                      <div key={m.id} className={`adm-chat-msg ${senderRole}`}>
                        <div className="adm-chat-bubble">
                          {m.image_url ? (
                            <img src={m.image_url} alt="chat" className="adm-chat-img-inline" />
                          ) : (
                            m.message
                          )}
                        </div>
                        <div className="adm-chat-time">{new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} - {senderRole === "elder" ? "ผู้สูงอายุ" : "ผู้ดูแล"}</div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="adm-modal-actions">
                <button className="adm-btn-secondary" onClick={() => setSelectedChat(null)}>ปิด</button>
              </div>
            </div>
          </div>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────── */}
        {tab === "dashboard" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconAi, "ภาพรวมแพลตฟอร์ม")}</h1>
                <p className="adm-page-sub">ยินดีต้อนรับ, {admin?.full_name}</p>
              </div>
              <button className="adm-btn-secondary" onClick={loadDashboard}>รีเฟรช</button>
            </div>
            {loading ? <LoadingSpinner /> : stats && (
              <>
                <div className="adm-stat-grid">
                  <StatCard label="ผู้ใช้ทั้งหมด" value={stats.users.total} sub={`+${stats.users.new_7d} ใน 7 วัน`} icon={iconGroup} color="purple" />
                  <StatCard label="ผู้สูงอายุ" value={stats.users.elders} sub={`รอ: ${stats.users.pending_elders} คน`} icon={iconPerson} color="blue" />
                  <StatCard label="ผู้ดูแล" value={stats.users.caregivers} sub={`รอ: ${stats.users.pending_caregivers} คน`} icon={iconCharity} color="green" />
                  <StatCard label="การจับคู่" value={stats.matches.total} sub={`+${stats.matches.new_7d} ใน 7 วัน`} icon={iconHandshake} color="orange" />
                  <StatCard label="รอดำเนินการ" value={stats.matches.pending} sub="คำขอรอตอบ" icon={iconHourglass} color="warn" />
                  <StatCard label="เสร็จสิ้น" value={stats.matches.completed} sub="งานสำเร็จ" icon={iconCheckmark} color="" />
                  <StatCard label="คะแนน Feedback" value={stats.feedback.avg_rating ? stats.feedback.avg_rating.toFixed(1) : "-"} sub={`จาก ${stats.feedback.total} รีวิว`} icon={iconStar} color="gold" />
                  <StatCard label="รอ Approve" value={stats.users.pending_elders + stats.users.pending_caregivers} sub="ผู้ใช้รอการอนุมัติ" icon={iconBell} color="warn" onClick={() => setTab("users")} />
                </div>

                <div className="adm-section-title">{iconText(iconAi, "การลงทะเบียนรายวัน (14 วัน)")}</div>
                <div className="adm-chart-wrap">
                  <MiniBarChart data={stats.daily_registrations} />
                </div>

                <div className="adm-two-col">
                  <div className="adm-card">
                    <div className="adm-card-title">{iconText(iconHandshake, "สถานะการจับคู่")}</div>
                    <div className="adm-donut-list">
                      {[["รอ", stats.matches.pending, "#f59e0b"], ["รับงาน", stats.matches.accepted, "#10b981"], ["เสร็จ", stats.matches.completed, "#6366f1"], ["ปฏิเสธ", stats.matches.rejected, "#ef4444"]].map(([l, v, c]) => (
                        <div key={l} className="adm-donut-row">
                          <span className="adm-donut-dot" style={{ background: c }} />
                          <span className="adm-donut-label">{l}</span>
                          <div className="adm-donut-bar-wrap"><div className="adm-donut-bar" style={{ width: `${(v / Math.max(stats.matches.total, 1)) * 100}%`, background: c }} /></div>
                          <span className="adm-donut-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="adm-card">
                    <div className="adm-card-title">{iconText(iconStar, "คุณภาพ Feedback เฉลี่ย")}</div>
                    <div className="adm-big-rating-row">
                      <div className="adm-big-rating">{stats.feedback.avg_rating?.toFixed(1) || "-"}</div>
                      <div className="adm-big-stars">{stars(stats.feedback.avg_rating)}</div>
                    </div>
                    <div className="adm-feedback-metrics">
                      {[["คุณภาพบริการ", stats.feedback.avg_service_quality], ["ตรงต่อเวลา", stats.feedback.avg_punctuality], ["การสื่อสาร", stats.feedback.avg_communication]].map(([l, v]) => (
                        <div key={l} className="adm-metric-row">
                          <span className="adm-metric-label">{l}</span>
                          <div className="adm-metric-bar-wrap"><div className="adm-metric-bar" style={{ width: `${(v / 5) * 100}%` }} /></div>
                          <span className="adm-metric-val">{v?.toFixed(1) || "-"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="adm-section-title">{iconText(iconAi, "การดำเนินการด่วน")}</div>
                <div className="adm-quick-actions">
                  <button className="adm-quick-btn" onClick={() => { setUserFilter({ type: "", status: "pending", page: 1 }); setTab("users"); }}>
                    <img src={iconGroup} alt="group" className="adm-ui-icon" /><span>ผู้ใช้รอ Approve ({stats.users.pending_elders + stats.users.pending_caregivers})</span>
                  </button>
                  <button className="adm-quick-btn" onClick={() => { setPaymentFilter({ status: "pending_confirm", page: 1 }); setTab("payments"); }}>
                    <img src={iconDollar} alt="payment" className="adm-ui-icon" /><span>สลิปรอยืนยัน</span>
                  </button>
                  <button className="adm-quick-btn" onClick={() => { setMatchFilter({ status: "pending", page: 1 }); setTab("matches"); }}>
                    <img src={iconHandshake} alt="handshake" className="adm-ui-icon" /><span>คำขอรอตอบ ({stats.matches.pending})</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── USERS ─────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconGroup, "จัดการผู้ใช้")}</h1>
                <p className="adm-page-sub">ทั้งหมด {userTotal} คน</p>
              </div>
              <button className="adm-btn-secondary" onClick={loadUsers}>รีเฟรช</button>
            </div>
            <div className="adm-filter-row">
              <div className="adm-filter-group">
                <span className="adm-filter-label">ประเภท:</span>
                {[["", "ทั้งหมด"], ["elder", iconText(iconPerson, "ผู้สูงอายุ")], ["caregiver", iconText(iconCharity, "ผู้ดูแล")]].map(([v, l]) => (
                  <button key={v} className={`adm-filter-btn ${userFilter.type === v ? "active" : ""}`} onClick={() => setUserFilter(f => ({ ...f, type: v, page: 1 }))}>{l}</button>
                ))}
              </div>
              <div className="adm-filter-group">
                <span className="adm-filter-label">สถานะ:</span>
                {[["pending", iconText(iconHourglass, "รอ Approve")], ["approved", iconText(iconCheckmark, "อนุมัติ")], ["rejected", iconText(iconCross, "ปฏิเสธ")], ["", "ทั้งหมด"]].map(([v, l]) => (
                  <button key={v} className={`adm-filter-btn ${userFilter.status === v ? "active" : ""}`} onClick={() => setUserFilter(f => ({ ...f, status: v, page: 1 }))}>{l}</button>
                ))}
              </div>
            </div>
            {loading ? <LoadingSpinner /> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>ประเภท</th><th>สถานะ</th><th>รหัส</th><th>วันที่สมัคร</th><th>บัญชี</th><th>จัดการ</th></tr></thead>
                  <tbody>
                    {users.length === 0 ? <tr><td colSpan={8} className="adm-empty">ไม่พบข้อมูล</td></tr> : users.map(u => (
                      <tr key={u.id}>
                        <td className="adm-cell-name">
                          <div className="adm-user-avatar" style={{ background: u.user_type === "elder" ? "#3b82f6" : "#10b981" }}>{u.full_name[0]}</div>
                          <div>
                            <div>{u.full_name}</div>
                            {u.phone && <div className="adm-cell-sub">{u.phone}</div>}
                          </div>
                        </td>
                        <td><span className="adm-email">{u.email}</span></td>
                        <td><span className={`adm-type-badge ${u.user_type}`}>{u.user_type === "elder" ? iconText(iconPerson, "ผู้สูงอายุ") : iconText(iconCharity, "ผู้ดูแล")}</span></td>
                        <td>{statusBadge(u.approval_status)}</td>
                        <td><code className="adm-code">{u.elder_id || u.caregiver_id || "-"}</code></td>
                        <td className="adm-date">{fmtDate(u.created_at)}</td>
                        <td>
                          <span className={`adm-active-dot ${u.is_active ? "on" : "off"}`} />
                          {u.is_active ? "เปิด" : "ปิด"}
                        </td>
                        <td>
                          <div className="adm-action-btns">
                            {u.approval_status === "pending" && <>
                              <button className="adm-btn-approve" onClick={() => approveUser(u.id)}><img src={iconCheckmark} alt="approve" className="adm-ui-icon adm-ui-icon-sm" /></button>
                              <button className="adm-btn-reject" onClick={() => rejectUser(u.id)}><img src={iconCross} alt="reject" className="adm-ui-icon adm-ui-icon-sm" /></button>
                            </>}
                            <button className={`adm-btn-toggle ${u.is_active ? "active" : "inactive"}`} onClick={() => toggleActive(u.id, u.is_active)} title={u.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}>
                              {u.is_active ? "ปิด" : "เปิด"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MATCHES ───────────────────────────────────────── */}
        {tab === "matches" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconHandshake, "ประวัติการจับคู่")}</h1>
                <p className="adm-page-sub">ทั้งหมด {matchTotal} รายการ</p>
              </div>
              <button className="adm-btn-secondary" onClick={loadMatches}>รีเฟรช</button>
            </div>
            <div className="adm-filter-row">
              {[["", "ทั้งหมด"], ["pending", iconText(iconHourglass, "รอ")], ["accepted", iconText(iconCheckmark, "รับ")], ["completion_requested", iconText(iconHourglass, "ขอจบ")], ["completed", iconText(iconCheckmark, "เสร็จ")], ["rejected", iconText(iconCross, "ปฏิเสธ")]].map(([v, l]) => (
                <button key={v} className={`adm-filter-btn ${matchFilter.status === v ? "active" : ""}`} onClick={() => setMatchFilter(f => ({ ...f, status: v, page: 1 }))}>{l}</button>
              ))}
            </div>
            {loading ? <LoadingSpinner /> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>#</th><th>ผู้สูงอายุ</th><th>ผู้ดูแล</th><th>สถานะ</th><th>การชำระเงิน</th><th>ห้องแชท</th><th>วันที่</th></tr></thead>
                  <tbody>
                    {matches.length === 0 ? <tr><td colSpan={7} className="adm-empty">ไม่พบข้อมูล</td></tr> : matches.map(m => (
                      <tr key={m.id}>
                        <td className="adm-id">#{m.id}</td>
                        <td>{m.elder_name}</td>
                        <td><code className="adm-code">{m.caregiver_sheet_id}</code>{m.caregiver_name && <div className="adm-cell-sub">{m.caregiver_name}</div>}</td>
                        <td>{statusBadge(m.status)}</td>
                        <td>{m.payment ? statusBadge(m.payment.status) : <span className="adm-cell-sub">ยังไม่ชำระ</span>}</td>
                        <td>{m.chat_room_id ? <span className="adm-badge adm-badge-info">#{m.chat_room_id} {m.chat_room_active ? "เปิด" : "ปิด"}</span> : "-"}</td>
                        <td className="adm-date">{fmtDate(m.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENTS ──────────────────────────────────────── */}
        {tab === "payments" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconDollar, "จัดการการชำระเงิน (Escrow)")}</h1>
                <p className="adm-page-sub">ทั้งหมด {paymentTotal} รายการ</p>
              </div>
              <button className="adm-btn-secondary" onClick={loadPayments}>รีเฟรช</button>
            </div>
            <div className="adm-filter-row">
              {[["", "ทั้งหมด"], ["pending_confirm", iconText(iconBell, "รอยืนยันสลิป")], ["held", iconText(iconHourglass, "พักเงิน")], ["released", iconText(iconCheckmark, "โอนแล้ว")], ["refunded", iconText(iconCharity, "คืนเงิน")]].map(([v, l]) => (
                <button key={v} className={`adm-filter-btn ${paymentFilter.status === v ? "active" : ""}`} onClick={() => setPaymentFilter(f => ({ ...f, status: v, page: 1 }))}>{l}</button>
              ))}
            </div>
            {loading ? <LoadingSpinner /> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>#</th><th>ผู้สูงอายุ</th><th>ผู้ดูแล</th><th>ยอดชำระ</th><th>ค่าธรรมเนียม</th><th>ผู้ดูแลได้</th><th>สถานะ</th><th>วันที่</th><th>จัดการ</th></tr></thead>
                  <tbody>
                    {payments.length === 0 ? <tr><td colSpan={9} className="adm-empty">ไม่พบข้อมูล</td></tr> : payments.map(p => (
                      <tr key={p.id} className={p.status === "pending_confirm" ? "adm-row-highlight" : ""}>
                        <td className="adm-id">#{p.id}</td>
                        <td>{p.elder_name}</td>
                        <td>{p.caregiver_name || <code className="adm-code">{p.caregiver_sheet_id}</code>}</td>
                        <td className="adm-money">{fmtMoney(p.amount)}</td>
                        <td>{fmtMoney(p.platform_fee)}</td>
                        <td className="adm-money-green">{fmtMoney(p.caregiver_payout)}</td>
                        <td>{statusBadge(p.status)}</td>
                        <td className="adm-date">{fmtDate(p.held_at)}</td>
                        <td>
                          <div className="adm-action-btns">
                            <button className="adm-btn-info" onClick={() => setSelectedPayment(p)}>ดู</button>
                            {p.status === "pending_confirm" && (
                              <button className="adm-btn-approve" onClick={() => confirmSlip(p.hire_request_id)}>{iconText(iconCheckmark, "ยืนยัน")}</button>
                            )}
                            {p.status === "held" && (
                              <button className="adm-btn-primary" onClick={() => releasePayment(p.hire_request_id)}>Release</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── FEEDBACK ──────────────────────────────────────── */}
        {tab === "feedback" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconStar, "วิเคราะห์ Feedback")}</h1>
                <p className="adm-page-sub">รีวิวจากผู้ใช้งานจริง</p>
              </div>
              <button className="adm-btn-retrain" onClick={handleRetrain} disabled={retraining}>
                {retraining ? "กำลังส่ง..." : "Retrain AI Model"}
              </button>
            </div>
            {feedbackSummary && (
              <div className="adm-feedback-summary">
                <div className="adm-card">
                  <div className="adm-card-title">สรุปคะแนนรีวิวทั้งหมด</div>
                  <div className="adm-big-rating-row">
                    <div className="adm-big-rating">{feedbackSummary.avg_rating.toFixed(1)}</div>
                    <div>
                      <div className="adm-big-stars">{stars(feedbackSummary.avg_rating)}</div>
                      <div className="adm-cell-sub">{feedbackSummary.total} รีวิว</div>
                    </div>
                  </div>
                  <div className="adm-rating-dist">
                    {[5, 4, 3, 2, 1].map(i => {
                      const count = feedbackSummary.rating_distribution?.[i] || 0;
                      const max = Math.max(...Object.values(feedbackSummary.rating_distribution || {}), 1);
                      return (
                        <div key={i} className="adm-rating-row">
                          <span className="adm-rating-star">{i}★</span>
                          <div className="adm-rating-bar-wrap"><div className="adm-rating-bar" style={{ width: `${(count / max) * 100}%` }} /></div>
                          <span className="adm-rating-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {loading ? <LoadingSpinner /> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>ผู้สูงอายุ</th><th>รหัสผู้ดูแล</th><th>คะแนน</th><th>บริการ</th><th>ตรงเวลา</th><th>สื่อสาร</th><th>ความคิดเห็น</th><th>วันที่</th></tr></thead>
                  <tbody>
                    {feedbacks.length === 0 ? <tr><td colSpan={8} className="adm-empty">ยังไม่มี Feedback</td></tr> : feedbacks.map(f => (
                      <tr key={f.id}>
                        <td>{f.elder_name}</td>
                        <td><code className="adm-code">{f.caregiver_sheet_id}</code></td>
                        <td><span className="adm-stars">{stars(f.rating)} <b>{f.rating}</b>/5</span></td>
                        <td>{f.service_quality || "-"}</td>
                        <td>{f.punctuality || "-"}</td>
                        <td>{f.communication || "-"}</td>
                        <td className="adm-comment">{f.comment || <span className="adm-cell-sub">ไม่มีความคิดเห็น</span>}</td>
                        <td className="adm-date">{fmtDate(f.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT ROOMS ────────────────────────────────────── */}
        {tab === "chat" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconPeople, "ห้องแชทในระบบ")}</h1>
                <p className="adm-page-sub">ทั้งหมด {chatTotal} ห้อง</p>
              </div>
              <button className="adm-btn-secondary" onClick={loadChatRooms}>รีเฟรช</button>
            </div>
            {loading ? <LoadingSpinner /> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>#</th><th>ผู้สูงอายุ</th><th>ผู้ดูแล</th><th>รหัสผู้ดูแล</th><th>สถานะ</th><th>ข้อความล่าสุด</th><th>วันที่สร้าง</th><th>จัดการ</th></tr></thead>
                  <tbody>
                    {chatRooms.length === 0 ? <tr><td colSpan={7} className="adm-empty">ไม่พบข้อมูล</td></tr> : chatRooms.map(r => (
                      <tr key={r.id}>
                        <td className="adm-id">#{r.id}</td>
                        <td>{r.elder_name}</td>
                        <td>{r.caregiver_name}</td>
                        <td><code className="adm-code">{r.caregiver_sheet_id}</code></td>
                        <td>
                          {r.is_active
                            ? <span className="adm-badge adm-badge-ok">{iconText(iconCheckmark, "เปิดอยู่")}</span>
                            : <span className="adm-badge adm-badge-err">{iconText(iconBell, "ปิดแล้ว")}</span>}
                        </td>
                        <td className="adm-comment">{r.last_message || <span className="adm-cell-sub">ไม่มีข้อความ</span>}</td>
                        <td className="adm-date">{fmtDate(r.created_at)}</td>
                        <td>
                          <button className="adm-btn-info" onClick={() => viewChat(r.id)}>ดูแชท</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


        {/* ── SUPPORT CHAT ─────────────────────────────────────── */}
        {tab === "support" && (
          <div className="adm-content adm-inbox-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconBell, "ข้อความจากผู้ใช้")}</h1>
                <p className="adm-page-sub">ตอบกลับคำถามหรือปัญหาจากผู้ใช้งาน</p>
              </div>
            </div>

            <div className="adm-inbox-layout">
              {/* Sidebar List */}
              <div className="adm-inbox-sidebar">
                {supportRooms.length === 0 ? (
                  <div className="adm-empty">ยังไม่มีข้อความ</div>
                ) : (
                  supportRooms.map(r => (
                    <div 
                      key={r.id} 
                      className={`adm-inbox-item ${selectedSupport?.id === r.id ? 'active' : ''} ${r.is_active === false ? 'closed' : ''}`}
                      onClick={() => viewSupportChat(r.id)}
                    >
                      <div className="adm-inbox-avatar">{r.user_name?.[0] || "U"}</div>
                      <div className="adm-inbox-item-info">
                        <div className="adm-inbox-item-header">
                          <span className="adm-inbox-name">{r.user_name}</span>
                          <span className="adm-inbox-time">{fmtDate(r.updated_at)}</span>
                        </div>
                        <div className="adm-inbox-item-body">
                          <span className="adm-inbox-msg">{r.last_message || "ไม่มีข้อความ"}</span>
                          {r.unread_count > 0 && <span className="adm-inbox-badge">{r.unread_count}</span>}
                          {r.is_active === false && <span className="adm-inbox-status-badge">ปิดแล้ว</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Main Chat View */}
              <div className="adm-inbox-main">
                {selectedSupport ? (
                  <div className="adm-support-chat-view">
                    <div className="adm-support-chat-topbar">
                      <div className="adm-support-chat-header-info">
                        <div className="adm-support-user-avatar">{selectedSupport.user_name?.[0] || "U"}</div>
                        <div>
                          <div className="adm-support-chat-name">{selectedSupport.user_name}</div>
                          <div className="adm-support-chat-sub">
                            {selectedSupport.is_active === false ? "เคสถูกปิดแล้ว" : "กำลังสนทนา"}
                          </div>
                        </div>
                      </div>
                      {selectedSupport.is_active !== false && (
                        <button className="adm-btn-reject" style={{marginLeft: 'auto'}} onClick={() => closeSupportChat(selectedSupport.id)}>
                          ปิดเคส
                        </button>
                      )}
                    </div>
                    <div className="adm-chat-history adm-support-history">
                      {supportMessages.length === 0 ? (
                        <div className="adm-support-empty">
                          <div style={{ fontSize: "32px", marginBottom: "8px" }}>👋</div>
                          <div>ยังไม่มีข้อความ</div>
                        </div>
                      ) : (
                        supportMessages.map(m => (
                          <div key={m.id} className={`adm-support-msg-row ${m.is_admin_sender ? "admin" : "user"}`}>
                            {!m.is_admin_sender && <div className="adm-support-msg-avatar">{selectedSupport.user_name?.[0] || "U"}</div>}
                            <div className="adm-support-msg-content">
                              <div className="adm-support-msg-bubble">{m.message}</div>
                              <div className="adm-support-msg-time">
                                {new Date(m.created_at).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form className="adm-support-reply-form" onSubmit={handleAdminSupportSend}>
                      <input
                        type="text"
                        className="adm-support-reply-input"
                        placeholder={selectedSupport.is_active === false ? "เคสถูกปิดแล้ว รอผู้ใช้ติดต่อมาใหม่" : "พิมพ์ข้อความตอบกลับ..."}
                        value={supportInput}
                        onChange={e => setSupportInput(e.target.value)}
                        disabled={selectedSupport.is_active === false}
                      />
                      <button type="submit" className="adm-support-send-btn" disabled={!supportInput.trim() || selectedSupport.is_active === false}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="adm-inbox-empty">
                    <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>💬</div>
                    <div>เลือกแชทเพื่อเริ่มสนทนา</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS ──────────────────────────────────────── */}
        {tab === "settings" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconAi, "ตั้งค่าระบบ")}</h1>
                <p className="adm-page-sub">ปรับแต่งพารามิเตอร์ระบบ AI และนโยบาย</p>
              </div>
              <button className="adm-btn-primary" onClick={saveSettings}>บันทึก</button>
            </div>
            {settings && (
              <div className="adm-settings-grid">
                <div className="adm-card">
                  <div className="adm-card-title">{iconText(iconAi, "การตั้งค่า AI Matching")}</div>
                  <div className="adm-setting-field">
                    <label>โมเดล AI หลัก</label>
                    <select className="adm-setting-input" value={settings.ai_model_default} onChange={e => setSettings(s => ({ ...s, ai_model_default: e.target.value }))}>
                      <option value="random_forest">Random Forest</option>
                      <option value="knn">KNN</option>
                      <option value="neural_network">Neural Network</option>
                      <option value="logistic_regression">Logistic Regression</option>
                    </select>
                  </div>
                  <div className="adm-setting-field">
                    <label>จำนวนผู้ดูแลสูงสุดที่แสดง (Top N)</label>
                    <input type="number" className="adm-setting-input" min={1} max={20} value={settings.matching_top_n} onChange={e => setSettings(s => ({ ...s, matching_top_n: Number(e.target.value) }))} />
                  </div>
                  <div className="adm-setting-field">
                    <label>น้ำหนัก Skill Precision (0–1)</label>
                    <input type="number" step={0.05} min={0} max={1} className="adm-setting-input" value={settings.score_weights?.skill_precision || 0.6} onChange={e => setSettings(s => ({ ...s, score_weights: { ...s.score_weights, skill_precision: Number(e.target.value) } }))} />
                  </div>
                  <div className="adm-setting-field">
                    <label>น้ำหนักระยะทาง (0–1)</label>
                    <input type="number" step={0.01} min={0} max={1} className="adm-setting-input" value={settings.score_weights?.nearby_factor || 0.1} onChange={e => setSettings(s => ({ ...s, score_weights: { ...s.score_weights, nearby_factor: Number(e.target.value) } }))} />
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-title">{iconText(iconDollar, "เงื่อนไขค่าจ้าง")}</div>
                  <div className="adm-setting-field">
                    <label>ค่าจ้างขั้นต่ำ (บาท/เดือน)</label>
                    <input type="number" className="adm-setting-input" value={settings.min_wage} onChange={e => setSettings(s => ({ ...s, min_wage: Number(e.target.value) }))} />
                  </div>
                  <div className="adm-setting-field">
                    <label>ค่าจ้างสูงสุด (บาท/เดือน)</label>
                    <input type="number" className="adm-setting-input" value={settings.max_wage} onChange={e => setSettings(s => ({ ...s, max_wage: Number(e.target.value) }))} />
                  </div>
                  <div className="adm-setting-field">
                    <label>ประสบการณ์ขั้นต่ำ (ปี)</label>
                    <input type="number" className="adm-setting-input" min={0} value={settings.min_experience_years} onChange={e => setSettings(s => ({ ...s, min_experience_years: Number(e.target.value) }))} />
                  </div>
                  <div className="adm-setting-field adm-toggle-field">
                    <div>
                      <label>อนุมัติผู้ใช้ใหม่อัตโนมัติ</label>
                      <div className="adm-cell-sub">เปิดจะอนุมัติทุกบัญชีที่สมัครใหม่ทันที</div>
                    </div>
                    <button className={`adm-toggle ${settings.auto_approve ? "on" : "off"}`} onClick={() => setSettings(s => ({ ...s, auto_approve: !s.auto_approve }))}>
                      {settings.auto_approve ? "เปิด" : "ปิด"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN MANAGE ──────────────────────────────────── */}
        {tab === "admin_manage" && (
          <div className="adm-content">
            <div className="adm-page-header">
              <div>
                <h1 className="adm-page-title">{iconText(iconCharity, "จัดการ Admin")}</h1>
                <p className="adm-page-sub">สร้างบัญชีผู้ดูแลระบบเพิ่มเติม</p>
              </div>
            </div>

            <div className="adm-two-col">
              <div className="adm-card">
                <div className="adm-card-title">{iconText(iconCharity, "สร้าง Admin ใหม่")}</div>
                <form onSubmit={handleCreateAdmin} className="adm-create-admin-form">
                  <div className="adm-setting-field">
                    <label>ชื่อ-นามสกุล</label>
                    <input type="text" className="adm-setting-input" placeholder="ชื่อผู้ดูแลระบบ" value={newAdminForm.full_name} onChange={e => setNewAdminForm(f => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <div className="adm-setting-field">
                    <label>อีเมล</label>
                    <input type="email" className="adm-setting-input" placeholder="admin@eldercare.com" value={newAdminForm.email} onChange={e => setNewAdminForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div className="adm-setting-field">
                    <label>รหัสผ่าน</label>
                    <input type="password" className="adm-setting-input" placeholder="รหัสผ่านอย่างน้อย 6 ตัว" value={newAdminForm.password} onChange={e => setNewAdminForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                  </div>
                  <div className="adm-setting-field">
                    <label>รหัสลับระบบ (Admin Secret)</label>
                    <input type="password" className="adm-setting-input" placeholder="รหัสลับที่ตั้งค่าใน .env" value={newAdminForm.secret} onChange={e => setNewAdminForm(f => ({ ...f, secret: e.target.value }))} required />
                  </div>
                  <button type="submit" className="adm-btn-primary" disabled={createAdminLoading} style={{ width: "100%", marginTop: "8px" }}>
                    {createAdminLoading ? "กำลังสร้าง..." : "สร้าง Admin"}
                  </button>
                </form>
              </div>

              <div className="adm-card">
                <div className="adm-card-title">{iconText(iconCharity, "ข้อมูล Admin ปัจจุบัน")}</div>
                <div className="adm-admin-info">
                  <div className="adm-admin-avatar">{admin?.full_name?.[0] || "A"}</div>
                  <div>
                    <div className="adm-admin-name">{admin?.full_name}</div>
                    <div className="adm-admin-email">{admin?.email}</div>
                    <div className="adm-admin-role">Administrator</div>
                  </div>
                </div>
                <div className="adm-info-box">
                  <div className="adm-info-item">
                    <span>User ID</span>
                    <b>#{admin?.id}</b>
                  </div>
                  <div className="adm-info-item">
                    <span>สถานะ</span>
                    <span className="adm-badge adm-badge-ok">{iconText(iconCheckmark, "Active")}</span>
                  </div>
                  <div className="adm-info-item">
                    <span>สิทธิ์</span>
                    <b>Full Admin Access</b>
                  </div>
                </div>
                <div className="adm-info-box" style={{ marginTop: "16px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontWeight: "600", color: "#ef4444", marginBottom: "8px" }}>คำเตือน</div>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    การสร้าง Admin ใหม่ต้องใช้ Admin Secret ที่กำหนดใน .env (ADMIN_SECRET) ระมัดระวังในการแชร์รหัสลับนี้
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color, onClick }) {
  return (
    <div className={`adm-stat-card adm-stat-${color}${onClick ? " adm-stat-clickable" : ""}`} onClick={onClick}>
      <div className="adm-stat-icon"><img src={icon} alt={label} className="adm-ui-icon adm-ui-icon-lg" /></div>
      <div className="adm-stat-value">{value}</div>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-sub">{sub}</div>
      {onClick && <div className="adm-stat-arrow">→</div>}
    </div>
  );
}

function MiniBarChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const recent = data.slice(-14);
  return (
    <div className="adm-bar-chart">
      {recent.map((d, i) => (
        <div key={i} className="adm-bar-col" title={`${d.date}: ${d.count} คน`}>
          <div className="adm-bar-val">{d.count > 0 && d.count}</div>
          <div className="adm-bar" style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }} />
          <div className="adm-bar-label">{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="adm-loading">
      <div className="adm-spinner-ring" />
      <div>กำลังโหลดข้อมูล...</div>
    </div>
  );
}
