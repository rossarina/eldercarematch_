import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { API_BASE_URL, getProfile, updateProfile, uploadProfileImage, changePassword, getCaregiverReviews } from "../api";
import iconArrow from "../icon/arrow.png";
import iconPerson from "../icon/person.png";
import iconStar from "../icon/star.png";

async function getPayoutAccount(token) {
  const r = await fetch(`${API_BASE_URL}/payout-account`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}
async function savePayoutAccount(token, data) {
  const r = await fetch(`${API_BASE_URL}/payout-account`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || "บันทึกไม่สำเร็จ"); }
  return r.json();
}

export default function Profile({ onLogout, onBack }) {
  const { user, token, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, reviews: [], loading: false });
  const [editMode, setEditMode] = useState(false);
  const [changePassMode, setChangePassMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  // บัญชีรับเงิน (Caregiver)
  const [payoutData, setPayoutData] = useState({ payout_promptpay: "", payout_bank_name: "", payout_bank_account: "", payout_account_name: "" });
  const [payoutEdit, setPayoutEdit] = useState(false);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    elder_id: "",
    caregiver_id: "",
  });
  const [passData, setPassData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const renderStars = (rating) => {
    const rounded = Math.round(Number(rating) || 0);
    if (!rounded) return "ยังไม่มีคะแนน";
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  };

  const formatFeedbackDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      setProfileData(data.user);
      setFeedbackSummary(data.feedback_summary || null);
      setProfileImagePreview(data.user.profile_image || data.user.avatar_url || "");
      setFormData({
        full_name: data.user.full_name,
        phone: data.user.phone || "",
        elder_id: data.user.elder_id || "",
        caregiver_id: data.user.caregiver_id || "",
      });
      // โหลดบัญชีรับเงินถ้าเป็น caregiver
      if (data.user.user_type === 'caregiver' && !payoutLoaded) {
        try {
          const pd = await getPayoutAccount(token);
          if (pd.ok) setPayoutData({ payout_promptpay: pd.payout_promptpay || "", payout_bank_name: pd.payout_bank_name || "", payout_bank_account: pd.payout_bank_account || "", payout_account_name: pd.payout_account_name || "" });
        } catch(_) {}
        setPayoutLoaded(true);
      }
    } catch (err) {
      setError(err.message || "ไม่สามารถโหลดข้อมูลโปรไฟล์");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayout = async () => {
    setPayoutSaving(true);
    setError("");
    try {
      await savePayoutAccount(token, payoutData);
      setPayoutEdit(false);
      setSuccess("บันทึกบัญชีรับเงินสำเร็จ");
      setTimeout(() => setSuccess(""), 3000);
    } catch(err) {
      setError(err.message);
    } finally {
      setPayoutSaving(false);
    }
  };


  const handleChangeProfile = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleChangePassword = (e) => {
    const { name, value } = e.target;
    setPassData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await updateProfile(formData);
      updateUser(response.user);
      setProfileData(response.user);
      setFeedbackSummary(response.feedback_summary || null);
      setProfileImagePreview(response.user.profile_image || response.user.avatar_url || profileImagePreview);
      setEditMode(false);
      setSuccess("อัพเดตโปรไฟล์สำเร็จ");
    } catch (err) {
      setError(err.message || "ไม่สามารถอัพเดตโปรไฟล์");
    }
  };

  const handleOpenReviews = async () => {
    if (!profileData?.caregiver_id) return;
    setReviewModal({ isOpen: true, reviews: [], loading: true });
    try {
      const data = await getCaregiverReviews(profileData.caregiver_id);
      setReviewModal({ isOpen: true, reviews: data.reviews || [], loading: false });
    } catch (err) {
      setError(err.message || "ไม่สามารถโหลดรีวิวทั้งหมด");
      setReviewModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!passData.old_password) {
      setError("กรุณากรอกรหัสผ่านเก่า");
      return;
    }
    if (!passData.new_password) {
      setError("กรุณากรอกรหัสผ่านใหม่");
      return;
    }
    if (passData.new_password.length < 6) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (passData.new_password !== passData.confirm_password) {
      setError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    try {
      await changePassword({
        old_password: passData.old_password,
        new_password: passData.new_password,
      });
      setSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
      setPassData({ old_password: "", new_password: "", confirm_password: "" });
      setChangePassMode(false);
    } catch (err) {
      setError(err.message || "ไม่สามารถเปลี่ยนรหัสผ่าน");
    }
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setError("รองรับเฉพาะไฟล์ PNG, JPG, JPEG หรือ WEBP");
      return;
    }

    const formDataPayload = new FormData();
    formDataPayload.append("image", file);
    setImageUploading(true);
    try {
      const data = await uploadProfileImage(formDataPayload);
      updateUser(data.user);
      setProfileData(data.user);
      setProfileImagePreview(data.profile_image || data.user.profile_image || data.user.avatar_url || "");
      setSuccess("อัปโหลดรูปโปรไฟล์สำเร็จ");
    } catch (err) {
      setError(err.message || "ไม่สามารถอัปโหลดรูปได้");
    } finally {
      setImageUploading(false);
    }
  };

  if (loading) {
    return <div className="profile-loading">กำลังโหลด...</div>;
  }

  if (!profileData) {
    return (
      <div className="profile-container">
        <div className="profile-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onBack && (
              <button className="ecm-back" type="button" onClick={onBack}>
                <img src={iconArrow} className="arrow-left" alt="" /><span className="profile-back-text">ย้อนกลับ</span>
              </button>
            )}
            <h1 style={{ margin: 0 }}>โปรไฟล์ของฉัน</h1>
          </div>
          <button className="btn btn-danger" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
        <div className="profile-error">ไม่พบข้อมูลโปรไฟล์ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่</div>
        <button className="btn btn-secondary" onClick={() => window.location.hash = "home"}>
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onBack && (
              <button className="ecm-back" type="button" onClick={onBack}>
                <img src={iconArrow} className="arrow-left" alt="" /><span className="profile-back-text">ย้อนกลับ</span>
              </button>
            )}
            <h1 style={{ margin: 0 }}>โปรไฟล์ของฉัน</h1>
          </div>
        <button className="btn btn-danger" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>
      {/* ─── Avatar + Upload ─── */}
      <div className="profile-avatar-row">
        <img
          src={profileImagePreview || iconPerson}
          alt="รูปโปรไฟล์"
          className="profile-avatar-img"
        />
        <label className="profile-avatar-upload-btn" htmlFor="profile-img-input">
          📷 เปลี่ยนรูปโปรไฟล์
        </label>
        <input
          id="profile-img-input"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleProfileImageChange}
          style={{ display: "none" }}
        />
        {imageUploading && (
          <span className="profile-avatar-uploading">⏳ กำลังอัปโหลด...</span>
        )}
        <span className="profile-avatar-hint">รองรับ PNG, JPG, WEBP (รูปจะแสดงในการ์ดผลลัพธ์)</span>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="profile-content">
        {/* Profile Info Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>ข้อมูลส่วนตัว</h2>
            {!editMode && (
              <button
                className="btn btn-secondary"
                onClick={() => setEditMode(true)}
              >
                แก้ไข
              </button>
            )}
          </div>

          {editMode ? (
            <form onSubmit={handleSubmitProfile} className="profile-form">
              <div className="form-group">
                <label>อีเมล</label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="profile-readonly-input"
                />
                <small>ไม่สามารถเปลี่ยนอีเมล</small>
              </div>

              <div className="form-group">
                <label>ชื่อเต็ม</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChangeProfile}
                />
              </div>

              <div className="form-group">
                <label>เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChangeProfile}
                  placeholder="0812345678"
                />
              </div>




              {profileData.user_type === "caregiver" && (
                <div className="form-group">
                  <label>รหัสผู้ดูแล (Caregiver ID)</label>
                  <input
                    type="text"
                    disabled
                    value={profileData.caregiver_id || "ยังไม่มีรหัสผู้ดูแล"}
                    className="profile-readonly-input"
                    placeholder="เช่น CG001"
                  />
                  <small>รหัสจากการลงทะเบียนผู้ดูแล เพื่อรับแจ้งเตือนเมื่อถูกจ้าง</small>
                </div>
              )}

              {profileData.user_type === "elder" && (
                <div className="form-group">
                  <label>รหัสผู้สูงอายุ (Elder ID)</label>
                  <input
                    type="text"
                    disabled
                    value={profileData.elder_id || "ยังไม่มีรหัสผู้สูงอายุ"}
                    className="profile-readonly-input"
                    placeholder="เช่น E001"
                  />
                  <small>รหัสจากการลงทะเบียนผู้สูงอายุ เพื่อดึงข้อมูลฟอร์มเดิมกลับมาเมื่อเข้าสู่ระบบอีกครั้ง</small>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  บันทึก
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditMode(false);
                    setFormData({
                      full_name: profileData.full_name,
                      phone: profileData.phone || "",
                      elder_id: profileData.elder_id || "",
                      caregiver_id: profileData.caregiver_id || "",
                    });
                    setProfileImagePreview(profileData.profile_image || profileData.avatar_url || "");
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-info">
              <div className="info-row">
                <span className="info-label">อีเมล:</span>
                <span className="info-value">{profileData.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label">ชื่อเต็ม:</span>
                <span className="info-value">{profileData.full_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">ประเภท:</span>
                <span className="info-value">
                  {profileData.user_type === "elder" ? "ผู้สูงอายุ" : "ผู้ดูแล"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">เบอร์โทรศัพท์:</span>
                <span className="info-value">
                  {profileData.phone || "ไม่ระบุ"}
                </span>
              </div>
              {profileData.user_type === "caregiver" && (
                <div className="info-row">
                  <span className="info-label">รหัสผู้ดูแล:</span>
                  <span className="info-value">
                    {profileData.caregiver_id
                      ? <strong className="profile-caregiver-id">{profileData.caregiver_id}</strong>
                      : <span className="profile-caregiver-missing">⚠️ ยังไม่ระบุ</span>}
                  </span>
                </div>
              )}
              {profileData.user_type === "elder" && (
                <div className="info-row">
                  <span className="info-label">รหัสผู้สูงอายุ:</span>
                  <span className="info-value">
                    {profileData.elder_id
                      ? <strong className="profile-caregiver-id">{profileData.elder_id}</strong>
                      : <span className="profile-caregiver-missing">ยังไม่ได้ระบุ</span>}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {profileData.user_type === "caregiver" && (
          <div className="profile-section profile-feedback-section">
            <div className="section-header">
              <h2>คะแนนและคอมเมนต์ล่าสุด</h2>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenReviews}
              >
                รีวิวทั้งหมด
              </button>
            </div>

            <div className="profile-feedback-summary">
              <div className="profile-feedback-score-card">
                <div className="profile-feedback-score">
                  {feedbackSummary?.average_rating ? feedbackSummary.average_rating.toFixed(1) : "0.0"}
                </div>
                <div className="profile-feedback-stars">
                  {renderStars(feedbackSummary?.average_rating)}
                </div>
                <div className="profile-feedback-meta">
                  จาก {feedbackSummary?.total_reviews || 0} รีวิว
                </div>
              </div>

              <div className="profile-feedback-comment-card">
                <div className="profile-feedback-comment-title">คอมเมนต์ล่าสุด</div>
                <div className="profile-feedback-comment-text">
                  {feedbackSummary?.latest_comment || "ยังไม่มีคอมเมนต์จากผู้ใช้"}
                </div>
                <div className="profile-feedback-comment-meta">
                  {feedbackSummary?.latest_rating ? `${feedbackSummary.latest_rating}/5 ดาว` : "ยังไม่มีคะแนน"}
                  {" • "}
                  {formatFeedbackDate(feedbackSummary?.latest_created_at)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── บัญชีรับเงิน (เฉพาะ Caregiver) ─── */}
        {profileData.user_type === "caregiver" && (
          <div className="profile-section" style={{ border: "2px solid #10b981", borderRadius: 16 }}>
            <div className="section-header">
              <h2 style={{ color: "#065f46" }}>💰 บัญชีรับเงิน</h2>
              {!payoutEdit && (
                <button className="btn btn-secondary" type="button" onClick={() => setPayoutEdit(true)}>แก้ไข</button>
              )}
            </div>
            <div style={{ background: "#ecfdf5", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#065f46" }}>
              🔐 หลังจบงาน แอดมินจะโอนเงิน <strong>หักค่าธรรมเนียม 10%</strong> ให้ตามบัญชีนี้
            </div>
            {payoutEdit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-group">
                  <label>📱 เบอร์ PromptPay (เบอร์โทร หรือ เลขบัตร)</label>
                  <input type="text" placeholder="เช่น 0812345678" value={payoutData.payout_promptpay}
                    onChange={e => setPayoutData(p => ({...p, payout_promptpay: e.target.value}))} />
                </div>
                <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13 }}>─ หรือกรอกบัญชีธนาคาร ─</div>
                <div className="form-group">
                  <label>🏦 ธนาคาร</label>
                  <select value={payoutData.payout_bank_name}
                    onChange={e => setPayoutData(p => ({...p, payout_bank_name: e.target.value}))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1fae5", fontSize: 14 }}>
                    <option value="">-- เลือกธนาคาร --</option>
                    {["กสิกรไทย (KBank)","กรุงไทย","กรุงเทพ","ไทยพาณิชย์ (SCB)","ออมสิน","ทหารไทยธนชาต (TTB)","ซีไอเอ็มบีไทย","ยูโอบี","กรุงศรีอยุธยา","เกียรตินาคินภัทร"].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>เลขบัญชีธนาคาร</label>
                  <input type="text" placeholder="เช่น 123-4-56789-0" value={payoutData.payout_bank_account}
                    onChange={e => setPayoutData(p => ({...p, payout_bank_account: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>ชื่อบัญชี (ภาษาไทย)</label>
                  <input type="text" placeholder="ชื่อ-นามสกุล ตามสมุดบัญชี" value={payoutData.payout_account_name}
                    onChange={e => setPayoutData(p => ({...p, payout_account_name: e.target.value}))} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" onClick={handleSavePayout} disabled={payoutSaving}>
                    {payoutSaving ? "⏳ กำลังบันทึก..." : "💾 บันทึกบัญชี"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setPayoutEdit(false)}>ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div className="profile-info">
                {payoutData.payout_promptpay ? (
                  <div className="info-row"><span className="info-label">📱 PromptPay:</span>
                    <span className="info-value"><strong>{payoutData.payout_promptpay}</strong></span></div>
                ) : null}
                {payoutData.payout_bank_name ? (
                  <>
                    <div className="info-row"><span className="info-label">🏦 ธนาคาร:</span><span className="info-value">{payoutData.payout_bank_name}</span></div>
                    <div className="info-row"><span className="info-label">เลขบัญชี:</span><span className="info-value">{payoutData.payout_bank_account}</span></div>
                    <div className="info-row"><span className="info-label">ชื่อบัญชี:</span><span className="info-value">{payoutData.payout_account_name}</span></div>
                  </>
                ) : null}
                {!payoutData.payout_promptpay && !payoutData.payout_bank_name && (
                  <div style={{ color: "#dc2626", fontWeight: 600, padding: "10px 0" }}>⚠️ ยังไม่ได้ลงทะเบียนบัญชีรับเงิน — กรุณากดแก้ไขเพื่อเพิ่ม</div>
                )}
              </div>
            )}
          </div>
        )}

        {reviewModal.isOpen && (
          <div
            className="modal-overlay"
            onClick={() => setReviewModal({ isOpen: false, reviews: [], loading: false })}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '720px',
                background: '#fff',
                borderRadius: '18px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>รีวิวทั้งหมด</div>
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>{feedbackSummary?.total_reviews || 0} รีวิว</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModal({ isOpen: false, reviews: [], loading: false })}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#374151',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ overflowY: 'auto', padding: '16px 24px' }}>
                {reviewModal.loading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#374151' }}>กำลังโหลดรีวิว...</div>
                ) : reviewModal.reviews.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>ไม่มีรีวิวให้แสดง</div>
                ) : (
                  reviewModal.reviews.map((review) => (
                    <div key={review.id} style={{ marginBottom: '16px', padding: '18px', borderRadius: '16px', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#111827' }}>{review.elder_name || 'ผู้สูงอายุ'}</div>
                        <div style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={iconStar} alt="คะแนน" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                          {review.rating || 0}
                        </div>
                      </div>
                      <div style={{ color: '#374151', marginBottom: '10px' }}>{review.comment || 'ไม่มีคอมเมนต์'}</div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>{new Date(review.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Change Password Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>เปลี่ยนรหัสผ่าน</h2>
            {!changePassMode && (
              <button
                className="btn btn-secondary"
                onClick={() => setChangePassMode(true)}
              >
                เปลี่ยนรหัสผ่าน
              </button>
            )}
          </div>

          {changePassMode && (
            <form onSubmit={handleSubmitPassword} className="profile-form">
              <div className="form-group">
                <label>รหัสผ่านเก่า</label>
                <input
                  type="password"
                  name="old_password"
                  value={passData.old_password}
                  onChange={handleChangePassword}
                  placeholder="กรอกรหัสผ่านเก่า"
                />
              </div>

              <div className="form-group">
                <label>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  name="new_password"
                  value={passData.new_password}
                  onChange={handleChangePassword}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>

              <div className="form-group">
                <label>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={passData.confirm_password}
                  onChange={handleChangePassword}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  เปลี่ยนรหัสผ่าน
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setChangePassMode(false);
                    setPassData({
                      old_password: "",
                      new_password: "",
                      confirm_password: "",
                    });
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}
