import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { loginUser, googleLoginWithToken } from "../api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function Login({ onLoginSuccess, onSignupClick }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [localError, setLocalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Load Google script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLocalError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!formData.email.trim()) { setLocalError("กรุณากรอกอีเมล"); return; }
    if (!formData.password) { setLocalError("กรุณากรอกรหัสผ่าน"); return; }

    setIsLoading(true);
    try {
      const response = await loginUser({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      login(response.token, response.user);
      onLoginSuccess?.();
    } catch (err) {
      setLocalError(err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setIsLoading(false);
    }
  };

  // Google One Tap / redirect flow
  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">เข้าสู่ระบบ</h2>

        {/* Google Login Button */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={isLoading || googleLoading}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: "10px", flexShrink: 0 }}>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          </svg>
          {googleLoading ? "กำลังเชื่อมต่อ Google..." : "เข้าสู่ระบบด้วย Google"}
        </button>

        <div className="auth-divider">
          <span>หรือ</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">อีเมล *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">รหัสผ่าน *</label>
            <div className="password-input-wrap">
              <input
                type={showPass ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="กรอกรหัสผ่าน"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPass((prev) => !prev)}
                tabIndex={-1}
              >
                {showPass ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          {localError && <div className="error-message">{localError}</div>}

          <button
            type="submit"
            className="btn btn-primary auth-btn"
            disabled={isLoading}
          >
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          <div className="auth-link">
            <p>
              ยังไม่มีบัญชี?{" "}
              <span onClick={onSignupClick} className="auth-link-action">
                สมัครสมาชิก
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
