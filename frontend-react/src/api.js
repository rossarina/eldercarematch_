const API_BASE_URL = import.meta.env.DEV ? "/api" : "https://eldercare-backend-40ad.onrender.com/api";
async function request(path, options = {}) {
  const token = localStorage.getItem("authToken");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export function signupUser(payload) {
  return request("/auth/signup", { method: "POST", body: JSON.stringify(payload) });
}

export function loginUser(payload) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function googleLoginWithToken(credential, user_type) {
  return request("/auth/google/token", {
    method: "POST",
    body: JSON.stringify({ credential, user_type }),
  });
}

export function getProfile() {
  return request("/auth/profile", { method: "GET" });
}

export function updateProfile(payload) {
  return request("/auth/profile", { method: "PUT", body: JSON.stringify(payload) });
}

export async function uploadProfileImage(formData) {
  const token = localStorage.getItem("authToken");
  const response = await fetch(`${API_BASE_URL}/auth/profile/image`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export function changePassword(payload) {
  return request("/auth/change-password", { method: "POST", body: JSON.stringify(payload) });
}

// ── Config / Matching ─────────────────────────────────────────────────────────
export function fetchConfig() {
  return request("/config");
}

export function registerCaregiver(payload) {
  return request("/caregivers/register", { method: "POST", body: JSON.stringify(payload) });
}

export function getMyCaregiverProfile() {
  return request("/caregivers/me", { method: "GET" });
}

export function getMyElderProfile() {
  return request("/elders/me", { method: "GET" });
}

export function matchElder(payload) {
  return request("/elders/match", { method: "POST", body: JSON.stringify(payload) });
}

// ── Hire / Notifications ──────────────────────────────────────────────────────
/** Elder ส่งคำขอจ้าง */
export function hireCaregiver(caregiverId, message = "") {
  return request("/hire", {
    method: "POST",
    body: JSON.stringify({ caregiver_id: caregiverId, message }),
  });
}

/** ดึง notifications ของ user ที่ login อยู่ */
export function getNotifications() {
  return request("/notifications", { method: "GET" });
}

export function markNotificationsRead() {
  return request("/notifications/read", { method: "PUT" });
}

/** Caregiver ตอบรับหรือปฏิเสธ */
export function respondHire(hireId, action) {
  return request(`/hire/${hireId}/respond`, {
    method: "PUT",
    body: JSON.stringify({ action }),
  });
}

// ── Chat ──────────────────────────────────────────────────────────────────────
/** รายการห้องแชทของ user */
export function getChatRooms() {
  return request("/chat", { method: "GET" });
}

/** ดึงข้อความในห้องแชท */
export function getChatMessages(roomId) {
  return request(`/chat/${roomId}`, { method: "GET" });
}

/** ส่งข้อความ */
export function sendChatMessage(roomId, message) {
  return request(`/chat/${roomId}`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/** ส่งรูปภาพและข้อความ */
export async function sendChatImage(roomId, imageFile, message = "") {
  const token = localStorage.getItem("authToken");
  const formData = new FormData();
  formData.append("image", imageFile);
  if (message) formData.append("message", message);

  const response = await fetch(`${API_BASE_URL}/chat/${roomId}/upload_image`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "Request failed");
  return data;
}

/** ปิดงาน — หลังจากนี้จะแชทไม่ได้ */
export function completeHire(hireId) {
  return request(`/hire/${hireId}/complete`, { method: "PUT" });
}

/** Elder ยื่นคำขอจบงานให้ผู้ดูแลยืนยัน */
export function requestCompleteHire(hireId) {
  return request(`/hire/${hireId}/request-complete`, { method: "PUT" });
}

/** Elder ส่งรีวิวหลังจบงาน */
export function submitFeedback(payload) {
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** ดึงข้อมูลรีวิวของผู้ดูแล */
export function getCaregiverReviews(caregiverId) {
  return request(`/caregivers/${caregiverId}/reviews`, { method: "GET" });
}

// ── Payment (Escrow) ──────────────────────────────────────────────────────────
/** Elder สร้างการชำระเงิน Escrow */
export function createPayment(hireRequestId, amount, paymentMethod = "platform", note = "") {
  return request("/payment/create", {
    method: "POST",
    body: JSON.stringify({
      hire_request_id: hireRequestId,
      amount,
      payment_method: paymentMethod,
      note,
    }),
  });
}

/** ดึงสถานะการชำระเงินของงาน */
export function getPayment(hireId) {
  return request(`/payment/${hireId}`, { method: "GET" });
}

/** Release เงินให้ caregiver (manual - สำหรับ admin) */
export function releasePayment(hireId) {
  return request(`/payment/${hireId}/release`, { method: "PUT" });
}

/** ดึงรายการชำระเงินของตัวเอง */
export function getMyPayments() {
  return request("/payment/my", { method: "GET" });
}

/** Elder อัปโหลดสลิป PromptPay */
export async function uploadPaymentSlip(hireId, slipFile) {
  const token = localStorage.getItem("authToken");
  const formData = new FormData();
  formData.append("slip", slipFile);
  const response = await fetch(`${API_BASE_URL}/payment/${hireId}/slip`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "Request failed");
  return data;
}

/** ยืนยันการรับเงิน (Elder/Admin) */
export function confirmPaymentSlip(hireId) {
  return request(`/payment/${hireId}/confirm-slip`, { method: "PUT" });
}

// ============================================================================
// Support Chat API
// ============================================================================

export async function getMySupportChat(markRead = false) {
  return request(`/support/chat${markRead ? "?mark_read=true" : ""}`, { method: "GET" });
}

export async function sendSupportMessage(message, imageUrl = null) {
  return request("/support/chat", {
    method: "POST",
    body: JSON.stringify({ message, image_url: imageUrl }),
  });
}

// Admin Support Chat APIs
export async function getAdminSupportChats() {
  return adminRequest("/admin/support/chats", { method: "GET" });
}

export async function getAdminSupportChat(roomId) {
  return adminRequest(`/admin/support/chats/${roomId}`, { method: "GET" });
}

export async function adminSendSupportMessage(roomId, message, imageUrl = null) {
  return adminRequest(`/admin/support/chats/${roomId}`, {
    method: "POST",
    body: JSON.stringify({ message, image_url: imageUrl }),
  });
}
