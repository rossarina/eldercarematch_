import { useState, useEffect, useContext, createContext } from "react";
import { getProfile } from "./api";

// Create Auth Context
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("authUser");
      if (saved === "undefined" || saved === "null") return null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem("authToken");
    if (!savedToken || savedToken === "undefined" || savedToken === "null") return null;
    return savedToken;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // เมื่อมี token แต่ไม่มี user → ดึงข้อมูล profile จาก backend
  useEffect(() => {
    if (!token || token === "undefined" || token === "null") {
      if (localStorage.getItem("authToken")) {
        logout();
      }
      return;
    }
    
    // ตรวจสอบ token เสมอถ้ามีการโหลดหน้าเว็บใหม่
    getProfile()
      .then((data) => {
        if (!user) {
          setUser(data.user);
        }
        localStorage.setItem("authUser", JSON.stringify(data.user));
      })
      .catch(() => {
        // token หมดอายุ ล้าง session
        logout();
      });
  }, [token]);

  const login = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem("authToken", newToken);
    localStorage.setItem("authUser", JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem("authUser", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        logout,
        updateUser,
        setLoading,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
