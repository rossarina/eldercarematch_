import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";

/**
 * หน้านี้รับ token จาก backend หลัง Google OAuth callback
 * URL: /google-callback?token=xxx&is_new=true/false
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export default function GoogleCallback({ onSuccess }) {
  const { login } = useAuth();
  const [status, setStatus] = useState("กำลังยืนยันบัญชี Google...");
  const [isNewUser, setIsNewUser] = useState(false);
  const [userType, setUserType] = useState("elder");
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Extract query parameters from hash (e.g. #google-callback?token=123)
    const hash = window.location.hash;
    const queryString = hash.includes("?") ? hash.substring(hash.indexOf("?")) : window.location.search;
    const params = new URLSearchParams(queryString);
    
    const googleError = params.get("google_error");
    const jwtToken = params.get("token");
    const newUser = params.get("is_new") === "true";

    if (googleError) {
      const messages = {
        access_denied: "คุณปฏิเสธการเข้าสู่ระบบด้วย Google",
        no_token: "ไม่สามารถรับ token จาก Google ได้",
        no_email: "ไม่พบอีเมลจากบัญชี Google",
        account_disabled: "บัญชีนี้ถูกปิดใช้งาน",
        server_error: "เกิดข้อผิดพลาดจาก server",
      };
      setStatus(messages[googleError] || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      return;
    }

    if (!jwtToken) {
      setStatus("ไม่พบ token กรุณาลองเข้าสู่ระบบอีกครั้ง");
      return;
    }

    setToken(jwtToken);
    setIsNewUser(newUser);

    if (newUser) {
      // ผู้ใช้ใหม่ — ให้เลือกประเภทบัญชีก่อน
      setStatus("ยินดีต้อนรับ! กรุณาเลือกประเภทบัญชีของคุณ");
      setShowTypeSelect(true);
    } else {
      // ผู้ใช้เดิม — login ทันที
      finishLogin(jwtToken);
    }
  }, []);

  const finishLogin = async (jwtToken) => {
    try {
      // Decode token to get user info (or fetch profile)
      const response = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const data = await response.json();
      if (data.ok) {
        login(jwtToken, data.user);
        // Clear URL params
        window.history.replaceState({}, document.title, "/");
        onSuccess?.();
      }
    } catch {
      setStatus("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleTypeSelect = async () => {
    // Update user type via API
    try {
      await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_type: userType }),
      });
    } catch {}
    finishLogin(token);
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: "center" }}>
        {showTypeSelect ? (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
            <h2 className="auth-title">ยินดีต้อนรับ!</h2>
            <p style={{ color: "#9ca3af", marginBottom: "24px" }}>
              คุณเข้าสู่ระบบด้วย Google สำเร็จแล้ว<br />
              กรุณาเลือกประเภทบัญชีของคุณ
            </p>

            <div className="form-group">
              <label>ฉันเป็น *</label>
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #374151", background: "#1f2937", color: "white", fontSize: "16px" }}
              >
                <option value="elder">ผู้สูงอายุ / ครอบครัวที่ต้องการผู้ดูแล</option>
                <option value="caregiver">ผู้ดูแลผู้สูงอายุ</option>
              </select>
            </div>

            <button
              className="btn btn-primary auth-btn"
              onClick={handleTypeSelect}
              style={{ marginTop: "16px" }}
            >
              เริ่มใช้งาน →
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "4px solid #6366f1",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
            </div>
            <p style={{ color: "#9ca3af" }}>{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
