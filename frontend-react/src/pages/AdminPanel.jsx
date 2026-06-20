import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export default function AdminPanel({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "เข้าสู่ระบบไม่สำเร็จ");
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminUser", JSON.stringify(data.admin));
      onLoginSuccess(data.admin, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adm-login-wrap">
      <div className="adm-login-bg">
        <div className="adm-orb adm-orb-1" />
        <div className="adm-orb adm-orb-2" />
        <div className="adm-orb adm-orb-3" />
      </div>

      <div className="adm-login-card">
        {/* Logo */}
        <div className="adm-login-logo">
          <div className="adm-login-logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <circle cx="20" cy="20" r="20" fill="url(#adminGrad)" />
              <path d="M12 20l5 5 11-11" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="var(--primary)" />
                  <stop offset="1" stopColor="var(--accent)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="adm-login-brand">ElderCareMatch</div>
            <div className="adm-login-subtitle">Admin Control Panel</div>
          </div>
        </div>

        <h1 className="adm-login-title">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="adm-login-desc">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ</p>

        {error && (
          <div className="adm-error-banner">
            <span className="adm-error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="adm-login-form">
          <div className="adm-field">
            <label className="adm-label">อีเมล</label>
            <div className="adm-input-wrap">
              <span className="adm-input-icon">✉</span>
              <input
                id="admin-email"
                type="email"
                className="adm-input"
                placeholder="admin@eldercare.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">รหัสผ่าน</label>
            <div className="adm-input-wrap">
              <span className="adm-input-icon">🔒</span>
              <input
                id="admin-password"
                type={showPass ? "text" : "password"}
                className="adm-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="adm-show-pass"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="admin-login-btn"
            className="adm-login-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="adm-spin-wrap"><span className="adm-spinner" />กำลังเข้าสู่ระบบ...</span>
            ) : (
              "เข้าสู่ระบบ Admin"
            )}
          </button>
        </form>

        <div className="adm-login-footer">
          <span>🔐 Secured Admin Access</span>
          <span>ElderCareMatch © 2026</span>
        </div>
      </div>
    </div>
  );
}
