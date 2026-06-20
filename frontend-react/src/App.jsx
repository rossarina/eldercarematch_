import { useEffect, useMemo, useRef, useState } from "react";
import { fetchConfig, matchElder, registerCaregiver, hireCaregiver, getNotifications, getMyCaregiverProfile, getMyElderProfile, getCaregiverReviews } from "./api.js";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Chat from "./pages/Chat";
import AdminPanel from "./pages/AdminPanel";
import AdminDashboard from "./pages/AdminDashboard";
import GoogleCallback from "./pages/GoogleCallback";
import { useFormStorage } from "./useFormStorage";
import SupportChatWidget from "./components/SupportChatWidget";
import iconPeople from "./icon/people.png";
import iconAi from "./icon/ai.png";
import iconHandshake from "./icon/handshake.png";
import iconCharity from "./icon/charity.png";
import iconForm from "./icon/form.png";
import iconSearch from "./icon/search.png";
import iconPin from "./icon/pin.png";
import iconDollar from "./icon/dollar.png";
import iconBell from "./icon/bell.png";
import iconRightArrow from "./icon/right-arrow.png";
import iconArrow from "./icon/arrow.png";
import iconPerson from "./icon/person.png";
import iconStar from "./icon/star.png";
import picHero1 from "./pic/1.png";
import picHero2 from "./pic/2.png";


const ROUTES = {
  home: "home",
  elder: "elder",
  caregiver: "caregiver",
  elderResults: "elder-results",
  login: "login",
  signup: "signup",
  profile: "profile",
  notifications: "notifications",
  chat: "chat",
  admin: "admin",
};


const elderDefaults = {
  gender: "",
  age: "",
  location: "",
  care_time: "",
  wage_range: ["", ""],
  model: "random_forest",
  preferences: [],
  adl_scores: {
    v1: null,
    v2: null,
    v3: null,
    v4: null,
    v5: null,
    v6: null,
    v7: null,
    v8: null,
  },
};

const caregiverDefaults = {
  gender: "",
  age: "",
  location: "",
  care_time: "",
  wage: "",
  experience_years: "",
  course: "",
  skills: {
    feeding: null,
    bathing: null,
    dressing: null,
    toileting: null,
    transfer: null,
    wheelchair: null,
    wound_care: null,
    tube_feeding: null,
    medication: null,
    dementia: null,
    companionship: null,
  },
};

const homeSteps = [
  {
    icon: iconPeople,
    title: "ลงทะเบียนและสร้างโปรไฟล์",
    desc: "กรอกข้อมูลพื้นฐานของผู้สูงอายุ<br>ADL Score พร้อมความต้องการ<br>ในการดูแลที่เฉพาะเจาะจง",
  },
  {
    icon: iconAi,
    title: "AI วิเคราะห์และจับคู่",
    desc: "ระบบ Machine Learning<br>วิเคราะห์ข้อมูลจากหลายปัจจัย<br>เพื่อค้นหาผู้ดูแลที่เหมาะสม",
  },
  {
    icon: iconHandshake,
    title: "เลือกและยืนยันผู้ดูแล",
    desc: "ดูโปรไฟล์ Top 5<br>เปรียบเทียบและเลือกผู้ดูแล<br>ที่เหมาะสมที่สุดสำหรับคุณ",
  },
  {
    icon: iconCharity,
    title: "รับบริการและให้ Feedback",
    desc: "ดูแลผู้สูงอายุอย่างต่อเนื่อง<br>พร้อมประเมินผลการดูแล<br>ผ่านระบบ AI ที่พัฒนาตลอดเวลา",
  },
];

const mlFeatures = [
  {
    icon: iconForm,
    title: "ประเมินศักยภาพ ADL",
    desc: "วิเคราะห์ความสามารถในการช่วยเหลือตัวเอง เพื่อวัดความต้องการดูแลที่เหมาะสม",
  },
  {
    icon: iconSearch,
    title: "คัดกรองทักษะเฉพาะทาง",
    desc: "จับคู่ทักษะผู้ดูแลให้ตรงกับความต้องการของผู้สูงอายุแต่ละราย",
  },
  {
    icon: iconPin,
    title: "ค้นหาตามระยะทาง",
    desc: "คัดเลือกผู้ดูแลใกล้บ้าน เพื่อความสะดวกและรวดเร็ว",
  },
  {
    icon: iconDollar,
    title: "คัดเลือกตามงบประมาณ",
    desc: "เลือกผู้ดูแลที่เหมาะสมภายในงบที่กำหนดได้",
  },
];

const preferenceOptions = [
  { value: "skill_precision", label: "เน้นทักษะตรงกัน" },
  { value: "nearby_first", label: "เน้นระยะทางใกล้" },
];

const caregiverSkillOptions = [
  ["feeding", "ป้อนอาหาร"],
  ["bathing", "อาบน้ำ"],
  ["dressing", "แต่งตัว"],
  ["toileting", "เข้าห้องน้ำ"],
  ["transfer", "เคลื่อนย้าย"],
  ["wheelchair", "รถเข็น"],
];

const caregiverTrainingOptions = [
  { value: "ไม่เคยผ่านการอบรม", label: "ไม่เคยผ่านการอบรม" },
  { value: "70ชม", label: "หลักสูตรพื้นฐาน (70 ชั่วโมง)" },
  { value: "420ชม", label: "หลักสูตรขั้นสูง (420 ชั่วโมง)" },
];

const caregiverBinaryQuestions = [
  { key: "feeding", title: "คุณสามารถป้อนอาหารให้ผู้สูงอายุได้หรือไม่?" },
  { key: "bathing", title: "คุณสามารถอาบน้ำให้ผู้สูงอายุได้หรือไม่?" },
  { key: "dressing", title: "คุณสามารถช่วยแต่งตัวให้ผู้สูงอายุได้หรือไม่?" },
  { key: "toileting", title: "คุณสามารถช่วยผู้สูงอายุเข้าห้องน้ำได้หรือไม่?" },
  { key: "transfer", title: "คุณสามารถช่วยเคลื่อนย้ายตัวผู้สูงอายุ (เช่น จากเตียงไปเก้าอี้) ได้หรือไม่?" },
  { key: "wheelchair", title: "คุณสามารถใช้หรือเข็นรถเข็นให้ผู้สูงอายุได้หรือไม่?" },
  { key: "wound_care", title: "คุณสามารถดูแลแผลให้ผู้สูงอายุได้หรือไม่?" },
  { key: "tube_feeding", title: "คุณสามารถให้อาหารทางสายยางได้หรือไม่?" },
  { key: "medication", title: "คุณสามารถจัดยา หรือเตือนให้ผู้สูงอายุกินยาได้หรือไม่?" },
  { key: "dementia", title: "คุณสามารถดูแลผู้สูงอายุที่มีภาวะสมองเสื่อมได้หรือไม่?" },
  { key: "companionship", title: "คุณสามารถพูดคุย ดูแล และให้กำลังใจผู้สูงอายุได้หรือไม่?" },
];

const elderAdlQuestions = [
  {
    key: "v1",
    title: "รับประทานอาหารเมื่อเตรียมสํารับไว้ให้เรียบร้อยต่อหน้า",
    options: [
      { value: 0, label: "ไม่สามารถตักอาหารเข้าปากได้ ต้องมีคนป้อนให้" },
      { value: 1, label: "ตักอาหารเองได้แต่ต้องมีคนช่วย เช่น ใช้ช้อนตักเตรียมไว้ให้หรือตัดเป็นเล็กๆ ไว้ล่วงหน้า" },
      { value: 2, label: "ตักอาหารและช่วยเหลือตัวเองได้เป็นปกติ" },
    ],
  },
  {
    key: "v2",
    title: "ล้างหน้า หวีผม แปรงฟัน โกนหนวด ในระยะเวลา 24-28 ชั่วโมงที่ผ่านมา",
    options: [
      { value: 0, label: "ต้องการความช่วยเหลือ" },
      { value: 1, label: "ทําเองได้ (รวมทั้งที่ทําได้เอง ถ้าเตรียมอุปกรณ์ไว้ให้)" },
    ],
  },
  {
    key: "v3",
    title: "ลุกนั่งจากที่นอน หรือเตียงไปยังเก้าอี้",
    options: [
      { value: 0, label: "ไม่สามารถนั่งได้ (นั่งแล้วจะล้มเสมอ) หรือต้องใช้คนสองคนช่วยกันยกขึ้น" },
      { value: 1, label: "ต้องการความช่วยเหลืออย่างมากจึงจะนั่งได้ เช่น ต้องใช้คนที่แข็งแรงหรือมีทักษะ 1 คน หรือใช้คนทั่วไป 2 คน พยุงหรือดันขึ้นมาจึงจะนั่งอยู่ได้" },
      { value: 2, label: "ต้องการความช่วยเหลือบ้าง เช่น บอกให้ทําตาม หรือช่วยพยุงเล็กน้อย หรือต้องมีคนดูแลเพื่อความปลอดภัย" },
      { value: 3, label: "ทําเองได้" },
    ],
  },
  {
    key: "v4",
    title: "ใช้ห้องนํ้า",
    options: [
      { value: 0, label: "ช่วยตัวเองไม่ได้" },
      { value: 1, label: "ทําเองได้บ้าง (อย่างน้อยทําความสะอาดตัวเองได้หลังจากเสร็จธุระ) แต่ต้องการช่วยเหลือในบางสิ่ง" },
      { value: 2, label: "ช่วยตัวเองได้ดี (ขึ้นนั่งและลงจากโถส้วมเองได้ ทําความสะอาดได้เรียบร้อย หลังจากเสร็จธุระถอดใส่เสื้อผ้าได้เรียบร้อย)" },
    ],
  },
  {
    key: "v5",
    title: "การเคลื่อนที่ภายในห้องหรือบ้าน",
    options: [
      { value: 0, label: "เคลื่อนที่ไปไหนไม่ได้" },
      { value: 1, label: "ต้องใช้รถเข็นช่วยตัวเองให้เคลื่อนที่ (ไม่ต้องมีคนเข็นให้) และจะต้องเข้าออกมุมห้องหรือประตูได้" },
      { value: 2, label: "เดินหรือเคลื่อนที่โดยมีคนช่วย เช่น พยุง หรือบอกให้ทําตาม หรือต้องให้ความสนใจดูแล เพื่อความปลอดภัย" },
      { value: 3, label: "เดินหรือเคลื่อนที่เองได้" },
    ],
  },
  {
    key: "v6",
    title: "การสวมใส่เสื้อผ้า",
    options: [
      { value: 0, label: "ต้องมีคนสวมใส่ให้ ช่วยตัวเองแทบไม่ได้ หรือได้น้อย" },
      { value: 1, label: "ช่วยตัวเองได้ประมาณร้อยละ 50 ที่เหลือต้องมีคนช่วย" },
      { value: 2, label: "ช่วยตัวเองได้ดี รวมทั้งติดกระดุม รูดซิบ หรือสวมใส่เสื้อผ้าเองได้ (รวมถึงเสื้อผ้าที่ดัดแปลงให้เหมาะสม)" },
    ],
  },
  {
    key: "v7",
    title: "การขึ้นลงบันได 1 ชั้น",
    options: [
      { value: 0, label: "ไม่สามารถทําได้" },
      { value: 1, label: "ต้องการคนช่วย" },
      { value: 2, label: "ขึ้นลงเองได้ (ถ้าต้องใช้เครื่องช่วยเดิน เช่น walker จะต้องเอาขึ้นลงได้ด้วย)" },
    ],
  },
  {
    key: "v8",
    title: "การอาบนํ้า",
    options: [
      { value: 0, label: "ต้องมีคนช่วยหรือทําให้" },
      { value: 1, label: "อาบนํ้าเองได้" },
    ],
  },
];

const ELDER_BASE_STEPS = 4;
const ELDER_ADL_START_STEP = ELDER_BASE_STEPS + 1;
const ELDER_FINAL_STEP = ELDER_BASE_STEPS + elderAdlQuestions.length + 1;
const CAREGIVER_BASE_STEPS = 5;
const CAREGIVER_SKILL_START_STEP = CAREGIVER_BASE_STEPS + 1;
const CAREGIVER_FINAL_STEP = CAREGIVER_BASE_STEPS + caregiverBinaryQuestions.length;

function getHashRoute() {
  const hash = window.location.hash.replace("#", "");
  // ตรวจสอบ /google-callback path หรือ error หรือ hash
  if (window.location.pathname.startsWith("/google-callback") || window.location.search.includes("google_error") || hash.startsWith("google-callback")) {
    return "google-callback";
  }
  return Object.values(ROUTES).includes(hash) ? hash : ROUTES.home;
}

function AppContent() {
  const { user, token, logout, updateUser } = useAuth();
  const [route, setRoute] = useState(() => getHashRoute());
  const [config, setConfig] = useState(null);
  const [elderStep, setElderStep] = useState(1);
  const [caregiverStep, setCaregiverStep] = useState(1);
  const [elderForm, setElderForm] = useState(elderDefaults);
  const [caregiverForm, setCaregiverForm] = useState(caregiverDefaults);
  const [matchResult, setMatchResult] = useState(null);
  const prevMatchRef = useRef(null);
  const [caregiverResult, setCaregiverResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null); // 'left' | 'right'
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const swipeCardRef = useRef(null);
  const [error, setError] = useState("");
  const [notifCount, setNotifCount] = useState(0);
  const [hasOpenHire, setHasOpenHire] = useState(false);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, reviews: [], caregiverId: "", loading: false, average: 0 });
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, caregiver: null });
  const notifStateRef = useRef({});

  // ── Form Storage (จดจำข้อมูลแยกตาม account) ──────────────────────────
  const elderStorage = useFormStorage("elder", elderDefaults);
  const caregiverStorage = useFormStorage("caregiver", caregiverDefaults);

  // ใช้ ref ติดตาม email ก่อนหน้า เพื่อแยกว่า "บัญชีเดิม" หรือ "บัญชีอื่น"
  const prevEmailRef = useRef(null);

  useEffect(() => {
    const prevEmail = prevEmailRef.current;
    const currEmail = user?.email || null;
    const isSameAccount = currEmail && currEmail === prevEmail;
    prevEmailRef.current = currEmail;

    if (currEmail) {
      // โหลดข้อมูลฟอร์มของ account นี้
      const savedElder = elderStorage.loadFormData(currEmail);
      const savedCaregiver = caregiverStorage.loadFormData(currEmail);
      setElderForm(savedElder);
      setCaregiverForm(savedCaregiver);

      if (user?.user_type === "caregiver" && user?.caregiver_id) {
        getMyCaregiverProfile()
          .then((data) => {
            if (data?.form) {
              setCaregiverForm(data.form);
            }
          })
          .catch(() => { });
      }
      if (user?.user_type === "elder" && user?.elder_id) {
        getMyElderProfile()
          .then((data) => {
            if (data?.form) {
              setElderForm((prev) => ({
                ...prev,
                ...data.form,
              }));
            }
          })
          .catch(() => { });
      }

      if (isSameAccount) {
        // บัญชีเดิม → คืน step ที่ค้างไว้
        const savedSteps = JSON.parse(localStorage.getItem(`steps_${currEmail}`) || "{}");
        setElderStep(savedSteps.elder || 1);
        setCaregiverStep(savedSteps.caregiver || 1);
      } else {
        // บัญชีใหม่ / ต่างบัญชี → เริ่มจาก step 1
        setElderStep(1);
        setCaregiverStep(1);
      }
    } else {
      // logout → reset ทุกอย่าง
      setElderForm(elderDefaults);
      setCaregiverForm(caregiverDefaults);
      setElderStep(1);
      setCaregiverStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.caregiver_id, user?.user_type]);

  // Auto-save ทุกครั้งที่ elderForm เปลี่ยน
  useEffect(() => {
    if (user?.email) {
      elderStorage.saveFormData(user.email, elderForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderForm, user?.email]);

  // Auto-save ทุกครั้งที่ caregiverForm เปลี่ยน
  useEffect(() => {
    if (user?.email) {
      caregiverStorage.saveFormData(user.email, caregiverForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverForm, user?.email]);

  // Auto-save step ของ elder และ caregiver แยกตาม account
  useEffect(() => {
    if (user?.email) {
      const saved = JSON.parse(localStorage.getItem(`steps_${user.email}`) || "{}");
      localStorage.setItem(`steps_${user.email}`, JSON.stringify({ ...saved, elder: elderStep }));
    }
  }, [elderStep, user?.email]);

  useEffect(() => {
    if (user?.email) {
      const saved = JSON.parse(localStorage.getItem(`steps_${user.email}`) || "{}");
      localStorage.setItem(`steps_${user.email}`, JSON.stringify({ ...saved, caregiver: caregiverStep }));
    }
  }, [caregiverStep, user?.email]);

  useEffect(() => {
    const onHashChange = () => setRoute(getHashRoute());
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) window.location.hash = ROUTES.home;
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data);
        const firstDistrict = data.districts[0] || "";
        setElderForm((prev) => ({
          ...prev,
          location: prev.location || "",
          care_time: prev.care_time || "",
          model: prev.model || data.models[0]?.value || "random_forest",
        }));
        setCaregiverForm((prev) => ({
          ...prev,
          location: prev.location || "",
          care_time: prev.care_time || "",
        }));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Notification polling — ดึง unread count เมื่อ login อยู่
  useEffect(() => {
    if (!user) {
      setNotifCount(0);
      setHasOpenHire(false);
      return;
    }

    let isFirstLoad = true;

    const poll = async () => {
      try {
        const data = await getNotifications();
        setNotifCount(data.unread_count || 0);

        const notifs = Array.isArray(data.notifications) ? data.notifications : [];
        const newState = {};
        let showGlobalToast = false;
        let toastMessage = "";

        notifs.forEach(n => {
          newState[n.id] = n.status;
        });

        notifStateRef.current = newState;
        isFirstLoad = false;

        if (user.user_type === "elder") {
          // หากมีการจ้างงานที่ยอมรับแล้ว (accepted) ยังไม่ปิดงาน ต้องบล็อกการจ้างใหม่
          const acceptedRequests = notifs.filter((req) => req.status === "accepted" || req.status === "completion_requested");
          setHasOpenHire(acceptedRequests.length > 0);
        } else {
          setHasOpenHire(false);
        }
      } catch {
        setHasOpenHire(false);
      }
    };

    const handleSupportUpdate = () => {
      poll();
    };

    poll();
    const timer = setInterval(poll, 15000); // poll ทุก 15 วินาที
    window.addEventListener("support-notifications-updated", handleSupportUpdate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("support-notifications-updated", handleSupportUpdate);
    };
  }, [user]);

  const districtOptions = useMemo(() => config?.districts || [], [config]);
  const careTimeOptions = useMemo(() => config?.careTimes || [], [config]);
  const modelOptions = useMemo(() => config?.models || [], [config]);

  if (!config) {
    return <div className="loading-screen">กำลังเชื่อมระบบ ElderCareMatch...</div>;
  }

  function go(routeName) {
    window.location.hash = routeName;
  }

  function resetMessages() {
    setError("");
    setCaregiverResult(null);
  }

  function getElderTotalSteps() {
    return ELDER_FINAL_STEP;
  }

  function elderNextDisabled() {
    if (elderStep === 1) return !elderForm.gender;
    if (elderStep === 2) return !elderForm.age;
    if (elderStep === 3) return !elderForm.location;
    if (elderStep === 4) return !elderForm.care_time;
    if (elderStep >= ELDER_ADL_START_STEP && elderStep < ELDER_FINAL_STEP) {
      const question = elderAdlQuestions[elderStep - ELDER_ADL_START_STEP];
      return elderForm.adl_scores[question.key] === null;
    }
    return !elderForm.wage_range[1];
  }

  function caregiverNextDisabled() {
    if (caregiverStep === 1) return !caregiverForm.gender;
    if (caregiverStep === 2) return !caregiverForm.age;
    if (caregiverStep === 3) return !caregiverForm.location;
    if (caregiverStep === 4) return !caregiverForm.care_time;
    if (caregiverStep === 5) {
      return (
        caregiverForm.experience_years === ""
        || caregiverForm.experience_years === null
        || caregiverForm.experience_years === undefined
        || !caregiverForm.course
        || !caregiverForm.wage
      );
    }
    if (caregiverStep >= CAREGIVER_SKILL_START_STEP && caregiverStep <= CAREGIVER_FINAL_STEP) {
      const question = caregiverBinaryQuestions[caregiverStep - CAREGIVER_SKILL_START_STEP];
      return typeof caregiverForm.skills[question.key] !== "boolean";
    }
    return false;
  }

  async function handleElderSubmit() {
    setLoading(true);
    setError("");
    try {
      const result = await matchElder(elderForm);
      if (result.user) {
        updateUser(result.user);
      }
      setMatchResult(result);
      setSwipeIndex(0);
      setToast("บันทึกข้อมูลและวิเคราะห์สำเร็จ");
      setToast(result.message || "บันทึกข้อมูลและวิเคราะห์สำเร็จ");
      setToast(result.result_message || result.message || "บันทึกข้อมูลและวิเคราะห์สำเร็จ");
      setToast("บันทึกข้อมูลและวิเคราะห์สำเร็จ");
      go(ROUTES.elderResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCaregiverSubmit() {
    setLoading(true);
    setError("");
    try {
      const result = await registerCaregiver(caregiverForm);
      if (result.user) {
        updateUser(result.user);
      }
      setCaregiverResult(result);
      const caregiverToast = result.created === false
        ? `บันทึกการแก้ไขข้อมูลผู้ดูแลแล้ว รหัส ${result.caregiver_id}`
        : `ลงทะเบียนสำเร็จ รหัส ${result.caregiver_id}`;
      setToast(`ลงทะเบียนสำเร็จ รหัส ${result.caregiver_id}`);
      // ล้างข้อมูลฟอร์มหลัง submit สำเร็จ (ให้กรอกใหม่ได้ครั้งหน้า)
      setToast(caregiverToast);
      go(ROUTES.home);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function renderFooter() {
    return (
      <footer className="ecm-footer">
        <div className="ecm-footer-grid">
          <div>
            <div className="ecm-footer-brand">AI Caregiver Matching</div>
            <div className="ecm-footer-desc">
              แพลตฟอร์มจับคู่ผู้ดูแลผู้สูงอายุด้วยปัญญาประดิษฐ์ กรณีศึกษากรุงเทพมหานคร
              พัฒนาขึ้นเพื่อยกระดับคุณภาพชีวิตของผู้สูงอายุผ่านการประเมิน ADL และ Machine Learning
            </div>
          </div>
          <div>
            <div className="ecm-footer-col-title">นโยบายความเป็นส่วนตัว</div>
            <div className="ecm-footer-col-title">คำชี้แจงการเข้าถึง</div>
          </div>
          <div>
            <div className="ecm-footer-col-title">ข้อกำหนดในการให้บริการ</div>
          </div>
        </div>
        <div className="ecm-footer-bottom">© 2026 ElderCareMatch.</div>
      </footer>
    );
  }

  function renderHome() {
    return (
      <>
        <nav className="ecm-nav">
          <div className="ecm-logo">ElderCareMatch</div>
          <div className="ecm-nav-btns">
            {user ? (
              <>
                <button
                  className="btn-notif"
                  type="button"
                  onClick={() => go(ROUTES.notifications)}
                  title="การแจ้งเตือน"
                >
                  <img
                    src={iconBell}
                    alt="notifications"
                    className="btn-notif-icon"
                  />
                  {notifCount > 0 && <span className="notif-dot">{notifCount}</span>}
                </button>
                <button className="btn-profile" type="button" onClick={() => go(ROUTES.profile)}>โปรไฟล์</button>
                <button className="btn-primary" type="button" onClick={() => { logout(); go(ROUTES.home); }}>ออกจากระบบ</button>
              </>
            ) : (
              <>
                <button className="btn-primary" type="button" onClick={() => go(ROUTES.login)}>เข้าสู่ระบบ</button>
                <button className="btn-outline" type="button" onClick={() => go(ROUTES.signup)}>สมัครสมาชิก</button>
              </>
            )}
          </div>
        </nav>

        <section className="ecm-hero">
          <div className="ecm-hero-text">
            <h1>เลือกบทบาทของคุณเพื่อ<br />เริ่มต้นการใช้งานระบบ<br />ElderCare Match</h1>
            <p className="ecm-hero-sub">คุณกำลังมองหา...</p>
            <div className="ecm-hero-btns">
              <button className="main-btn-hero" type="button" onClick={() => go(ROUTES.elder)}>หาผู้ดูแล</button>
              <button className="main-btn-hero-dark" type="button" onClick={() => go(ROUTES.caregiver)}>รับงานดูแล</button>
            </div>
          </div>
          <div className="ecm-hero-img">
            <div className="img-placeholder">
              <img src={picHero1} alt="ElderCareMatch Hero" />
            </div>
          </div>
        </section>

        <section className="ecm-section">
          <h2 className="ecm-section-title">เพียง 4 ขั้นตอน<br />จากการลงทะเบียนสู่การจับคู่ผู้ดูแลที่ใช่</h2>
          <p className="ecm-section-sub">ด้วยระบบ AI Matching ที่ช่วยให้คุณพบผู้ดูแลที่เหมาะสมได้ง่ายขึ้น</p>
          <div className="ecm-steps">
            {homeSteps.map((step) => (
              <div className="ecm-step-card" key={step.title}>
                <div className="ecm-step-icon">
                  <img src={step.icon} alt="" />
                </div>
                <div className="ecm-step-title">{step.title}</div>
                <div className="ecm-step-desc" dangerouslySetInnerHTML={{ __html: step.desc }} />
              </div>
            ))}
          </div>
        </section>

        <section className="ecm-ml">
          <div className="ecm-ml-img">
            <img src={picHero2} alt="ElderCare Match" />
          </div>
          <div className="ecm-ml-content">
            <h2 className="ecm-ml-title">ยกระดับการจับคู่ด้วยระบบ<br />Machine Learning</h2>
            <p className="ecm-ml-sub">ระบบวิเคราะห์ข้อมูลหลายมิติ เพื่อหาผู้ดูแลที่เหมาะสมที่สุดสำหรับผู้สูงอายุแต่ละราย</p>
            <div className="ecm-ml-features">
              {mlFeatures.map((feature) => (
                <div className="ecm-ml-feature" key={feature.title}>
                  <div className="ecm-ml-feat-icon">
                    <img src={feature.icon} alt="" />
                  </div>
                  <div>
                    <div className="ecm-ml-feat-title">{feature.title}</div>
                    <div className="ecm-ml-feat-desc">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ecm-cta">
          <h2 className="ecm-cta-title">พร้อมที่จะค้นหาผู้ดูแลของคุณหรือยัง</h2>
          <p className="ecm-cta-sub">เริ่มต้นประเมินความต้องการ เพื่อคัดสรรผู้ดูแลที่เหมาะสมที่สุด</p>
          <button className="btn-cta" type="button" onClick={() => go(ROUTES.elder)}>
            เริ่มค้นหาผู้ดูแล
            <img src={iconRightArrow} className="arrow-img" alt="" />
          </button>
        </section>

        {renderFooter()}
      </>
    );
  }

  function renderTopNav() {
    return (
      <nav className="ecm-nav form-nav-top">
        <button className="ecm-back" type="button" onClick={() => go(ROUTES.home)}>
          <img src={iconArrow} className="arrow-left" alt="" />ย้อนกลับ
        </button>
        <div className="ecm-nav-btns">
          {user && (
            <button className="btn-profile" type="button" onClick={() => go(ROUTES.profile)}>
              {user.full_name}
            </button>
          )}
        </div>
      </nav>
    );
  }

  function renderProgress(step, totalSteps) {
    return (
      <div className="progress-bar-wrap">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div key={index} className={index + 1 <= step ? "progress-dot active" : "progress-dot"}></div>
        ))}
      </div>
    );
  }

  function renderElderFormStep() {
    const stepLabel = `ขั้นตอนที่ ${elderStep} จาก ${ELDER_FINAL_STEP}`;

    if (elderStep === 1) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">เพศของคุณ</div>
          <div className="choices">
            <button className={elderForm.gender === "ชาย" ? "choice-btn selected" : "choice-btn"} type="button" onClick={() => setElderForm({ ...elderForm, gender: "ชาย" })}>ชาย</button>
            <button className={elderForm.gender === "หญิง" ? "choice-btn selected" : "choice-btn"} type="button" onClick={() => setElderForm({ ...elderForm, gender: "หญิง" })}>หญิง</button>
          </div>
        </div>
      );
    }

    if (elderStep === 2) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">อายุของคุณ</div>
          <div className="step-sub">(ระบุอายุ เช่น 60)</div>
          <input className="ecm-input" type="number" value={elderForm.age} min="1" max="120" onChange={(e) => setElderForm({ ...elderForm, age: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="ระบุอายุของผู้สูงอายุ" />
        </div>
      );
    }

    if (elderStep === 3) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">เขตพื้นที่อยู่อาศัย</div>
          <div className="step-sub">(เช่น บางกอก, ลาดพร้าว)</div>
          <select className="ecm-input" value={elderForm.location} onChange={(e) => setElderForm({ ...elderForm, location: e.target.value })}>
            <option value="" disabled>ระบุเขตหรือพื้นที่ของคุณ</option>
            {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </div>
      );
    }

    if (elderStep === 4) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">คุณต้องการผู้ดูแลในรูปแบบใด?</div>
          <div className="choices choices-fixed">
            {careTimeOptions.map((item) => (
              <button key={item} className={elderForm.care_time === item ? "choice-btn selected" : "choice-btn"} type="button" onClick={() => setElderForm({ ...elderForm, care_time: item })}>{item}</button>
            ))}
          </div>
        </div>
      );
    }

    if (elderStep >= ELDER_ADL_START_STEP && elderStep < ELDER_FINAL_STEP) {
      const questionIndex = elderStep - ELDER_ADL_START_STEP;
      const question = elderAdlQuestions[questionIndex];

      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">{`${questionIndex + 1}. ${question.title}`}</div>
          <div className="choices choices-col">
            {question.options.map((option) => (
              <button
                key={`${question.key}-${option.value}`}
                type="button"
                className={elderForm.adl_scores[question.key] === option.value ? "choice-btn selected" : "choice-btn"}
                onClick={() => setElderForm({
                  ...elderForm,
                  adl_scores: {
                    ...elderForm.adl_scores,
                    [question.key]: option.value,
                  },
                })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="step active">
        <div className="step-label">{stepLabel}</div>
        <div className="step-title">งบประมาณและตัวเลือกเพิ่มเติม</div>
        <div className="step-sub">(ระบุจำนวนเงิน เช่น 15000)</div>
        <input className="ecm-input" type="number" value={elderForm.wage_range[1]} min="1" onChange={(e) => setElderForm({ ...elderForm, wage_range: [0, e.target.value === "" ? "" : Number(e.target.value)] })} placeholder="ระบุงบประมาณ (บาท/เดือน)" />
        <div className="advanced-box">
          <div className="advanced-title">ตัวเลือก AI</div>
          <select className="ecm-input compact-input" value={elderForm.model} onChange={(e) => setElderForm({ ...elderForm, model: e.target.value })}>
            {modelOptions.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
          </select>
          <div className="advanced-title">Filter</div>
          <div className="choices small-gap">
            {preferenceOptions.map((option) => (
              <button key={option.value} type="button" className={elderForm.preferences.includes(option.value) ? "choice-btn selected" : "choice-btn"} onClick={() => setElderForm((prev) => ({ ...prev, preferences: prev.preferences.includes(option.value) ? prev.preferences.filter((item) => item !== option.value) : [...prev.preferences, option.value] }))}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderCaregiverFormStep() {
    const stepLabel = `ขั้นตอนที่ ${caregiverStep} จาก ${CAREGIVER_FINAL_STEP}`;

    if (caregiverStep === 1) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">เพศของคุณ</div>
          <div className="choices">
            <button className={caregiverForm.gender === "ชาย" ? "choice-btn selected" : "choice-btn"} type="button" onClick={() => setCaregiverForm({ ...caregiverForm, gender: "ชาย" })}>ชาย</button>
            <button className={caregiverForm.gender === "หญิง" ? "choice-btn selected" : "choice-btn"} type="button" onClick={() => setCaregiverForm({ ...caregiverForm, gender: "หญิง" })}>หญิง</button>
          </div>
        </div>
      );
    }

    if (caregiverStep === 2) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">อายุของคุณ</div>
          <div className="step-sub">(ระบุอายุ เช่น 28)</div>
          <input className="ecm-input" type="number" value={caregiverForm.age} min="18" max="65" onChange={(e) => setCaregiverForm({ ...caregiverForm, age: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="ระบุอายุของผู้ดูแล" />
        </div>
      );
    }

    if (caregiverStep === 3) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">เขตพื้นที่อยู่อาศัย</div>
          <div className="step-sub">(เช่น บางกอก, ลาดพร้าว)</div>
          <select className="ecm-input" value={caregiverForm.location} onChange={(e) => setCaregiverForm({ ...caregiverForm, location: e.target.value })}>
            <option value="" disabled>ระบุเขตหรือพื้นที่ของคุณ</option>
            {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </div>
      );
    }

    if (caregiverStep === 4) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">คุณรับงานดูแลในรูปแบบใด?</div>
          <div className="choices choices-fixed">
            {careTimeOptions.map((item) => (
              <button key={item} className={caregiverForm.care_time === item ? "choice-btn selected" : "choice-btn"} type="button" onClick={() => setCaregiverForm({ ...caregiverForm, care_time: item })}>{item}</button>
            ))}
          </div>
        </div>
      );
    }

    if (caregiverStep === 5) {
      return (
        <div className="step active">
          <div className="step-label">{stepLabel}</div>
          <div className="step-title">ท่านมีประสบการณ์ดูแลผู้สูงอายุกี่ปี?</div>
          <div className="step-sub">ระบุจำนวนปีและเลือกระดับการอบรม ระบบจะเก็บรหัสหลักสูตรลง Google Sheet</div>
          <input className="ecm-input" type="number" value={caregiverForm.experience_years} min="0" max="30" onChange={(e) => setCaregiverForm({ ...caregiverForm, experience_years: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="กรอกจำนวนปี" />
          <div className="advanced-title">ท่านผ่านการอบรมด้านการดูแลผู้สูงอายุระดับใด?</div>
          <div className="choices">
            {caregiverTrainingOptions.map((option) => (
              <button key={option.value} type="button" className={caregiverForm.course === option.value ? "choice-btn selected" : "choice-btn"} onClick={() => setCaregiverForm({ ...caregiverForm, course: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="advanced-title">ค่าจ้างที่ต้องการ</div>
          <div className="step-sub">(ระบุจำนวนเงิน เช่น 18000)</div>
          <input className="ecm-input" type="number" value={caregiverForm.wage} min="1" onChange={(e) => setCaregiverForm({ ...caregiverForm, wage: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="ระบุค่าจ้าง (บาท/เดือน)" />
        </div>
      );
    }

    const question = caregiverBinaryQuestions[caregiverStep - CAREGIVER_SKILL_START_STEP];
    return (
      <div className="step active">
        <div className="step-label">{stepLabel}</div>
        <div className="step-title">{question.title}</div>
        <div className="choices choices-fixed">
          <button
            type="button"
            className={caregiverForm.skills[question.key] === false ? "choice-btn selected" : "choice-btn"}
            onClick={() => setCaregiverForm({ ...caregiverForm, skills: { ...caregiverForm.skills, [question.key]: false } })}
          >
            ไม่ได้
          </button>
          <button
            type="button"
            className={caregiverForm.skills[question.key] === true ? "choice-btn selected" : "choice-btn"}
            onClick={() => setCaregiverForm({ ...caregiverForm, skills: { ...caregiverForm.skills, [question.key]: true } })}
          >
            ได้
          </button>
        </div>
      </div>
    );
  }

  function renderFormPage(type) {
    const isElder = type === "elder";
    const step = isElder ? elderStep : caregiverStep;
    const totalSteps = isElder ? getElderTotalSteps() : CAREGIVER_FINAL_STEP;
    const nextDisabled = isElder ? elderNextDisabled() : caregiverNextDisabled();
    const submit = isElder ? handleElderSubmit : handleCaregiverSubmit;

    const back = () => {
      resetMessages();
      if (step === 1) {
        go(ROUTES.home);
      } else if (isElder) {
        setElderStep(step - 1);
      } else {
        setCaregiverStep(step - 1);
      }
    };

    const isViewResultBlocked = isElder && step === totalSteps && hasOpenHire;
    const next = () => {
      if (step < totalSteps) {
        if (isElder) setElderStep(step + 1);
        else setCaregiverStep(step + 1);
      } else {
        if (isViewResultBlocked) {
          setToast("คุณยังมีคำขอหรือการจ้างงานที่ยังไม่เสร็จสิ้นอยู่ กรุณาปิดงานก่อนจ้างผู้ดูแลใหม่");
          return;
        }
        submit();
      }
    };

    return (
      <>
        {renderTopNav()}
        <div id="form-section">
          <div className="form-card">
            {renderProgress(step, totalSteps)}
            {isElder ? renderElderFormStep() : renderCaregiverFormStep()}
            <div className="form-nav">
              <button className="btn-back" type="button" onClick={back} disabled={loading && step === totalSteps}>ย้อนกลับ</button>
              <button
                className="btn-next"
                type="button"
                onClick={next}
                disabled={nextDisabled || loading}
              >
                {step < totalSteps ? "ถัดไป" : loading ? (isElder ? "กำลังประมวลผล..." : "กำลังบันทึก...") : (isElder ? "ดูผลลัพธ์" : "ลงทะเบียน")}
              </button>
            </div>
            {error ? <div className="inline-alert error">{error}</div> : null}
          </div>
        </div>
      </>
    );
  }

  function renderResults() {
    const matches = matchResult?.matches || [];
    const fallbackNotice = matchResult?.match_strategy === "skill_nearby_fallback"
      ? "ไม่พบผู้ที่อยู่ในงบประมาณ จึงแสดงผู้ที่ใกล้เคียงกับคุณ โดยการขยายงบประมาณประกำกับ"
      : matchResult?.match_strategy === "nearby_fallback"
        ? "ไม่พบผู้ที่ตรงเงื่อนไขทั้งหมด จึงแสดงผู้ที่ใกล้คุณมากที่สุดแทน โดยการขยายงบประมาณประกำกับ"
        : "";

    // Swipe handlers
    const handleDragStart = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setDragStartX(clientX);
      setDragOffsetX(0);
      setIsDragging(true);
      setSwipeDir(null);
    };
    const handleDragMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = clientX - dragStartX;
      setDragOffsetX(diff);
      if (diff > 40) setSwipeDir("right");
      else if (diff < -40) setSwipeDir("left");
      else setSwipeDir(null);
    };
    const handleDragEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      if (dragOffsetX > 80 && swipeIndex > 0) {
        setSwipeIndex(prev => prev - 1);
      } else if (dragOffsetX < -80 && swipeIndex < matches.length - 1) {
        setSwipeIndex(prev => prev + 1);
      }
      setDragOffsetX(0);
      setSwipeDir(null);
    };

    const currentCg = matches[swipeIndex];
    const isMobile = window.innerWidth <= 768;

    return (
      <>
        {renderTopNav()}
        <div id="result-section" className="result-section-visible">
          <div className="result-header">
            <h1>ผลลัพธ์การจับคู่ที่เหมาะกับคุณ</h1>
            <p>AI วิเคราะห์จากแบบทดสอบ ADL และความต้องการของคุณ<br />เพื่อหาผู้ดูแลที่เหมาะสมที่สุด</p>
          </div>

          {!matches || matches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666", gridColumn: "1 / -1" }}>
              ไม่พบผู้ดูแลที่ตรงกับเงื่อนไข ในช่วงงบประมาณของคุณ คุณอาจต้องปรับเปลี่ยนงบประมาณ
            </div>
          ) : (
            /* ─── DESKTOP GRID UI (unchanged) ─── */
            <>
              {hasOpenHire && user?.user_type === "elder" && (
                <div className="result-warning" style={{ marginBottom: "16px", padding: "16px", border: "1px solid #f59e0b", borderRadius: "10px", background: "#fffbeb", color: "#92400e" }}>
                  คุณยังมีคำขอจ้างงานอยู่ กรุณาปิดงานก่อนจ้างใหม่
                </div>
              )}
              <div className="result-grid" id="result-grid">
                {matches.map((cg, index) => {
                  const withinBudget = typeof cg.within_budget === "boolean"
                    ? cg.within_budget
                    : cg.wage <= elderForm.wage_range[1];
                  return (
                    <div className="caregiver-card" key={`${cg.caregiver_id}-${index}`} onClick={() => setDetailsModal({ isOpen: true, caregiver: cg })} style={{ cursor: "pointer" }}>
                      <div className="card-img-wrap">
                        <div className="card-img-placeholder">
                          <img
                            src={cg.profile_image || cg.avatar_url || iconPerson}
                            alt="Caregiver Profile"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                        <span className={withinBudget ? "budget-badge budget-ok" : "budget-badge budget-over"}>{withinBudget ? "ในงบประมาณ" : "เกินงบประมาณ"}</span>
                        <div className="match-circle">
                          <span className="match-pct">{cg.match_score}%</span>
                          <span className="match-label">MATCH</span>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="card-name" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {cg.caregiver_id}
                          <div
                            className="card-rating"
                            title={cg.total_reviews > 0 ? "ดูรีวิวทั้งหมด" : ""}
                            style={{ fontSize: "0.9rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px", fontWeight: "normal", cursor: cg.total_reviews > 0 ? "pointer" : "default", padding: "4px 8px", borderRadius: "6px", transition: "background-color 0.2s", margin: "-4px -8px" }}
                            onMouseEnter={(e) => { if (cg.total_reviews > 0) e.currentTarget.style.backgroundColor = "#fffbeb"; }}
                            onMouseLeave={(e) => { if (cg.total_reviews > 0) e.currentTarget.style.backgroundColor = "transparent"; }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (cg.total_reviews > 0) {
                                setReviewModal({ isOpen: true, reviews: [], caregiverId: cg.caregiver_id, loading: true, average: cg.average_rating });
                                try {
                                  const res = await getCaregiverReviews(cg.caregiver_id);
                                  setReviewModal({ isOpen: true, reviews: res.reviews, caregiverId: cg.caregiver_id, loading: false, average: cg.average_rating });
                                } catch (err) {
                                  setToast(`เกิดข้อผิดพลาด: ${err.message}`);
                                  setReviewModal(prev => ({ ...prev, loading: false }));
                                }
                              }
                            }}
                          >
                            {cg.total_reviews > 0 ? (
                              <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                <span style={{ color: "#333", fontWeight: "600" }}>{cg.average_rating}</span>
                                <span style={{ color: "#0066cc", fontSize: "0.8rem", textDecoration: "underline", marginLeft: "2px" }}>(ดู {cg.total_reviews} รีวิว)</span>
                              </>
                            ) : (
                              <span style={{ color: "#888", fontSize: "0.8rem" }}>ยังไม่มีรีวิว</span>
                            )}
                          </div>
                        </div>
                        <div className="card-highlight">
                          <span>ประสบการณ์ {cg.experience_years} ปี</span>
                          <span className="card-highlight-sep">|</span>
                          <span>{Number(cg.wage).toLocaleString("th-TH")} บาท/เดือน</span>
                        </div>
                        <div className="card-meta">ห่างจากคุณ {cg.distance_km} กม.</div>
                        <div className="card-skills-label">ทักษะ :</div>
                        <div className="card-skills">{cg.all_skills || cg.matched_skills}</div>
                        <button
                          className="btn-hire"
                          type="button"
                          disabled={hasOpenHire}
                          style={hasOpenHire ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!user) { go(ROUTES.login); return; }
                            if (hasOpenHire) { setToast("คุณยังมีคำขอจ้างงานอยู่ กรุณาปิดงานก่อนจ้างใหม่"); return; }
                            try {
                              const res = await hireCaregiver(cg.caregiver_id, "");
                              if (res.already_sent) { setToast("ส่งคำขอแล้ว รอผลตอบรับ"); }
                              else { setToast(`ส่งคำขอจ้าง ${cg.caregiver_id} เรียบร้อย!`); }
                              go(ROUTES.notifications);
                            } catch (err) { setToast(`เกิดข้อผิดพลาด: ${err.message}`); }
                          }}
                        >จ้างผู้แลคนนี้</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {renderFooter()}

        </div>
      </>
    );
  }



  // Google OAuth callback
  if (route === "google-callback") {
    return (
      <GoogleCallback
        onSuccess={() => {
          window.history.replaceState({}, document.title, "/");
          go(ROUTES.home);
        }}
      />
    );
  }

  // Auth routes
  if (route === ROUTES.login) {
    return (
      <Login
        onLoginSuccess={() => go(ROUTES.home)}
        onSignupClick={() => go(ROUTES.signup)}
      />
    );
  }

  if (route === ROUTES.signup) {
    return (
      <Signup
        onBack={() => go(ROUTES.login)}
        onSignupSuccess={() => go(ROUTES.home)}
      />
    );
  }

  if (route === ROUTES.profile) {
    if (!user) { go(ROUTES.login); return null; }
    return (
      <Profile
        onLogout={() => { logout(); go(ROUTES.home); }}
        onBack={() => go(ROUTES.home)}
      />
    );
  }

  if (route === ROUTES.notifications) {
    if (!user) { go(ROUTES.login); return null; }
    return (
      <Notifications
        onBack={() => go(ROUTES.home)}
        onOpenChat={(roomId) => {
          setChatRoomId(roomId);
          go(ROUTES.chat);
        }}
      />
    );
  }

  if (route === ROUTES.chat) {
    if (!user) { go(ROUTES.login); return null; }
    return (
      <Chat
        roomId={chatRoomId}
        onBack={() => go(ROUTES.notifications)}
        promptpayConfig={config?.promptpay}
      />
    );
  }

  return (
    <div>
      {route === ROUTES.home && renderHome()}
      {route === ROUTES.elder && renderFormPage("elder")}
      {route === ROUTES.caregiver && renderFormPage("caregiver")}
      {route === ROUTES.elderResults && renderResults()}
      <div id="toast" className={toast ? "show" : ""}>{toast}</div>
      {route === ROUTES.home && <SupportChatWidget />}

      {/* Details Modal */}
      {detailsModal.isOpen && detailsModal.caregiver && (
        <div className="modal-overlay" onClick={() => setDetailsModal({ isOpen: false, caregiver: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailsModal({ isOpen: false, caregiver: null })}>×</button>
            <h2>ข้อมูลผู้ดูแล</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <img src={detailsModal.caregiver.profile_image || detailsModal.caregiver.avatar_url} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <h3 style={{ margin: 0 }}>{detailsModal.caregiver.caregiver_id}</h3>
                <div style={{ color: '#666', fontSize: '14px' }}>ประสบการณ์ {detailsModal.caregiver.experience_years} ปี</div>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>ค่าบริการ:</strong> {Number(detailsModal.caregiver.wage).toLocaleString("th-TH")} บาท/เดือน
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>ระยะทาง:</strong> {detailsModal.caregiver.distance_km} กม.
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>ผ่านการอบรม:</strong> {detailsModal.caregiver.course}
            </div>
            <div>
              <strong>ทักษะความสามารถ:</strong>
              <p style={{ marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {(detailsModal.caregiver.all_skills || detailsModal.caregiver.matched_skills || '').split(',').map(s => s.trim()).filter(Boolean).map(s => (
                  <span key={s} style={{ display: 'inline-block', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', marginRight: '8px', marginBottom: '8px', fontSize: '13px' }}>{s}</span>
                ))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.isOpen && (
        <div className="modal-overlay" onClick={() => setReviewModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setReviewModal(prev => ({ ...prev, isOpen: false }))}>×</button>
            <h2>รีวิวของ {reviewModal.caregiverId}</h2>
            <div style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
              ⭐ คะแนนเฉลี่ย: {reviewModal.average}
            </div>
            {reviewModal.loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>กำลังโหลดรีวิว...</div>
            ) : reviewModal.reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>ยังไม่มีรีวิว</div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {reviewModal.reviews.map((r, idx) => (
                  <div key={idx} style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong>{r.elder_name || 'ผู้ใช้'}</strong>
                      <span style={{ color: '#f59e0b' }}>⭐ {(r.service_quality && r.punctuality && r.communication) ? ((r.service_quality + r.punctuality + r.communication) / 3).toFixed(1) : Number(r.rating || 0).toFixed(1)}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#444' }}>{r.comment}</div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>{new Date(r.created_at).toLocaleDateString('th-TH')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalNotifications() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const notifStateRef = useRef({});

  const addAlert = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setAlerts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 6000); // แสดง 6 วินาที
  };

  useEffect(() => {
    if (!user) return;

    let isFirstLoad = true;

    const poll = async () => {
      try {
        const data = await getNotifications();
        const notifs = Array.isArray(data.notifications) ? data.notifications : [];
        const newState = {};

        notifs.forEach((n) => {
          newState[n.id] = n.status;
          if (!isFirstLoad) {
            const oldStatus = notifStateRef.current[n.id];
            if (!oldStatus) {
              if (user.user_type === "caregiver" && n.status === "pending" && !n.is_superseded) {
                addAlert(`🔔 มีคำขอจ้างใหม่จากผู้สูงอายุ (${n.elder_name})`, "info");
              }
            } else if (oldStatus !== n.status) {
              if (user.user_type === "elder") {
                if (n.status === "accepted") {
                  addAlert(`✅ ผู้ดูแล ${n.caregiver_sheet_id} ตอบรับงานของคุณแล้ว`, "success");
                } else if (n.status === "rejected") {
                  addAlert(`❌ ผู้ดูแล ${n.caregiver_sheet_id} ปฏิเสธงานของคุณ`, "error");
                }
              }
            }
          }
        });

        notifStateRef.current = newState;
        isFirstLoad = false;
      } catch (e) {
        // เงียบไว้
      }
    };

    poll();
    const timer = setInterval(poll, 15000);
    return () => clearInterval(timer);
  }, [user]);

  if (alerts.length === 0) return null;

  return (
    <div className="global-alerts-container">
      {alerts.map((alert) => (
        <div key={alert.id} className={`global-alert global-alert-${alert.type}`}>
          {alert.message}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [adminUser, setAdminUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("adminUser") || "null"); } catch { return null; }
  });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("adminToken") || null);

  // ถ้า URL hash เป็น #admin ให้แสดง admin panel
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === "#admin");

  useEffect(() => {
    const handler = () => setIsAdminRoute(window.location.hash === "#admin");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  function handleAdminLogin(user, token) {
    setAdminUser(user);
    setAdminToken(token);
  }
  function handleAdminLogout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setAdminUser(null);
    setAdminToken(null);
    window.location.hash = "home";
  }

  if (isAdminRoute) {
    if (adminUser && adminToken) {
      return <AdminDashboard admin={adminUser} onLogout={handleAdminLogout} />;
    }
    return <AdminPanel onLoginSuccess={handleAdminLogin} />;
  }

  return (
    <AuthProvider>
      <AppContent />
      <GlobalNotifications />
    </AuthProvider>
  );
}

export default App;
