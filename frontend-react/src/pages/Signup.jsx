import { useState } from "react";
import { useAuth } from "../AuthContext";
import { signupUser } from "../api";

export default function Signup({ onBack, onSignupSuccess }) {
  const { login, setLoading, setError } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    user_type: "elder",
    phone: "",
  });
  const [localError, setLocalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLocalError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    
    // Validation
    if (!formData.email.trim()) {
      setLocalError("กรุณากรอกอีเมล");
      return;
    }
    if (!formData.password) {
      setLocalError("กรุณากรอกรหัสผ่าน");
      return;
    }
    if (formData.password.length < 6) {
      setLocalError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!formData.full_name.trim()) {
      setLocalError("กรุณากรอกชื่อเต็ม");
      return;
    }

    setIsLoading(true);
    try {
      const response = await signupUser({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        user_type: formData.user_type,
        phone: formData.phone.trim(),
      });

      // Automatically login after signup
      login(response.token, response.user);
      onSignupSuccess?.();
    } catch (err) {
      setLocalError(err.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">สมัครสมาชิก</h2>
        
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
            <label htmlFor="full_name">ชื่อเต็ม *</label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="ชื่อเต็มของคุณ"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="user_type">ประเภท *</label>
            <select
              id="user_type"
              name="user_type"
              value={formData.user_type}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="elder">ผู้สูงอายุ</option>
              <option value="caregiver">ผู้ดูแล</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="phone">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0812345678"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">รหัสผ่าน *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">ยืนยันรหัสผ่าน *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              disabled={isLoading}
            />
          </div>

          {localError && <div className="error-message">{localError}</div>}

          <button
            type="submit"
            className="btn btn-primary auth-btn"
            disabled={isLoading}
          >
            {isLoading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
          </button>

          <div className="auth-link">
            <p>
              มีบัญชีแล้ว?{" "}
              <span onClick={onBack} className="auth-link-action">
                เข้าสู่ระบบ
              </span>
            </p>
          </div>
        </form>
      </div>

    </div>
  );
}
