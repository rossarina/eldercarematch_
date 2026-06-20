import { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { createPayment, getPayment, getMyPayments, uploadPaymentSlip } from "../api";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import iconArrow from "../icon/arrow.png";
import iconCheckmark from "../icon/checkmark.png";
import iconCross from "../icon/cross.png";
import iconHourglass from "../icon/hourglass.png";

const STATUS_INFO = {
  held:            { text: "พักรอจบงาน",       color: "#b45309", bg: "#fef3c7", icon: iconHourglass },
  pending_confirm: { text: "อัปโหลดสลิปแล้ว",     color: "#7c3aed", bg: "#ede9fe", icon: iconCheckmark },
  released:        { text: "โอนให้ผู้ดูแลแล้ว", color: "#065f46", bg: "#d1fae5", icon: iconCheckmark },
  refunded:        { text: "คืนเงินแล้ว",      color: "#1e40af", bg: "#dbeafe", icon: iconCross },
};

const PROMPTPAY_ID = "0925027968";
const PROMPTPAY_NAME = "น.ส. รสริน อัษฎมงคลเลิศ";

export default function Payment({ hireRequestId, caregiverName, agreedWage, onBack, onPaid }) {
  const { user } = useAuth();
  const canvasRef = useRef(null);

  const [view, setView] = useState("qr");
  const [amount, setAmount] = useState(agreedWage || "");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState(null);
  const [myPayments, setMyPayments] = useState([]);
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // โหลดสถานะชำระเงินเดิม
  useEffect(() => {
    if (!hireRequestId) return;
    getPayment(hireRequestId)
      .then((d) => { if (d.payment) { setPayment(d.payment); setView("success"); } })
      .catch(() => {});
  }, [hireRequestId]);

  // โหลดประวัติ
  useEffect(() => {
    if (view === "history") {
      getMyPayments().then((d) => setMyPayments(d.payments || [])).catch(() => {});
    }
  }, [view]);

  // Generate QR เมื่อ amount เปลี่ยน
  useEffect(() => {
    if (!canvasRef.current) return;
    const parsedAmount = parseFloat(amount);

    // สร้าง payload PromptPay — ใส่ amount ถ้ามี, ไม่มีก็ยังใช้ได้
    const payload = isNaN(parsedAmount) || parsedAmount <= 0
      ? generatePayload(PROMPTPAY_ID, {})
      : generatePayload(PROMPTPAY_ID, { amount: parsedAmount });

    QRCode.toCanvas(canvasRef.current, payload, {
      width: 260,
      margin: 2,
      color: { dark: "#0d1b2a", light: "#ffffff" },
    });
  }, [amount]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const formatMoney = (val) =>
    new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(val);

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const handleSlipChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError("กรุณาระบุจำนวนเงิน"); return; }
    if (!slipFile) { setError("กรุณาแนบรูปสลิปการโอนเงิน"); return; }
    if (!hireRequestId) { setError("ไม่พบข้อมูลงาน (hireRequestId is null)"); return; }
    setUploading(true);
    setError("");
    try {
      console.log("[Payment] hireRequestId:", hireRequestId, "amount:", amount);

      // Step 1: สร้าง payment record
      let currentPayment = payment;
      if (!currentPayment) {
        console.log("[Payment] Creating payment record...");
        const created = await createPayment(hireRequestId, parseFloat(amount), "promptpay", note);
        console.log("[Payment] Created:", created);
        currentPayment = created.payment;
        setPayment(currentPayment);
      }

      // Step 2: อัปโหลดสลิป
      console.log("[Payment] Uploading slip...", slipFile.name);
      const result = await uploadPaymentSlip(hireRequestId, slipFile);
      console.log("[Payment] Upload result:", result);

      setPayment(result.payment);
      setView("success");
      showToast("อัปโหลดสลิปสำเร็จ! สามารถกลับไปจบงานได้ทันที");
      if (onPaid) onPaid(result.payment);
    } catch (err) {
      console.error("[Payment] Error:", err);
      setError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const statusInfo = payment ? (STATUS_INFO[payment.status] || { text: payment.status, color: "#6b7280", bg: "#f3f4f6" }) : null;
  const isElder = user?.user_type === "elder";

  return (
    <div className="payment-wrapper">
      {/* Header */}
      <div className="payment-header">
        <button className="ecm-back" type="button" onClick={onBack}>
          <img src={iconArrow} className="arrow-left" alt="" />ย้อนกลับ
        </button>
        <div className="payment-header-title">
          ชำระเงิน PromptPay
        </div>
        <button
          className="payment-history-btn"
          type="button"
          onClick={() => setView(view === "history" ? (payment ? "success" : "qr") : "history")}
        >
          {view === "history" ? "ชำระเงิน" : "ประวัติ"}
        </button>
      </div>

      {/* Escrow Banner */}
      <div className="payment-content">

      {toast && <div className="payment-toast">{toast}</div>}
      {error && <div className="payment-error">{error}</div>}

      {/* ── History ── */}
      {view === "history" && (
        <div className="payment-history">
          <h3 className="payment-section-title">📋 ประวัติการชำระเงิน</h3>
          {myPayments.length === 0 ? (
            <div className="payment-empty">ยังไม่มีประวัติการชำระเงิน</div>
          ) : (
            <div className="payment-history-list">
              {myPayments.map((p) => {
                const si = STATUS_INFO[p.status] || { text: p.status, color: "#6b7280", bg: "#f3f4f6" };
                return (
                  <div key={p.id} className="payment-history-card">
                    <div className="payment-history-row">
                      <span className="payment-history-amount">{formatMoney(p.amount)}</span>
                      <span className="payment-status-badge" style={{ color: si.color, background: si.bg }}>
                        <img src={si.icon} alt="" className="payment-status-icon" />
                        <span>{si.text}</span>
                      </span>
                    </div>
                    <div className="payment-history-meta">
                      {isElder ? `ผู้ดูแล: ${p.caregiver_name || p.caregiver_sheet_id}` : `ผู้จ้าง: ${p.elder_name}`}
                    </div>
                    <div className="payment-history-meta">ชำระ: {p.held_at ? formatDate(p.held_at) : "-"}</div>
                    {p.slip_url && (
                      <a href={p.slip_url} target="_blank" rel="noreferrer" className="payment-slip-link">📎 ดูสลิป</a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Success ── */}
      {view === "success" && payment && (
        <div className="payment-success-view">
          <div className="payment-success-icon">
            {payment.status === "released" ? "✅" : payment.status === "pending_confirm" ? "⏳" : "🔒"}
          </div>
          <h2 className="payment-success-title">
            {payment.status === "released" ? "โอนเงินให้ผู้ดูแลแล้ว!"
             : payment.status === "pending_confirm" ? "อัปโหลดสลิปแล้ว"
             : "ชำระเงินสำเร็จ!"}
          </h2>
          <p className="payment-success-sub">
            {payment.status === "released"
              ? "เงินถูกโอนให้ผู้ดูแลหลังงานเสร็จสิ้น"
              : payment.status === "pending_confirm"
              ? "ระบบได้รับสลิปแล้ว สามารถกลับไปจบงานได้ทันที"
              : "เงินพักรออยู่ที่ระบบ จะโอนให้ผู้ดูแลเมื่อจบงาน"}
          </p>

          {payment.slip_url && (
            <div className="payment-slip-preview-box">
              <div className="payment-slip-label">📎 สลิปการโอนเงิน</div>
              <img src={payment.slip_url} alt="สลิป" className="payment-slip-img" />
              <a href={payment.slip_url} target="_blank" rel="noreferrer" className="payment-slip-link">เปิดในแท็บใหม่</a>
            </div>
          )}

          <div className="payment-receipt">
            <div className="payment-receipt-title">ใบเสร็จการชำระเงิน</div>
            <div className="payment-receipt-row">
              <span>จำนวนเงิน</span>
              <span className="payment-receipt-amount">{formatMoney(payment.amount)}</span>
            </div>
            <div className="payment-receipt-row">
              <span>ผู้ดูแล</span>
              <span>{payment.caregiver_name || payment.caregiver_sheet_id}</span>
            </div>
            <div className="payment-receipt-row">
              <span>วิธีชำระ</span>
              <span>📱 PromptPay</span>
            </div>
            <div className="payment-receipt-row">
              <span>วันที่ชำระ</span>
              <span>{payment.held_at ? formatDate(payment.held_at) : "-"}</span>
            </div>
            {payment.released_at && (
              <div className="payment-receipt-row">
                <span>วันที่โอน</span>
                <span>{formatDate(payment.released_at)}</span>
              </div>
            )}
            <div className="payment-receipt-row payment-receipt-status">
              <span>สถานะ</span>
              <span className="payment-status-badge" style={{ color: statusInfo?.color, background: statusInfo?.bg }}>
                {statusInfo?.text}
              </span>
            </div>
          </div>

          {payment.status === "pending_confirm" && isElder && (
            <div className="payment-confirm-section">
              <p className="payment-confirm-desc">✅ ระบบได้รับสลิปแล้ว สามารถกลับไปจบงานได้ทันที</p>
              <button type="button" className="payment-submit-btn" onClick={onBack}>
                กลับไปหน้าแชท
              </button>
            </div>
          )}

          {payment.status === "held" && (
            <div className="payment-held-notice">
              <span>⏳</span>
              <span>เงินพักรออยู่ที่ระบบ จะโอนให้ผู้ดูแลโดยอัตโนมัติเมื่อกด <strong>"จบงาน"</strong> ในหน้าแชท</span>
            </div>
          )}
        </div>
      )}

      {/* ── QR + Upload ── */}
      {view === "qr" && (
        <div className="payment-form-view">

          {/* ผู้รับเงิน */}
          <div className="payment-job-card">
            <div className="payment-job-label">โอนเงินให้ผู้ดูแล</div>
            <div className="payment-job-name">{caregiverName || "ผู้ดูแล"}</div>
            <div className="payment-promptpay-account">
              <div>
                <div className="pp-name">{PROMPTPAY_NAME}</div>
                <div className="pp-number">092-502-7968</div>
              </div>
            </div>
          </div>

          {/* จำนวนเงิน */}
          <div className="payment-field">
            <label className="payment-label">จำนวนเงินที่ต้องโอน *</label>
            <div className="payment-amount-wrapper">
              <span className="payment-currency">฿</span>
              <input
                id="payment-amount"
                type="number"
                className="payment-input payment-amount-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ระบุจำนวนเงิน"
                min="1"
              />
            </div>
            {agreedWage && (
              <button type="button" className="payment-fill-wage" onClick={() => setAmount(agreedWage)}>
                ใช้ค่าตกลง {formatMoney(agreedWage)}
              </button>
            )}
          </div>

          {/* QR Code — Generate จาก promptpay-qr */}
          <div className="payment-qr-section">
            <div className="payment-qr-title">
              สแกน QR ด้วยแอปธนาคาร
              {amount && parseFloat(amount) > 0 && (
                <span className="payment-qr-amount-badge"> — {formatMoney(parseFloat(amount))}</span>
              )}
            </div>
            <div className="payment-qr-card">
              <div className="payment-qr-logo">
                <span>PromptPay</span>
              </div>

              {/* canvas ที่ QRCode.toCanvas วาดลงไป */}
              <canvas ref={canvasRef} className="payment-qr-canvas" />

              <div className="payment-qr-recipient">
                <div className="payment-qr-name">{PROMPTPAY_NAME}</div>
                <div className="payment-qr-number">092-502-7968</div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="payment-qr-amount">{formatMoney(parseFloat(amount))}</div>
                )}
              </div>

              <div className="payment-qr-hint">
                {amount && parseFloat(amount) > 0
                  ? "QR นี้ฝังจำนวนเงินไว้แล้ว — สแกนและยืนยันได้เลย"
                  : "ระบุจำนวนเงินด้านบนเพื่อฝังในคิวอาร์"}
              </div>
            </div>
          </div>

          {/* หมายเหตุ */}
          <div className="payment-field">
            <label className="payment-label">หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              className="payment-textarea"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ค่าดูแลเดือนพฤษภาคม"
            />
          </div>

          {/* Upload Slip */}
          <div className="payment-field">
            <label className="payment-label">แนบสลิปการโอนเงิน *</label>
            <label className="payment-slip-upload-zone" htmlFor="slip-input">
              {slipPreview ? (
                <div className="payment-slip-preview-inline">
                  <img src={slipPreview} alt="สลิป" className="payment-slip-preview-img" />
                  <span className="payment-slip-change">🔄 เปลี่ยนรูป</span>
                </div>
              ) : (
                <div className="payment-slip-placeholder">
                  <span className="payment-slip-upload-icon">📷</span>
                  <span>กดเพื่อแนบรูปสลิป</span>
                  <span className="payment-slip-formats">PNG, JPG, JPEG, WEBP</span>
                </div>
              )}
              <input
                id="slip-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                style={{ display: "none" }}
                onChange={handleSlipChange}
              />
            </label>
          </div>

          <button
            id="payment-submit-btn"
            type="button"
            className="payment-submit-btn"
            onClick={handleSubmit}
            disabled={uploading || !amount || parseFloat(amount) <= 0 || !slipFile}
          >
            {uploading ? "⏳ กำลังส่งสลิป..." : "📤 ส่งสลิปยืนยันการชำระเงิน"}
          </button>

          <div className="payment-steps-guide">
            <div className="payment-step-item"><span className="ps-num">1</span><span>ใส่จำนวนเงิน — QR จะ generate ให้อัตโนมัติ</span></div>
            <div className="payment-step-item"><span className="ps-num">2</span><span>เปิดแอปธนาคาร สแกน QR แล้วยืนยันการโอน</span></div>
            <div className="payment-step-item"><span className="ps-num">3</span><span>ถ่ายหรือ screenshot สลิปแล้วแนบด้านบน</span></div>
            <div className="payment-step-item"><span className="ps-num">4</span><span>กดส่งสลิป — เงินจะพักรอจนงานเสร็จ</span></div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
