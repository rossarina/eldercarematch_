// Hook สำหรับจัดการ Form Data ตามแต่ละบัญชี
// ข้อมูลจะถูกเก็บใน localStorage โดยใช้ email เป็น key

export function useFormStorage(type, defaults) {
  // type: 'elder' หรือ 'caregiver'
  // defaults: ค่าเริ่มต้นของฟอร์ม

  const getStorageKey = (email) => {
    if (!email) return null;
    return `form_${type}_${email}`;
  };

  const loadFormData = (email) => {
    if (!email) return defaults;
    
    const key = getStorageKey(email);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn(`Failed to load form data: ${err}`);
    }
    return defaults;
  };

  const saveFormData = (email, formData) => {
    if (!email) return;

    const key = getStorageKey(email);
    try {
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (err) {
      console.warn(`Failed to save form data: ${err}`);
    }
  };

  const clearFormData = (email) => {
    if (!email) return;

    const key = getStorageKey(email);
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`Failed to clear form data: ${err}`);
    }
  };

  return {
    loadFormData,
    saveFormData,
    clearFormData,
  };
}
