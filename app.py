import os
import urllib.request
import urllib.parse
import json as _json
from functools import lru_cache, wraps
from datetime import timedelta
from dotenv import load_dotenv
import time
from werkzeug.utils import secure_filename
from flask import Flask, jsonify, request, redirect, url_for
from flask_cors import CORS

load_dotenv()

import gspread
import joblib
import numpy as np
import pandas as pd
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from oauth2client.service_account import ServiceAccountCredentials
from sqlalchemy import text

from models import db, User, HireRequest, ChatRoom, ChatMessage, Feedback, Payment, SystemNotification, SupportChatRoom, SupportChatMessage

GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "ElderCareMatch_Data")
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "eldercarematch-fdb3c03a4ef3.json")
DEFAULT_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.getenv("FLASK_PORT", "5000"))
app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False

# Configure CORS to allow local development and Vercel production origins
frontend_origins = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    "https://elder-care-match.vercel.app"
]
CORS(app, resources={r"/api/*": {"origins": frontend_origins}})

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/api/auth/google/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# PromptPay
PROMPTPAY_ID = os.getenv("PROMPTPAY_ID", "")
PROMPTPAY_NAME = os.getenv("PROMPTPAY_NAME", "ElderCareMatch")

# Database configuration
# app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///eldercare.db")
db_uri = os.environ.get("DATABASE_URL")

# ถ้าเป็น Postgres ให้เปลี่ยน protocol ให้ถูกต้อง
if db_uri and db_uri.startswith("postgres://"):
    db_uri = db_uri.replace("postgres://", "postgresql://")

# กำหนดค่า URI
app.config["SQLALCHEMY_DATABASE_URI"] = db_uri or "sqlite:///eldercare.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# เพิ่มการตั้งค่าเพื่อแก้ปัญหา SSL โดยใช้ Parameter ที่ถูกต้องสำหรับ psycopg2 (เฉพาะกรณีใช้ PostgreSQL)
if db_uri and ("postgresql" in db_uri or "postgres" in db_uri):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "connect_args": {
            "sslmode": "prefer" 
        }
    }
# app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# JWT configuration
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30)

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)

# Create database tables
with app.app_context():
    db.create_all()
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    if 'users' in inspector.get_table_names():
        columns = {col['name'] for col in inspector.get_columns('users')}
        if "elder_id" not in columns:
            # For PostgreSQL, make sure the syntax is standard ALTER TABLE
            db.session.execute(text("ALTER TABLE users ADD COLUMN elder_id VARCHAR(50)"))
            db.session.commit()

DISTRICT_COORDS = {
    "พระนคร": (13.76498, 100.49873),
    "ดุสิต": (13.7770, 100.5210),
    "หนองจอก": (13.8554, 100.8625),
    "บางรัก": (13.7263, 100.5279),
    "บางเขน": (13.8739, 100.5964),
    "บางกะปิ": (13.7658, 100.6472),
    "ปทุมวัน": (13.7462, 100.5308),
    "ป้อมปราบศัตรูพ่าย": (13.7580, 100.5131),
    "พระโขนง": (13.7022, 100.6058),
    "มีนบุรี": (13.8138, 100.7433),
    "ลาดกระบัง": (13.7288, 100.8542),
    "ยานนาวา": (13.6963, 100.5431),
    "สัมพันธวงศ์": (13.7396, 100.5076),
    "พญาไท": (13.7800, 100.5400),
    "ธนบุรี": (13.7250, 100.4850),
    "บางกอกใหญ่": (13.7297, 100.4742),
    "ห้วยขวาง": (13.7789, 100.5767),
    "คลองสาน": (13.7303, 100.5097),
    "ตลิ่งชัน": (13.7768, 100.4567),
    "บางกอกน้อย": (13.7544, 100.4700),
    "บางขุนเทียน": (13.6267, 100.4358),
    "ภาษีเจริญ": (13.7160, 100.4500),
    "หนองแขม": (13.7049, 100.3486),
    "ราษฎร์บูรณะ": (13.6822, 100.5025),
    "บางพลัด": (13.7939, 100.5050),
    "ดินแดง": (13.7697, 100.5528),
    "บึงกุ่ม": (13.7853, 100.6694),
    "สาทร": (13.7081, 100.5264),
    "บางซื่อ": (13.8096, 100.5379),
    "จตุจักร": (13.8286, 100.5597),
    "บางคอแหลม": (13.6933, 100.5025),
    "ประเวศ": (13.6997, 100.6914),
    "คลองเตย": (13.7081, 100.5839),
    "สวนหลวง": (13.7303, 100.6272),
    "จอมทอง": (13.6766, 100.4691),
    "ดอนเมือง": (13.9131, 100.5914),
    "ราชเทวี": (13.7589, 100.5344),
    "ลาดพร้าว": (13.8241, 100.6088),
    "วัฒนา": (13.7381, 100.5597),
    "บางแค": (13.7098, 100.3959),
    "หลักสี่": (13.8875, 100.5789),
    "สายไหม": (13.9214, 100.6458),
    "คันนายาว": (13.8272, 100.6758),
    "สะพานสูง": (13.7700, 100.6844),
    "วังทองหลาง": (13.7864, 100.6089),
    "คลองสามวา": (13.8597, 100.7042),
    "บางนา": (13.6644, 100.6099),
    "ทวีวัฒนา": (13.7836, 100.3567),
    "ทุ่งครุ": (13.6461, 100.4961),
    "บางบอน": (13.6549, 100.3891),
}

MODEL_FILE_MAP = {
    "random_forest": {
        "label": "Random Forest",
        "filename": "Random_Forest_model.pkl",
    },
    "knn": {
        "label": "KNN",
        "filename": "KNN_model.pkl",
    },
    "neural_network": {
        "label": "Neural Network",
        "filename": "Neural_Network_model.pkl",
    },
    "logistic_regression": {
        "label": "Logistic Regression",
        "filename": "Logistic_Regression_model.pkl",
    },
}

CARE_TIME_OPTIONS = ["อยู่ประจำ", "ไปกลับ", "รายวัน"]
SKILL_LABELS = {
    "feeding": "ช่วยป้อนอาหาร",
    "transfer": "ช่วยเคลื่อนย้ายตัว",
    "toileting": "ช่วยเข้าห้องน้ำ",
    "wheelchair": "ช่วยใช้รถเข็น",
    "dressing": "ช่วยแต่งตัว",
    "bathing": "ช่วยอาบน้ำ",
}

ALL_SKILL_DEFINITIONS = [
    (("skill_feeding", "feeding"), SKILL_LABELS["feeding"]),
    (("skill_transfer", "transfer"), SKILL_LABELS["transfer"]),
    (("skill_toileting", "toileting"), SKILL_LABELS["toileting"]),
    (("skill_wheelchair", "wheelchair"), SKILL_LABELS["wheelchair"]),
    (("skill_dressing", "dressing"), SKILL_LABELS["dressing"]),
    (("skill_bathing", "bathing"), SKILL_LABELS["bathing"]),
    (("skill_wound_care", "wound_care"), "ดูแลแผล"),
    (("skill_tube_feeding", "tube_feeding"), "ให้อาหารทางสายยาง"),
    (("skill_medication", "medication"), "จัดยาและเตือนกินยา"),
    (("skill_dementia", "dementia"), "ดูแลผู้สูงอายุภาวะสมองเสื่อม"),
    (("skill_companionship", "companionship"), "พูดคุยและดูแลเป็นเพื่อน"),
]


CAREGIVER_SHEET_WIDTH = 23
ELDER_SHEET_WIDTH = 20


def api_error(message, status=400):
    return jsonify({"ok": False, "message": message}), status

def add_system_notification(user_id, message, type="system", reference_id=None):
    """สร้างการแจ้งเตือนระบบ (บันทึกลง SystemNotification)"""
    notif = SystemNotification(
        user_id=user_id,
        message=message,
        type=type,
        reference_id=reference_id
    )
    db.session.add(notif)
    db.session.commit()
    return notif



@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = os.getenv("FRONTEND_ORIGIN", "*")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/api/<path:_path>", methods=["OPTIONS"])
def options_handler(_path):
    return ("", 204)


@lru_cache(maxsize=1)
def get_spreadsheet():
    scopes = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]
    google_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if google_creds_json:
        try:
            keyfile_dict = _json.loads(google_creds_json)
            creds = ServiceAccountCredentials.from_json_keyfile_dict(keyfile_dict, scopes)
        except Exception as e:
            print(f"Error loading credentials from GOOGLE_CREDENTIALS_JSON: {e}")
            creds = ServiceAccountCredentials.from_json_keyfile_name(SERVICE_ACCOUNT_FILE, scopes)
    else:
        creds = ServiceAccountCredentials.from_json_keyfile_name(SERVICE_ACCOUNT_FILE, scopes)
    client = gspread.authorize(creds)
    return client.open(GOOGLE_SHEET_NAME)


@lru_cache(maxsize=1)
def load_assets():
    scaler = joblib.load("scaler.pkl")
    model_features = joblib.load("model_features.pkl")
    scaler_features = list(getattr(scaler, "feature_names_in_", model_features))
    models = {
        key: joblib.load(config["filename"])
        for key, config in MODEL_FILE_MAP.items()
    }
    return models, model_features, scaler, scaler_features


def get_sheet(name):
    return get_spreadsheet().worksheet(name)


def normalize_bool(value):
    return 1 if bool(value) else 0


def to_float(value, default=0.0):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value, default=0):
    try:
        if value in (None, ""):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_wage_range(wage_range):
    if not isinstance(wage_range, (list, tuple)) or len(wage_range) != 2:
        return 0.0, 0.0

    min_wage = max(0.0, to_float(wage_range[0], 0.0))
    max_wage = max(0.0, to_float(wage_range[1], 0.0))

    if min_wage > max_wage:
        min_wage, max_wage = max_wage, min_wage

    return min_wage, max_wage


def compute_total_adl(adl_scores):
    return sum(to_int(adl_scores.get(key, 0)) for key in ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"])


def derive_dependency(total_adl):
    if total_adl <= 4:
        return {
            "adl_group": "ช่วยตัวเองไม่ได้",
            "dependency_level": 2,
            "health_status": "ภาวะสุขภาพเปราะบาง",
        }
    if total_adl <= 8:
        return {
            "adl_group": "ช่วยตัวเองได้บางส่วน",
            "dependency_level": 1,
            "health_status": "ภาวะสุขภาพเปราะบาง",
        }
    return {
        "adl_group": "ช่วยตัวเองได้ดี",
        "dependency_level": 0,
        "health_status": "แข็งแรง",
    }


def build_reason(match_score, distance_km, matched_skills, experience_years, wage, budget_note=None):
    reasons = [f"คะแนนความเหมาะสม {match_score:.2f}%"]
    if matched_skills:
        reasons.append(f"ทักษะเด่น: {matched_skills}")
    reasons.append(f"ระยะทางประมาณ {distance_km:.1f} กม.")
    reasons.append(f"ประสบการณ์ {experience_years} ปี")
    reasons.append(f"ค่าจ้าง {wage:,.0f} บาท/เดือน")
    if budget_note:
        reasons.append(budget_note)
    return " | ".join(reasons)


def get_matched_skills(elder_info, caregiver_row):
    mapping = {
        "v1": ("skill_feeding", SKILL_LABELS["feeding"]),
        "v3": ("skill_transfer", SKILL_LABELS["transfer"]),
        "v4": ("skill_toileting", SKILL_LABELS["toileting"]),
        "v5": ("skill_wheelchair", SKILL_LABELS["wheelchair"]),
        "v6": ("skill_dressing", SKILL_LABELS["dressing"]),
        "v8": ("skill_bathing", SKILL_LABELS["bathing"]),
    }
    thresholds = {"v1": 2, "v3": 3, "v4": 2, "v5": 3, "v6": 2, "v8": 1}

    matched = []
    gaps = 0
    for adl_key, (skill_column, label) in mapping.items():
        if to_int(elder_info.get(adl_key)) < thresholds[adl_key]:
            if to_int(caregiver_row.get(skill_column)) == 1:
                matched.append(label)
            else:
                gaps += 1
    return ", ".join(matched), gaps


def get_all_skills(caregiver_row):
    skills = []
    for columns, label in ALL_SKILL_DEFINITIONS:
        if any(to_int(caregiver_row.get(column)) == 1 for column in columns):
            skills.append(label)
    return ", ".join(skills) if skills else "ดูแลทั่วไป"

def get_model_and_scaler(model_key):
    scaler = joblib.load("scaler.pkl")
    model_features = joblib.load("model_features.pkl")
    scaler_features = list(getattr(scaler, "feature_names_in_", model_features))
    model = joblib.load(MODEL_FILE_MAP[model_key]["filename"])
    return model, model_features, scaler, scaler_features

def score_ai_matches(elder_info, caregiver_df, model_key, preferences, wage_range):
    active_model, model_features, scaler, scaler_features = get_model_and_scaler(model_key)

    min_wage, max_wage = wage_range
    caregiver_df = caregiver_df.copy()
    caregiver_df["wage"] = caregiver_df["wage"].apply(to_float)
    if caregiver_df.empty:
        return []

    # Fetch feedback summaries for all caregivers
    feedbacks = db.session.query(
        Feedback.caregiver_sheet_id,
        db.func.avg(Feedback.rating).label('avg_rating'),
        db.func.count(Feedback.id).label('total_reviews')
    ).group_by(Feedback.caregiver_sheet_id).all()
    
    feedback_dict = {
        row.caregiver_sheet_id: {
            "average_rating": round(float(row.avg_rating), 1) if row.avg_rating else 0.0,
            "total_reviews": row.total_reviews
        }
        for row in feedbacks
    }

    elder_lat, elder_lon = DISTRICT_COORDS.get(elder_info["location"], (13.75, 100.5))
    results = []

    for _, caregiver in caregiver_df.iterrows():
        matched_skills, gap_count = get_matched_skills(elder_info, caregiver)
        all_skills = get_all_skills(caregiver)
        caregiver_lat = to_float(caregiver.get("caregiver_lat"), 13.75)
        caregiver_lon = to_float(caregiver.get("caregiver_long"), 100.5)
        distance_km = np.sqrt(((elder_lat - caregiver_lat) * 111.1) ** 2 + ((elder_lon - caregiver_lon) * 108.1) ** 2)

        care_score = 1.0 if str(elder_info["care_time"]).strip() == str(caregiver.get("Caregiver_care_time", "")).strip() else 0.5
        raw_features = {
            "dependency_level": elder_info["dependency_level"],
            "ADL_1_eating": to_int(elder_info.get("v1")),
            "ADL_3_transfer": to_int(elder_info.get("v3")),
            "ADL_4_toilet": to_int(elder_info.get("v4")),
            "ADL_5_mobility": to_int(elder_info.get("v5")),
            "ADL_6_dressing": to_int(elder_info.get("v6")),
            "ADL_8_bathing": to_int(elder_info.get("v8")),
            "skill_feeding": to_int(caregiver.get("skill_feeding")),
            "skill_transfer": to_int(caregiver.get("skill_transfer")),
            "skill_toileting": to_int(caregiver.get("skill_toileting")),
            "skill_bathing": to_int(caregiver.get("skill_bathing")),
            "skill_wheelchair": to_int(caregiver.get("skill_wheelchair")),
            "skill_dressing": to_int(caregiver.get("skill_dressing")),
            "experience_years": to_float(caregiver.get("experience_years")),
        }
        input_data = pd.DataFrame([
            {
                feature_name: raw_features[feature_name]
                for feature_name in scaler_features
            }
        ])

        scaled = scaler.transform(input_data)
        model_input = pd.DataFrame(scaled, columns=scaler_features)[model_features]
        probability = float(active_model.predict_proba(model_input)[0, 1])

        final_score = probability
        if "skill_precision" in preferences:
            final_score *= 0.6 ** gap_count
        if "nearby_first" in preferences:
            final_score *= 1 / (1 + (distance_km * 0.1))

        match_score = round(final_score * 100, 2)
        wage = to_float(caregiver.get("wage"))
        experience_years = to_float(caregiver.get("experience_years"))
        within_budget = min_wage <= wage <= max_wage
        budget_overage = max(0.0, wage - max_wage)
        matched_skill_count = len([skill for skill in matched_skills.split(", ") if skill]) if matched_skills else 0
        budget_note = None if within_budget else f"เกินงบประมาณ {budget_overage:,.0f} บาท"
        cg_id = caregiver.get("caregiver_id", "Unknown")
        fb_info = feedback_dict.get(cg_id, {"average_rating": 0.0, "total_reviews": 0})
        
        results.append(
            {
                "caregiver_id": cg_id,
                "average_rating": fb_info["average_rating"],
                "total_reviews": fb_info["total_reviews"],
                "match_score": match_score,
                "distance_km": round(float(distance_km), 1),
                "matched_skills": matched_skills or "ดูแลทั่วไป",
                "all_skills": all_skills,
                "wage": wage,
                "within_budget": within_budget,
                "budget_overage": round(float(budget_overage), 1),
                "budget_note": budget_note,
                "budget_status": "within_budget" if within_budget else "over_budget",
                "matched_skill_count": matched_skill_count,
                "gap_count": gap_count,
                "experience_years": experience_years,
                "location": caregiver.get("location", "ไม่ระบุ"),
                "model": MODEL_FILE_MAP[model_key]["label"],
                "summary": build_reason(
                    match_score,
                    distance_km,
                    matched_skills or "ดูแลทั่วไป",
                    experience_years,
                    wage,
                    budget_note=budget_note,
                ),
            }
        )

    return results


def select_ai_matches(scored_results, wage_range):
    min_wage, max_wage = wage_range
    within_budget = [item for item in scored_results if item["within_budget"]]

    if within_budget:
        matches = sorted(within_budget, key=lambda item: item["match_score"], reverse=True)[:5]
        return {
            "matches": matches,
            "strategy": "within_budget",
            "message": f"พบผู้ดูแลที่อยู่ในงบประมาณ {min_wage:,.0f}-{max_wage:,.0f} บาท/เดือน",
        }

    skill_nearby = [item for item in scored_results if item["matched_skill_count"] > 0]
    if skill_nearby:
        matches = sorted(
            skill_nearby,
            key=lambda item: (
                -item["matched_skill_count"],
                item["distance_km"],
                item["budget_overage"],
                -item["match_score"],
            ),
        )[:5]
        return {
            "matches": matches,
            "strategy": "skill_nearby_fallback",
            "message": "ไม่พบผู้ดูแลที่อยู่ในงบประมาณที่ระบุ จึงแสดงผู้ดูแลที่ทักษะใกล้เคียงและอยู่ใกล้คุณ โดยรายการที่เกินงบประมาณจะมีป้ายแจ้งกำกับไว้",
        }

    matches = sorted(
        scored_results,
        key=lambda item: (
            item["distance_km"],
            item["budget_overage"],
            -item["match_score"],
        ),
    )[:5]
    return {
        "matches": matches,
        "strategy": "nearby_fallback",
        "message": "ไม่พบผู้ดูแลที่ตรงตามเงื่อนไขทั้งหมด จึงแสดงผู้ดูแลที่อยู่ใกล้คุณมากที่สุดแทน และรายการที่เกินงบประมาณจะมีป้ายแจ้งกำกับไว้",
    }


def run_ai_matching(elder_info, caregiver_df, model_key, preferences, wage_range):
    scored_results = score_ai_matches(elder_info, caregiver_df, model_key, preferences, wage_range)
    return select_ai_matches(scored_results, wage_range)["matches"]


def next_id(sheet_name, prefix):
    worksheet = get_sheet(sheet_name)
    rows = worksheet.get_all_values()
    return f"{prefix}{len(rows):03d}"


def build_caregiver_sheet_row(payload, caregiver_id):
    location = payload["location"]
    lat, lon = DISTRICT_COORDS[location]
    skills = payload["skills"]
    skill_row = [
        normalize_bool(skills.get("feeding")),
        normalize_bool(skills.get("bathing")),
        normalize_bool(skills.get("dressing")),
        normalize_bool(skills.get("toileting")),
        normalize_bool(skills.get("transfer")),
        normalize_bool(skills.get("wheelchair")),
    ]
    extra_skills = [
        normalize_bool(skills.get("wound_care")),
        normalize_bool(skills.get("tube_feeding")),
        normalize_bool(skills.get("medication")),
        normalize_bool(skills.get("dementia")),
        normalize_bool(skills.get("companionship")),
        0,
        0,
    ]

    row = [
        caregiver_id,
        payload["age"],
        payload["gender"],
        payload["course"],
        payload["experience_years"],
        *skill_row,
        *extra_skills,
        payload["care_time"],
        location,
        lat,
        lon,
        payload["wage"],
    ]
    return row


def find_caregiver_row_index(worksheet, caregiver_id):
    rows = worksheet.get_all_values()
    for index, row in enumerate(rows[1:], start=2):
        if row and row[0].strip() == caregiver_id:
            return index
    return None


def find_elder_row_index(worksheet, elder_id):
    rows = worksheet.get_all_values()
    for index, row in enumerate(rows[1:], start=2):
        if row and row[0].strip() == elder_id:
            return index
    return None


def parse_caregiver_sheet_row(row):
    padded = list(row) + [""] * max(0, CAREGIVER_SHEET_WIDTH - len(row))
    return {
        "age": to_int(padded[1]),
        "gender": padded[2],
        "course": padded[3],
        "experience_years": to_int(padded[4]),
        "care_time": padded[18],
        "location": padded[19],
        "wage": to_int(padded[22]),
        "skills": {
            "feeding": bool(to_int(padded[5])),
            "bathing": bool(to_int(padded[6])),
            "dressing": bool(to_int(padded[7])),
            "toileting": bool(to_int(padded[8])),
            "transfer": bool(to_int(padded[9])),
            "wheelchair": bool(to_int(padded[10])),
            "wound_care": bool(to_int(padded[11])),
            "tube_feeding": bool(to_int(padded[12])),
            "medication": bool(to_int(padded[13])),
            "dementia": bool(to_int(padded[14])),
            "companionship": bool(to_int(padded[15])),
        },
    }


def parse_elder_sheet_row(row):
    padded = list(row) + [""] * max(0, ELDER_SHEET_WIDTH - len(row))
    return {
        "age": to_int(padded[1]),
        "gender": padded[2],
        "care_time": padded[15],
        "location": padded[16],
        "wage_range": [to_int(padded[19]), to_int(padded[19])],
        "model": "random_forest",
        "preferences": [],
        "adl_scores": {
            "v1": to_int(padded[3]),
            "v2": to_int(padded[4]),
            "v3": to_int(padded[5]),
            "v4": to_int(padded[6]),
            "v5": to_int(padded[7]),
            "v6": to_int(padded[8]),
            "v7": to_int(padded[9]),
            "v8": to_int(padded[10]),
        },
    }


def get_logged_in_user(optional=True):
    verify_jwt_in_request(optional=optional)
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(int(user_id))


def build_caregiver_feedback_summary(user):
    if not user or user.user_type != "caregiver" or not user.caregiver_id:
        return None

    feedback_query = Feedback.query.filter_by(caregiver_sheet_id=user.caregiver_id)
    feedbacks = feedback_query.order_by(Feedback.created_at.desc()).all()
    if not feedbacks:
        return {
            "total_reviews": 0,
            "average_rating": 0.0,
            "latest_comment": None,
            "latest_rating": None,
            "latest_created_at": None,
        }

    avg_rating = sum(item.rating for item in feedbacks) / len(feedbacks)
    latest_with_comment = next((item for item in feedbacks if (item.comment or "").strip()), None)
    latest_feedback = latest_with_comment or feedbacks[0]

    return {
        "total_reviews": len(feedbacks),
        "average_rating": round(float(avg_rating), 2),
        "latest_comment": (latest_feedback.comment or "").strip() or None,
        "latest_rating": latest_feedback.rating,
        "latest_created_at": latest_feedback.created_at.isoformat() if latest_feedback.created_at else None,
    }


def save_caregiver(payload, caregiver_id=None):
    worksheet = get_sheet("Caregiver_Data")
    caregiver_id = caregiver_id or next_id("Caregiver_Data", "CG")
    row = build_caregiver_sheet_row(payload, caregiver_id)
    row_index = find_caregiver_row_index(worksheet, caregiver_id)

    if row_index:
        worksheet.update(range_name=f"A{row_index}:W{row_index}", values=[row])
        return caregiver_id, False

    worksheet.append_row(row)
    return caregiver_id, True


def attach_caregiver_to_logged_in_user(caregiver_id):
    """Bind a newly created caregiver sheet id to the logged-in caregiver account."""
    user = get_logged_in_user(optional=True)
    if not user or user.user_type != "caregiver":
        return None

    user.caregiver_id = caregiver_id

    pending_requests = HireRequest.query.filter(
        HireRequest.caregiver_sheet_id == caregiver_id,
        HireRequest.caregiver_user_id.is_(None),
    ).all()
    for hire_request in pending_requests:
        hire_request.caregiver_user_id = user.id

    db.session.commit()
    return user


def attach_elder_to_logged_in_user(elder_id):
    user = get_logged_in_user(optional=True)
    if not user or user.user_type != "elder":
        return None

    user.elder_id = elder_id
    db.session.commit()
    return user


def save_elder(payload, elder_id=None):
    worksheet = get_sheet("Elder_ADL_Data")
    elder_id = elder_id or next_id("Elder_ADL_Data", "E")
    location = payload["location"]
    lat, lon = DISTRICT_COORDS[location]
    adl = payload["adl_scores"]
    min_wage, max_wage = normalize_wage_range(payload["wage_range"])
    total_adl = compute_total_adl(adl)
    derived = derive_dependency(total_adl)

    row = [
        elder_id,
        payload["age"],
        payload["gender"],
        adl["v1"],
        adl["v2"],
        adl["v3"],
        adl["v4"],
        adl["v5"],
        adl["v6"],
        adl["v7"],
        adl["v8"],
        total_adl,
        derived["adl_group"],
        derived["health_status"],
        derived["dependency_level"],
        payload["care_time"],
        location,
        lat,
        lon,
        max_wage,
    ]

    row_index = find_elder_row_index(worksheet, elder_id)
    if row_index:
        worksheet.update(range_name=f"A{row_index}:T{row_index}", values=[row])
    else:
        worksheet.append_row(row)

    elder_info = {
        "elder_id": elder_id,
        "location": location,
        "care_time": payload["care_time"],
        "dependency_level": derived["dependency_level"],
        "adl_group": derived["adl_group"],
        **adl,
    }
    return elder_info


def validate_caregiver_payload(payload):
    required = ["age", "gender", "experience_years", "wage", "location", "course", "care_time", "skills"]
    for field in required:
        if field not in payload:
            raise ValueError(f"missing field: {field}")
    if payload["location"] not in DISTRICT_COORDS:
        raise ValueError("invalid location")
    if payload["care_time"] not in CARE_TIME_OPTIONS:
        raise ValueError("invalid care_time")


def validate_elder_payload(payload):
    required = ["age", "gender", "location", "care_time", "adl_scores", "wage_range", "model"]
    for field in required:
        if field not in payload:
            raise ValueError(f"missing field: {field}")
    if payload["location"] not in DISTRICT_COORDS:
        raise ValueError("invalid location")
    if payload["care_time"] not in CARE_TIME_OPTIONS:
        raise ValueError("invalid care_time")
    if payload["model"] not in MODEL_FILE_MAP:
        raise ValueError("invalid model")
    if len(payload["wage_range"]) != 2:
        raise ValueError("wage_range must contain min and max")


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"ok": True, "message": "ElderCare API is running"})


# ======================== Authentication Routes ========================

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """Register a new user"""
    payload = request.get_json(silent=True) or {}
    
    try:
        email = payload.get("email", "").strip().lower()
        password = payload.get("password", "").strip()
        full_name = payload.get("full_name", "").strip()
        user_type = payload.get("user_type", "").strip()
        phone = payload.get("phone", "").strip()
        
        # Validation
        if not email:
            return api_error("กรุณากรอกอีเมล", 400)
        if "@" not in email:
            return api_error("อีเมลไม่ถูกต้อง", 400)
        if not password or len(password) < 6:
            return api_error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", 400)
        if not full_name:
            return api_error("กรุณากรอกชื่อเต็ม", 400)
        if user_type not in ["elder", "caregiver"]:
            return api_error("ประเภทผู้ใช้ไม่ถูกต้อง", 400)
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return api_error("อีเมลนี้ถูกลงทะเบียนแล้ว", 400)
        
        # Create new user
        user = User(
            email=email,
            full_name=full_name,
            user_type=user_type,
            phone=phone
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "ok": True,
            "message": "สมัครสมาชิกสำเร็จ",
            "token": access_token,
            "user": user.to_dict(),
            "feedback_summary": build_caregiver_feedback_summary(user),
        }), 201
    
    except Exception as exc:
        db.session.rollback()
        return api_error(f"ไม่สามารถสมัครสมาชิกได้: {exc}", 500)


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Login user"""
    payload = request.get_json(silent=True) or {}
    
    try:
        email = payload.get("email", "").strip().lower()
        password = payload.get("password", "").strip()
        
        if not email or not password:
            return api_error("กรุณากรอกอีเมลและรหัสผ่าน", 400)
        
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return api_error("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401)
        
        if not user.is_active:
            return api_error("บัญชีนี้ถูกปิดใช้งาน", 401)
        
        # Create access token
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "ok": True,
            "message": "เข้าสู่ระบบสำเร็จ",
            "token": access_token,
            "user": user.to_dict()
        }), 200
    
    except Exception as exc:
        return api_error(f"ไม่สามารถเข้าสู่ระบบได้: {exc}", 500)


# ======================== Google OAuth Routes ========================

@app.route("/api/auth/google", methods=["GET"])
def google_login():
    """Redirect user to Google OAuth consent screen"""
    if not GOOGLE_CLIENT_ID:
        return api_error("Google OAuth ยังไม่ได้ตั้งค่า", 500)

    params = [
        f"client_id={GOOGLE_CLIENT_ID}",
        f"redirect_uri={GOOGLE_REDIRECT_URI}",
        "response_type=code",
        "scope=openid%20email%20profile",
        "access_type=offline",
        "prompt=select_account",
    ]
    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(params)
    return redirect(google_auth_url)


@app.route("/api/auth/google/callback", methods=["GET"])
def google_callback():
    """Handle Google OAuth callback — exchange code for token, then login/register user"""
    code = request.args.get("code")
    error = request.args.get("error")

    if error or not code:
        return redirect(f"{FRONTEND_URL}?google_error=access_denied")

    try:
        # Step 1: Exchange authorization code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = _json.dumps({
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }).encode("utf-8")

        token_req = urllib.request.Request(
            token_url,
            data=token_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(token_req) as resp:
            token_response = _json.loads(resp.read().decode("utf-8"))

        access_token = token_response.get("access_token")
        if not access_token:
            return redirect(f"{FRONTEND_URL}?google_error=no_token")

        # Step 2: Get user info from Google
        userinfo_req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        with urllib.request.urlopen(userinfo_req) as resp:
            google_user = _json.loads(resp.read().decode("utf-8"))

        email = google_user.get("email", "").lower()
        full_name = google_user.get("name", "") or google_user.get("email", "")
        google_id = google_user.get("sub", "")
        picture = google_user.get("picture", "")

        if not email:
            return redirect(f"{FRONTEND_URL}?google_error=no_email")

        # Step 3: Find or create user in database
        user = User.query.filter_by(email=email).first()
        is_new_user = False

        if not user:
            # New user — create account (ต้องให้เลือก user_type ในหน้า frontend)
            user = User(
                email=email,
                full_name=full_name,
                user_type="elder",  # default, user can change later
                google_id=google_id,
                avatar_url=picture,
                is_active=True,
            )
            user.set_password(os.urandom(24).hex())  # random password (ไม่ใช้ password login)
            db.session.add(user)
            db.session.commit()
            is_new_user = True
        else:
            # Existing user — update Google info
            if not user.google_id:
                user.google_id = google_id
            if picture and not user.avatar_url:
                user.avatar_url = picture
            db.session.commit()

        if not user.is_active:
            return redirect(f"{FRONTEND_URL}?google_error=account_disabled")

        # Step 4: Create JWT and redirect to frontend
        jwt_token = create_access_token(identity=str(user.id))
        user_data = _json.dumps(user.to_dict())

        redirect_url = (
            f"{FRONTEND_URL.rstrip('/')}/#google-callback"
            f"?token={urllib.parse.quote(jwt_token)}"
            f"&is_new={str(is_new_user).lower()}"
        )
        return redirect(redirect_url)

    except Exception as exc:
        import traceback
        with open("google_error.log", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
        print(f"Google OAuth error: {exc}")
        return redirect(f"{FRONTEND_URL}?google_error=server_error")


@app.route("/api/auth/google/token", methods=["POST"])
def google_token_login():
    """Login/Register ด้วย Google ID token ที่ได้จาก frontend (Google One Tap)"""
    payload = request.get_json(silent=True) or {}
    credential = payload.get("credential", "")

    if not credential:
        return api_error("ไม่พบ Google credential", 400)

    try:
        # Verify token with Google
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
        verify_req = urllib.request.Request(verify_url)
        with urllib.request.urlopen(verify_req) as resp:
            google_user = _json.loads(resp.read().decode("utf-8"))

        # Validate audience
        if GOOGLE_CLIENT_ID and google_user.get("aud") != GOOGLE_CLIENT_ID:
            return api_error("Token ไม่ถูกต้อง", 401)

        email = google_user.get("email", "").lower()
        full_name = google_user.get("name", "") or email
        google_id = google_user.get("sub", "")
        picture = google_user.get("picture", "")
        user_type = payload.get("user_type", "elder")

        if not email:
            return api_error("ไม่พบอีเมลจาก Google", 400)

        user = User.query.filter_by(email=email).first()
        is_new_user = False

        if not user:
            if user_type not in ["elder", "caregiver"]:
                user_type = "elder"
            user = User(
                email=email,
                full_name=full_name,
                user_type=user_type,
                google_id=google_id,
                avatar_url=picture,
                is_active=True,
            )
            user.set_password(os.urandom(24).hex())
            db.session.add(user)
            db.session.commit()
            is_new_user = True
        else:
            if not user.google_id:
                user.google_id = google_id
            if picture and not user.avatar_url:
                user.avatar_url = picture
            db.session.commit()

        if not user.is_active:
            return api_error("บัญชีนี้ถูกปิดใช้งาน", 401)

        jwt_token = create_access_token(identity=str(user.id))
        return jsonify({
            "ok": True,
            "message": "เข้าสู่ระบบด้วย Google สำเร็จ",
            "token": jwt_token,
            "user": user.to_dict(),
            "is_new_user": is_new_user,
            "feedback_summary": build_caregiver_feedback_summary(user),
        }), 200

    except Exception as exc:
        return api_error(f"ไม่สามารถยืนยัน Google token ได้: {exc}", 500)


@app.route("/api/auth/profile", methods=["GET"])
@jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return api_error("ไม่พบผู้ใช้", 404)
        
        return jsonify({
            "ok": True,
            "user": user.to_dict(),
            "feedback_summary": build_caregiver_feedback_summary(user),
        }), 200
    
    except Exception as exc:
        return api_error(f"ไม่สามารถดึงข้อมูลได้: {exc}", 500)


@app.route("/api/auth/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """Update user profile"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return api_error("ไม่พบผู้ใช้", 404)
        
        payload = request.get_json(silent=True) or {}
        
        # Update allowed fields
        if "full_name" in payload and payload["full_name"]:
            user.full_name = payload["full_name"].strip()
        if "phone" in payload and payload["phone"] is not None:
            user.phone = payload["phone"].strip()
        if "profile_image" in payload and payload["profile_image"]:
            user.profile_image = payload["profile_image"].strip()
        if "elder_id" in payload and user.user_type == "elder":
            user.elder_id = payload["elder_id"].strip() or None
        if "caregiver_id" in payload and user.user_type == "caregiver":
            user.caregiver_id = payload["caregiver_id"].strip() or None
        
        db.session.commit()
        
        return jsonify({
            "ok": True,
            "message": "อัพเดตโปรไฟล์สำเร็จ",
            "user": user.to_dict()
        }), 200
    
    except Exception as exc:
        db.session.rollback()
        return api_error(f"ไม่สามารถอัพเดตโปรไฟล์ได้: {exc}", 500)


@app.route("/api/auth/profile/image", methods=["POST"])
@jwt_required()
def upload_profile_image():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user:
            return api_error("ไม่พบผู้ใช้", 404)

        if "image" not in request.files:
            return api_error("กรุณาแนบไฟล์รูปภาพ", 400)

        image = request.files["image"]
        if image.filename == "":
            return api_error("กรุณาเลือกไฟล์รูปภาพ", 400)

        filename = secure_filename(image.filename)
        ext = os.path.splitext(filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
            return api_error("รองรับเฉพาะไฟล์ PNG, JPG, JPEG หรือ WEBP", 400)

        filename = f"profile_{user.id}_{int(time.time())}{ext}"
        upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        save_path = os.path.join(upload_dir, filename)
        image.save(save_path)

        image_url = url_for("static", filename=f"uploads/{filename}", _external=True)
        user.profile_image = image_url
        db.session.commit()

        return jsonify({
            "ok": True,
            "message": "อัปโหลดรูปภาพสำเร็จ",
            "profile_image": image_url,
            "user": user.to_dict(),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return api_error(f"ไม่สามารถอัปโหลดรูปได้: {exc}", 500)


@app.route("/api/auth/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return api_error("ไม่พบผู้ใช้", 404)
        
        payload = request.get_json(silent=True) or {}
        old_password = payload.get("old_password", "").strip()
        new_password = payload.get("new_password", "").strip()
        
        if not old_password or not new_password:
            return api_error("กรุณากรอกรหัสผ่านเก่าและใหม่", 400)
        
        if len(new_password) < 6:
            return api_error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", 400)
        
        if not user.check_password(old_password):
            return api_error("รหัสผ่านเก่าไม่ถูกต้อง", 401)
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({
            "ok": True,
            "message": "เปลี่ยนรหัสผ่านสำเร็จ"
        }), 200
    
    except Exception as exc:
        db.session.rollback()
        return api_error(f"ไม่สามารถเปลี่ยนรหัสผ่านได้: {exc}", 500)


# ======================== Config Routes ========================


@app.route("/api/config", methods=["GET"])
def config():
    return jsonify(
        {
            "ok": True,
            "districts": list(DISTRICT_COORDS.keys()),
            "careTimes": CARE_TIME_OPTIONS,
            "models": [
                {"value": key, "label": value["label"]}
                for key, value in MODEL_FILE_MAP.items()
            ],
            "skillLabels": SKILL_LABELS,
            "promptpay": {
                "id": PROMPTPAY_ID,
                "name": PROMPTPAY_NAME,
            },
        }
    )


@app.route("/api/caregivers/register", methods=["POST"])
def register_caregiver():
    payload = request.get_json(silent=True) or {}
    try:
        validate_caregiver_payload(payload)
        current_user = get_logged_in_user(optional=True)
        existing_caregiver_id = None
        if current_user and current_user.user_type == "caregiver":
            existing_caregiver_id = current_user.caregiver_id or None
        caregiver_id, created = save_caregiver(payload, caregiver_id=existing_caregiver_id)
        linked_user = attach_caregiver_to_logged_in_user(caregiver_id)
        return jsonify(
            {
                "ok": True,
                "message": "ลงทะเบียนผู้ดูแลเรียบร้อยแล้ว",
                "caregiver_id": caregiver_id,
                "created": created,
                "user": linked_user.to_dict() if linked_user else None,
            }
        )
    except ValueError as exc:
        return api_error(str(exc), 422)
    except Exception as exc:
        return api_error(f"ไม่สามารถบันทึกข้อมูลผู้ดูแลได้: {exc}", 500)


@app.route("/api/caregivers/me", methods=["GET"])
@jwt_required()
def get_my_caregiver_profile():
    try:
        user = get_logged_in_user(optional=False)
        if not user:
            return api_error("ไม่พบผู้ใช้", 404)
        if user.user_type != "caregiver":
            return api_error("เฉพาะผู้ดูแลเท่านั้น", 403)
        if not user.caregiver_id:
            return api_error("ยังไม่เคยลงทะเบียนผู้ดูแล", 404)

        worksheet = get_sheet("Caregiver_Data")
        row_index = find_caregiver_row_index(worksheet, user.caregiver_id)
        if not row_index:
            return api_error("ไม่พบข้อมูลผู้ดูแล", 404)

        row = worksheet.row_values(row_index)
        return jsonify(
            {
                "ok": True,
                "caregiver_id": user.caregiver_id,
                "form": parse_caregiver_sheet_row(row),
            }
        )
    except Exception as exc:
        return api_error(f"ไม่สามารถดึงข้อมูลผู้ดูแลได้: {exc}", 500)


@app.route("/api/elders/me", methods=["GET"])
@jwt_required()
def get_my_elder_profile():
    try:
        user = get_logged_in_user(optional=False)
        if not user:
            return api_error("ไม่พบผู้ใช้", 404)
        if user.user_type != "elder":
            return api_error("เฉพาะผู้สูงอายุเท่านั้น", 403)
        if not user.elder_id:
            return api_error("ยังไม่เคยลงทะเบียนผู้สูงอายุ", 404)

        worksheet = get_sheet("Elder_ADL_Data")
        row_index = find_elder_row_index(worksheet, user.elder_id)
        if not row_index:
            return api_error("ไม่พบข้อมูลผู้สูงอายุ", 404)

        row = worksheet.row_values(row_index)
        return jsonify(
            {
                "ok": True,
                "elder_id": user.elder_id,
                "form": parse_elder_sheet_row(row),
            }
        )
    except Exception as exc:
        return api_error(f"ไม่สามารถดึงข้อมูลผู้สูงอายุได้: {exc}", 500)


@app.route("/api/elders/match", methods=["POST"])
def match_elder():
    payload = request.get_json(silent=True) or {}
    try:
        validate_elder_payload(payload)
        wage_range = normalize_wage_range(payload["wage_range"])
        current_user = get_logged_in_user(optional=True)
        existing_elder_id = None
        if current_user and current_user.user_type == "elder":
            existing_elder_id = current_user.elder_id or None
        elder_info = save_elder(payload, elder_id=existing_elder_id)
        linked_user = attach_elder_to_logged_in_user(elder_info["elder_id"])
        caregivers = pd.DataFrame(get_sheet("Caregiver_Data").get_all_records()).fillna(0)
        scored_matches = score_ai_matches(
            elder_info=elder_info,
            caregiver_df=caregivers,
            model_key=payload["model"],
            preferences=payload.get("preferences", []),
            wage_range=wage_range,
        )
        matching_result = select_ai_matches(scored_matches, wage_range)

        caregiver_ids = [item["caregiver_id"] for item in matching_result["matches"] if item.get("caregiver_id")]
        if caregiver_ids:
            caregiver_users = User.query.filter(
                User.user_type == 'caregiver',
                User.caregiver_id.in_(caregiver_ids)
            ).all()
            caregiver_map = {
                user.caregiver_id: {
                    "profile_image": user.profile_image,
                    "avatar_url": user.avatar_url,
                }
                for user in caregiver_users
            }
            for item in matching_result["matches"]:
                matched_user = caregiver_map.get(item.get("caregiver_id"))
                if matched_user:
                    item["profile_image"] = matched_user.get("profile_image")
                    item["avatar_url"] = matched_user.get("avatar_url")
                else:
                    item["profile_image"] = None
                    item["avatar_url"] = None

        return jsonify(
            {
                "ok": True,
                "message": "วิเคราะห์และจับคู่สำเร็จ",
                "elder_id": elder_info["elder_id"],
                "adl_group": elder_info["adl_group"],
                "dependency_level": elder_info["dependency_level"],
                "match_strategy": matching_result["strategy"],
                "result_message": matching_result["message"],
                "matches": matching_result["matches"],
                "user": linked_user.to_dict() if linked_user else None,
            }
        )
    except ValueError as exc:
        return api_error(str(exc), 422)
    except Exception as exc:
        return api_error(f"ไม่สามารถวิเคราะห์ข้อมูลได้: {exc}", 500)


@app.route("/api/hire", methods=["POST"])
@jwt_required()
def hire_caregiver():
    """Elder ส่งคำขอจ้าง Caregiver"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.user_type != 'elder':
        return api_error("เฉพาะผู้สูงอายุเท่านั้นที่สามารถจ้างผู้ดูแลได้", 403)

    payload = request.get_json(silent=True) or {}
    caregiver_sheet_id = payload.get('caregiver_id', '').strip()
    message = payload.get('message', '').strip()

    if not caregiver_sheet_id:
        return api_error("กรุณาระบุรหัสผู้ดูแล", 400)

    # ตรวจสอบว่ามีการจ้างงานที่ได้รับการยอมรับแล้ว แต่ยังไม่เสร็จสิ้น
    active_hire = HireRequest.query.filter(
        HireRequest.elder_user_id == user_id,
        HireRequest.status == 'accepted'
    ).first()
    if active_hire:
        return api_error("คุณยังมีการจ้างงานที่ได้รับการยอมรับแล้ว กรุณาปิดงานก่อนจ้างใหม่", 400)

    # ตรวจสอบว่ามีคำขอ pending เดิมไปยังผู้ดูแลรายนี้แล้ว
    duplicate_request = HireRequest.query.filter(
        HireRequest.elder_user_id == user_id,
        HireRequest.caregiver_sheet_id == caregiver_sheet_id,
        HireRequest.status == 'pending'
    ).first()
    if duplicate_request:
        return jsonify({
            "ok": True,
            "message": "ส่งคำขอแล้ว",
            "hire_request_id": duplicate_request.id,
            "already_sent": True,
            "caregiver_found": duplicate_request.caregiver_user_id is not None
        }), 200

    # หา caregiver user account จาก caregiver_id
    caregiver_user = User.query.filter_by(caregiver_id=caregiver_sheet_id, user_type='caregiver').first()

    hire_request = HireRequest(
        elder_user_id=user_id,
        caregiver_sheet_id=caregiver_sheet_id,
        caregiver_user_id=caregiver_user.id if caregiver_user else None,
        message=message,
        status='pending'
    )
    db.session.add(hire_request)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": "ส่งคำขอจ้างสำเร็จ",
        "hire_request_id": hire_request.id,
        "caregiver_found": caregiver_user is not None,
        "already_sent": False
    }), 201


@app.route("/api/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    """ดึงรายการแจ้งเตือนของ user ที่ login อยู่"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)

    if user.user_type == 'caregiver':
        # Caregiver เห็นคำขอที่ส่งหาตัวเอง (ผ่าน user_id หรือ caregiver_id)
        filters = [HireRequest.caregiver_user_id == user_id]
        if user.caregiver_id:
            filters.append(HireRequest.caregiver_sheet_id == user.caregiver_id)
        from sqlalchemy import or_
        requests = HireRequest.query.filter(or_(*filters)).order_by(HireRequest.created_at.desc()).all()

        elder_ids = list({r.elder_user_id for r in requests})
        active_accepted_elder_ids = set()
        active_accepted_hire_ids = set()
        if elder_ids:
            active_rows = HireRequest.query.filter(
                HireRequest.elder_user_id.in_(elder_ids),
                HireRequest.status == 'accepted',
                HireRequest.chat_room.has(is_active=True)
            ).with_entities(HireRequest.id, HireRequest.elder_user_id).distinct().all()
            active_accepted_hire_ids = {row[0] for row in active_rows}
            active_accepted_elder_ids = {row[1] for row in active_rows}

        notifications = []
        for req in requests:
            data = req.to_dict()
            data["is_superseded"] = req.elder_user_id in active_accepted_elder_ids and req.id not in active_accepted_hire_ids
            notifications.append(data)
    else:
        # Elder เห็นคำขอที่ตัวเองส่งออกไป
        requests = HireRequest.query.filter_by(elder_user_id=user_id).order_by(HireRequest.created_at.desc()).all()
        notifications = [r.to_dict() for r in requests]

    if user.user_type == 'caregiver':
        unread_count = len([r for r in requests if r.status == 'pending'])
    else:
        unread_count = 0 # Elder doesn't have unread "pending" jobs, they sent them

    # === Add System Notifications ===
    sys_notifs = SystemNotification.query.filter_by(user_id=user_id).order_by(SystemNotification.created_at.desc()).all()
    
    unread_sys_notifs_count = len([n for n in sys_notifs if not n.is_read])
    unread_count += unread_sys_notifs_count

    for sn in sys_notifs:
        notifications.append({
            "is_system": True,
            "id": f"sys_{sn.id}",
            "db_id": sn.id,
            "message": sn.message,
            "type": sn.type,
            "is_read": sn.is_read,
            "created_at": sn.created_at.isoformat(),
            "reference_id": sn.reference_id
        })

    # Sort combined notifications by created_at desc
    notifications.sort(key=lambda x: x.get('created_at', ''), reverse=True)

    # === Add Unread Chat Messages ===
    from sqlalchemy import or_
    unread_chats = ChatMessage.query.join(ChatRoom).filter(
        ChatMessage.sender_id != user_id,
        ChatMessage.is_read == False,
        or_(ChatRoom.elder_user_id == user_id, ChatRoom.caregiver_user_id == user_id)
    ).count()
    
    total_unread = unread_count + unread_chats

    return jsonify({
        "ok": True,
        "notifications": notifications,
        "unread_count": total_unread
    })

@app.route("/api/notifications/read", methods=["PUT"])
@jwt_required()
def mark_notifications_read():
    """Mark all system notifications as read for the current user"""
    user_id = int(get_jwt_identity())
    SystemNotification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True, "message": "Marked as read"})


@app.route("/api/hire/<int:hire_id>/respond", methods=["PUT"])
@jwt_required()
def respond_hire(hire_id):
    """Caregiver ตอบรับหรือปฏิเสธคำขอจ้าง"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)

    # ตรวจสิทธิ์ว่าเป็น caregiver คนที่ถูกจ้าง
    is_owner = hire_request.caregiver_user_id == user_id
    is_matched_by_sheet = user.caregiver_id and user.caregiver_id == hire_request.caregiver_sheet_id
    if not (is_owner or is_matched_by_sheet):
        return api_error("ไม่มีสิทธิ์ตอบรับคำขอนี้", 403)

    if hire_request.status != 'pending':
        return api_error("คำขอนี้ได้รับการตอบรับแล้ว", 400)

    payload = request.get_json(silent=True) or {}
    action = payload.get('action', '')
    if action not in ['accept', 'reject']:
        return api_error("action ต้องเป็น accept หรือ reject", 400)

    chat_room_id = None
    if action == 'accept':
        existing_active = HireRequest.query.filter(
            HireRequest.elder_user_id == hire_request.elder_user_id,
            HireRequest.status == 'accepted',
            HireRequest.chat_room.has(is_active=True)
        ).first()
        if existing_active:
            hire_request.status = 'rejected'
            db.session.commit()
            return api_error("ผู้สูงอายุคนนี้ได้ผู้ดูแลแล้ว", 400)

        hire_request.status = 'accepted'
        hire_request.caregiver_user_id = user_id  # ผูก account

        chat_room = ChatRoom(
            hire_request_id=hire_request.id,
            elder_user_id=hire_request.elder_user_id,
            caregiver_user_id=user_id
        )
        db.session.add(chat_room)
        db.session.flush()

        welcome = ChatMessage(
            room_id=chat_room.id,
            sender_id=user_id,
            message=f"สวัสดีครับ/ค่ะ {hire_request.elder.full_name} ผม/หนูรับงานดูแลแล้วนะครับ/ค่ะ ยินดีให้บริการ 😊"
        )
        db.session.add(welcome)
        chat_room_id = chat_room.id

        # ปิดคำขอ pending อื่น ๆ ของ elder เดียวกันเมื่อมี caregiver รับงานแล้ว
        HireRequest.query.filter(
            HireRequest.elder_user_id == hire_request.elder_user_id,
            HireRequest.status == 'pending',
            HireRequest.id != hire_request.id
        ).update({"status": "rejected"}, synchronize_session=False)

        add_system_notification(
            user_id=hire_request.elder_user_id,
            message=f"ผู้ดูแล {user.full_name} ได้ตอบรับงานของคุณแล้ว",
            type="hire",
            reference_id=hire_request.id
        )
    else:
        hire_request.status = 'rejected'
        add_system_notification(
            user_id=hire_request.elder_user_id,
            message=f"ผู้ดูแล {user.full_name} ได้ปฏิเสธงานของคุณ",
            type="hire",
            reference_id=hire_request.id
        )

    db.session.commit()
    return jsonify({"ok": True, "message": "ตอบรับเรียบร้อย",
                    "status": hire_request.status, "chat_room_id": chat_room_id})


@app.route("/api/chat", methods=["GET"])
@jwt_required()
def list_chat_rooms():
    """รายการห้องแชทของ user ที่ login อยู่"""
    user_id = int(get_jwt_identity())
    from sqlalchemy import or_
    rooms = ChatRoom.query.filter(
        or_(ChatRoom.elder_user_id == user_id, ChatRoom.caregiver_user_id == user_id)
    ).order_by(ChatRoom.created_at.desc()).all()

    return jsonify({"ok": True, "rooms": [r.to_dict(viewer_id=user_id) for r in rooms]})


@app.route("/api/chat/<int:room_id>", methods=["GET"])
@jwt_required()
def get_chat_messages(room_id):
    """ดึงข้อความในห้องแชท"""
    user_id = int(get_jwt_identity())
    room = ChatRoom.query.get(room_id)
    if not room:
        return api_error("ไม่พบห้องแชท", 404)
    user = User.query.get(user_id)
    if room.elder_user_id != user_id and room.caregiver_user_id != user_id and user.user_type != "admin":
        return api_error("ไม่มีสิทธิ์เข้าห้องแชทนี้", 403)

    # Mark messages as read only if not admin
    if user.user_type != "admin":
        for msg in room.messages:
            if msg.sender_id != user_id:
                msg.is_read = True
        db.session.commit()


    # ดึงรูปโปรไฟล์ของทั้งสองฝ่ายเพื่อแสดงใน chat UI
    elder_user = User.query.get(room.elder_user_id)
    caregiver_user = User.query.get(room.caregiver_user_id)

    room_data = room.to_dict(viewer_id=user_id)
    room_data["status"] = room.hire_request.status if room.hire_request else None
    room_data["feedback_submitted"] = False
    if room.hire_request and room.hire_request.caregiver_sheet_id:
        room_data["feedback_submitted"] = Feedback.query.filter_by(
            elder_user_id=room.elder_user_id,
            caregiver_sheet_id=room.hire_request.caregiver_sheet_id,
            hire_request_id=room.hire_request_id,
        ).first() is not None
    room_data["caregiver_profile_image"] = caregiver_user.profile_image if caregiver_user else None
    room_data["caregiver_avatar_url"] = caregiver_user.avatar_url if caregiver_user else None
    room_data["elder_profile_image"] = elder_user.profile_image if elder_user else None
    room_data["elder_avatar_url"] = elder_user.avatar_url if elder_user else None

    return jsonify({
        "ok": True,
        "room": room_data,
        "messages": [m.to_dict() for m in room.messages],
        "my_user_id": user_id
    })



@app.route("/api/chat/<int:room_id>", methods=["POST"])
@jwt_required()
def send_message(room_id):
    """ส่งข้อความในห้องแชท"""
    user_id = int(get_jwt_identity())
    room = ChatRoom.query.get(room_id)
    if not room:
        return api_error("ไม่พบห้องแชท", 404)
    if room.elder_user_id != user_id and room.caregiver_user_id != user_id:
        return api_error("ไม่มีสิทธิ์ส่งข้อความในห้องนี้", 403)

    payload = request.get_json(silent=True) or {}
    message_text = payload.get('message', '').strip()
    if not message_text:
        return api_error("กรุณากรอกข้อความ", 400)

    # ตรวจสอบว่าห้องแชทยังเปิดอยู่หรือไม่
    if not room.is_active:
        return api_error("การแชทสิ้นสุดแล้ว (งานเสร็จสิ้น)", 403)

    msg = ChatMessage(room_id=room_id, sender_id=user_id, message=message_text)
    db.session.add(msg)
    db.session.commit()
    return jsonify({"ok": True, "message": msg.to_dict()}), 201


@app.route("/api/chat/<int:room_id>/upload_image", methods=["POST"])
@jwt_required()
def upload_chat_image(room_id):
    """ส่งรูปภาพพร้อมข้อความในห้องแชท"""
    user_id = int(get_jwt_identity())
    room = ChatRoom.query.get(room_id)
    if not room:
        return api_error("ไม่พบห้องแชท", 404)
    if room.elder_user_id != user_id and room.caregiver_user_id != user_id:
        return api_error("ไม่มีสิทธิ์ส่งข้อความในห้องนี้", 403)
    if not room.is_active:
        return api_error("การแชทสิ้นสุดแล้ว (งานเสร็จสิ้น)", 403)

    if "image" not in request.files:
        return api_error("กรุณาแนบไฟล์รูปภาพ", 400)

    image_file = request.files["image"]
    if image_file.filename == "":
        return api_error("กรุณาเลือกไฟล์", 400)

    message_text = request.form.get("message", "").strip()

    filename = secure_filename(image_file.filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        return api_error("รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, WEBP, GIF)", 400)

    chat_filename = f"chat_{room_id}_{user_id}_{int(time.time())}{ext}"
    upload_dir = os.path.join(os.path.dirname(__file__), "static", "chat_images")
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, chat_filename)
    image_file.save(save_path)

    image_url = url_for("static", filename=f"chat_images/{chat_filename}", _external=True)

    msg = ChatMessage(room_id=room_id, sender_id=user_id, message=message_text, image_url=image_url)
    db.session.add(msg)
    db.session.commit()
    
    return jsonify({"ok": True, "message": msg.to_dict()}), 201


@app.route("/api/hire/<int:hire_id>/complete", methods=["PUT"])
@jwt_required()
def complete_hire(hire_id):
    """ปิดงานและปิดห้องแชท — auto-release เงิน escrow ให้ผู้ดูแล"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)

    if user.user_type == 'elder':
        if hire_request.elder_user_id != user_id:
            return api_error("เฉพาะผู้สูงอายุผู้จ้างเท่านั้นที่สามารถปิดงานนี้ได้", 403)
        if hire_request.status not in ['accepted', 'completion_requested']:
            return api_error("งานยังไม่ได้รับการตอบรับหรือไม่ได้อยู่ในสถานะที่เหมาะสมสำหรับการปิดงาน", 400)
    elif user.user_type == 'caregiver':
        if hire_request.caregiver_user_id != user_id:
            return api_error("เฉพาะผู้ดูแลที่รับงานเท่านั้นที่สามารถยืนยันการจบงานได้", 403)
        if hire_request.status not in ['accepted', 'completion_requested']:
            return api_error("งานยังไม่พร้อมปิด", 400)
    else:
        return api_error("ไม่มีสิทธิ์ปิดงานนี้", 403)

    payment = Payment.query.filter_by(hire_request_id=hire_id).first()
    if not payment:
        return api_error("กรุณาชำระเงินก่อนจบงาน", 400)

    hire_request.status = 'completed'
    if hire_request.chat_room:
        hire_request.chat_room.is_active = False

    # Auto-release payment escrow เมื่อจบงาน
    payment_released = False
    payment_info = None
    from datetime import datetime
    if payment.status in ['held', 'pending_confirm']:
        payment.status = 'released'
        payment.released_at = datetime.utcnow()
        payment_released = True
        payment_info = payment.to_dict()

    db.session.commit()

    if hire_request.elder_user_id:
        add_system_notification(
            user_id=hire_request.elder_user_id,
            message=f"ผู้ดูแล {user.full_name} ได้ยืนยันการจบงานแล้ว (งานเสร็จสมบูรณ์)",
            type="hire",
            reference_id=hire_request.id
        )

    return jsonify({
        "ok": True,
        "message": "ปิดงานและห้องแชทเรียบร้อย" + (" พร้อม release เงินให้ผู้ดูแลแล้ว" if payment_released else ""),
        "payment_released": payment_released,
        "payment": payment_info,
    })


@app.route("/api/hire/<int:hire_id>/request-complete", methods=["PUT"])
@jwt_required()
def request_complete_hire(hire_id):
    """Elder ยื่นคำขอจบงานให้ผู้ดูแลยืนยัน"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)

    if user.user_type != 'elder' or hire_request.elder_user_id != user_id:
        return api_error("เฉพาะผู้สูงอายุผู้จ้างเท่านั้นที่สามารถส่งคำขอจบงานได้", 403)

    if hire_request.status == 'completed':
        return api_error("งานนี้ได้จบไปแล้ว", 400)
    if hire_request.status == 'completion_requested':
        return jsonify({"ok": True, "message": "คำขอจบงานได้ถูกส่งแล้ว"})
    if hire_request.status != 'accepted':
        return api_error("งานยังไม่ได้รับการตอบรับ", 400)

    payment = Payment.query.filter_by(hire_request_id=hire_id).first()
    if not payment:
        return api_error("กรุณาชำระเงินก่อนยื่นคำขอจบงาน", 400)

    hire_request.status = 'completion_requested'
    if hire_request.chat_room:
        request_message = ChatMessage(
            room_id=hire_request.chat_room.id,
            sender_id=user_id,
            message="ขอจบงาน: ผู้สูงอายุได้ยื่นคำขอจบงานแล้ว กรุณาตรวจสอบและยืนยัน"
        )
        db.session.add(request_message)
    if hire_request.caregiver_user_id:
        add_system_notification(
            user_id=hire_request.caregiver_user_id,
            message=f"ผู้สูงอายุได้ยื่นคำขอจบงาน (รอให้คุณกดยืนยันเพื่อรับเงิน)",
            type="hire",
            reference_id=hire_request.id
        )

    db.session.commit()
    return jsonify({"ok": True, "message": "ส่งคำขอจบงานเรียบร้อยแล้ว"})


# ======================== Payment (Escrow) Routes ========================

@app.route("/api/payment/create", methods=["POST"])
@jwt_required()
def create_payment():
    """Elder สร้างการชำระเงิน Escrow — ระบบหักค่าธรรมเนียมให้อัตโนมัติ"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.user_type != 'elder':
        return api_error("เฉพาะผู้สูงอายุเท่านั้นที่ชำระเงินได้", 403)

    payload = request.get_json(silent=True) or {}
    hire_request_id = payload.get('hire_request_id')
    amount = payload.get('amount')
    payment_method = payload.get('payment_method', 'promptpay')
    note = payload.get('note', '')

    if not hire_request_id:
        return api_error("กรุณาระบุ hire_request_id", 400)
    if not amount or float(amount) <= 0:
        return api_error("กรุณาระบุจำนวนเงินที่ถูกต้อง", 400)

    hire_request = HireRequest.query.get(hire_request_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)
    if hire_request.elder_user_id != user_id:
        return api_error("ไม่มีสิทธิ์ชำระเงินสำหรับงานนี้", 403)
    if hire_request.status not in ['accepted']:
        return api_error("งานยังไม่ได้รับการตอบรับ ไม่สามารถชำระเงินได้", 400)

    # ตรวจว่ามีการชำระเงินไปแล้ว
    existing = Payment.query.filter_by(hire_request_id=hire_request_id).first()
    if existing:
        return jsonify({"ok": True, "message": "ชำระเงินไปแล้ว", "payment": existing.to_dict(), "already_paid": True}), 200

    # ── คำนวณค่าธรรมเนียม ──────────────────────────────────────────────────
    PLATFORM_FEE_PCT = 10.0   # 10% ค่าธรรมเนียมแพลตฟอร์ม (ปรับได้)
    total = float(amount)
    fee = round(total * PLATFORM_FEE_PCT / 100, 2)
    payout = round(total - fee, 2)

    from datetime import datetime
    payment = Payment(
        hire_request_id=hire_request_id,
        elder_user_id=user_id,
        caregiver_user_id=hire_request.caregiver_user_id,
        caregiver_sheet_id=hire_request.caregiver_sheet_id,
        amount=total,
        platform_fee_pct=PLATFORM_FEE_PCT,
        platform_fee=fee,
        caregiver_payout=payout,
        status='held',
        payment_method=payment_method,
        note=note,
        held_at=datetime.utcnow(),
    )
    db.session.add(payment)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": f"ชำระเงิน {total:,.0f} บาท — แพลตฟอร์มหัก {fee:,.0f} บาท ({PLATFORM_FEE_PCT}%) — ผู้ดูแลได้รับ {payout:,.0f} บาท",
        "payment": payment.to_dict(),
        "already_paid": False,
    }), 201


@app.route("/api/payout-account", methods=["GET", "PUT"])
@jwt_required()
def payout_account():
    """Caregiver ดูหรืออัปเดตบัญชีรับเงิน (PromptPay / ธนาคาร)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.user_type not in ['caregiver']:
        return api_error("เฉพาะผู้ดูแลเท่านั้น", 403)

    if request.method == "GET":
        return jsonify({
            "ok": True,
            "payout_promptpay": user.payout_promptpay,
            "payout_bank_name": user.payout_bank_name,
            "payout_bank_account": user.payout_bank_account,
            "payout_account_name": user.payout_account_name,
        }), 200

    # PUT — อัปเดตบัญชีรับเงิน
    payload = request.get_json(silent=True) or {}
    user.payout_promptpay    = payload.get('payout_promptpay', user.payout_promptpay)
    user.payout_bank_name    = payload.get('payout_bank_name', user.payout_bank_name)
    user.payout_bank_account = payload.get('payout_bank_account', user.payout_bank_account)
    user.payout_account_name = payload.get('payout_account_name', user.payout_account_name)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": "อัปเดตบัญชีรับเงินสำเร็จ",
        "payout_promptpay": user.payout_promptpay,
        "payout_bank_name": user.payout_bank_name,
        "payout_bank_account": user.payout_bank_account,
        "payout_account_name": user.payout_account_name,
    }), 200


@app.route("/api/payment/<int:hire_id>", methods=["GET"])
@jwt_required()
def get_payment(hire_id):
    """ดึงข้อมูลการชำระเงินของงานนั้นๆ"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)

    # ตรวจสิทธิ์ — elder หรือ caregiver ของงานนี้
    is_elder = hire_request.elder_user_id == user_id
    is_caregiver = hire_request.caregiver_user_id == user_id or (
        user and user.caregiver_id == hire_request.caregiver_sheet_id
    )
    if not is_elder and not is_caregiver and not (user and user.is_admin):
        return api_error("ไม่มีสิทธิ์ดูข้อมูลการชำระเงิน", 403)

    payment = Payment.query.filter_by(hire_request_id=hire_id).first()
    if not payment:
        return jsonify({"ok": True, "payment": None, "message": "ยังไม่มีการชำระเงิน"}), 200

    return jsonify({"ok": True, "payment": payment.to_dict()}), 200


@app.route("/api/payment/<int:hire_id>/release", methods=["PUT"])
@jwt_required()
def release_payment(hire_id):
    """Release เงินให้ caregiver หลังจบงาน (เรียกอัตโนมัติพร้อม complete_hire)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)

    # เฉพาะ elder ผู้จ้าง หรือ admin เท่านั้น
    if hire_request.elder_user_id != user_id and not (user and user.is_admin):
        return api_error("ไม่มีสิทธิ์ปลดล็อคเงิน", 403)

    if hire_request.status != 'completed':
        return api_error("งานยังไม่เสร็จสิ้น ไม่สามารถปลดล็อคเงินได้", 400)

    payment = Payment.query.filter_by(hire_request_id=hire_id).first()
    if not payment:
        return api_error("ไม่พบข้อมูลการชำระเงิน", 404)
    if payment.status == 'released':
        return jsonify({"ok": True, "message": "เงินถูก release แล้ว", "payment": payment.to_dict()}), 200

    from datetime import datetime
    payment.status = 'released'
    payment.released_at = datetime.utcnow()
    db.session.commit()

    if hire_request.caregiver_user_id:
        add_system_notification(
            user_id=hire_request.caregiver_user_id,
            message=f"ระบบได้โอนเงินค่าจ้าง ฿{payment.amount:,.0f} ให้คุณเรียบร้อยแล้ว",
            type="payment",
            reference_id=payment.id
        )

    return jsonify({
        "ok": True,
        "message": f"ปลดล็อคเงิน {payment.amount:,.0f} บาท ให้ผู้ดูแลเรียบร้อยแล้ว",
        "payment": payment.to_dict(),
    }), 200


@app.route("/api/payment/my", methods=["GET"])
@jwt_required()
def my_payments():
    """ดึงรายการชำระเงินของตัวเอง (ทั้ง elder และ caregiver)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)

    if user.user_type == 'elder':
        payments = Payment.query.filter_by(elder_user_id=user_id).order_by(Payment.created_at.desc()).all()
    elif user.user_type == 'caregiver':
        payments = Payment.query.filter_by(caregiver_user_id=user_id).order_by(Payment.created_at.desc()).all()
    else:
        payments = Payment.query.order_by(Payment.created_at.desc()).all()

    return jsonify({"ok": True, "payments": [p.to_dict() for p in payments]}), 200


@app.route("/api/payment/<int:hire_id>/slip", methods=["POST"])
@jwt_required()
def upload_payment_slip(hire_id):
    """Elder อัปโหลดสลิปการโอนเงิน PromptPay"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)
    if hire_request.elder_user_id != user_id:
        return api_error("ไม่มีสิทธิ์อัปโหลดสลิปสำหรับงานนี้", 403)

    payment = Payment.query.filter_by(hire_request_id=hire_id).first()
    if not payment:
        return api_error("ยังไม่มีรายการชำระเงิน กรุณาสร้างรายการก่อน", 404)
    if payment.status == 'released':
        return api_error("เงินถูก release แล้ว", 400)

    if "slip" not in request.files:
        return api_error("กรุณาแนบไฟล์สลิป", 400)

    slip_file = request.files["slip"]
    if slip_file.filename == "":
        return api_error("กรุณาเลือกไฟล์", 400)

    filename = secure_filename(slip_file.filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".pdf"}:
        return api_error("รองรับเฉพาะไฟล์ PNG, JPG, JPEG, WEBP", 400)

    slip_filename = f"slip_{hire_id}_{user_id}_{int(time.time())}{ext}"
    upload_dir = os.path.join(os.path.dirname(__file__), "static", "slips")
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, slip_filename)
    slip_file.save(save_path)

    slip_url = url_for("static", filename=f"slips/{slip_filename}", _external=True)
    payment.slip_url = slip_url
    payment.status = 'held'
    db.session.commit()

    if hire_request.caregiver_user_id:
        add_system_notification(
            user_id=hire_request.caregiver_user_id,
            message=f"ผู้สูงอายุได้แจ้งโอนเงินค่าจ้าง ฿{payment.amount:,.0f} เข้าสู่ระบบแล้ว (รอการตรวจสอบสลิป)",
            type="payment",
            reference_id=payment.id
        )

    return jsonify({
        "ok": True,
        "message": "อัปโหลดสลิปสำเร็จ รอการยืนยัน",
        "slip_url": slip_url,
        "payment": payment.to_dict(),
    }), 200


@app.route("/api/payment/<int:hire_id>/confirm-slip", methods=["PUT"])
@jwt_required()
def confirm_slip(hire_id):
    """Admin หรือ Elder ยืนยันการรับเงิน → เปลี่ยนสถานะเป็น held (รอจบงาน)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    hire_request = HireRequest.query.get(hire_id)
    if not hire_request:
        return api_error("ไม่พบคำขอจ้างงาน", 404)

    is_admin = user and user.is_admin
    is_elder = hire_request.elder_user_id == user_id
    if not is_admin and not is_elder:
        return api_error("ไม่มีสิทธิ์ยืนยัน", 403)

    payment = Payment.query.filter_by(hire_request_id=hire_id).first()
    if not payment:
        return api_error("ไม่พบข้อมูลการชำระเงิน", 404)
    if payment.status not in ['pending_confirm']:
        return api_error("สถานะไม่ถูกต้อง ต้องอยู่ในสถานะรอยืนยัน", 400)

    payment.status = 'held'
    db.session.commit()

    if hire_request.caregiver_user_id:
        add_system_notification(
            user_id=hire_request.caregiver_user_id,
            message=f"ยืนยันสลิปการโอนเงินสำเร็จ เงินค่าจ้าง ฿{payment.amount:,.0f} ถูกพักไว้ในระบบ (Held) คุณสามารถเริ่มงานได้เลย",
            type="payment",
            reference_id=payment.id
        )
    if hire_request.elder_user_id != user_id: # ถ้า admin เป็นคนคอนเฟิร์ม ให้แจ้งเตือน elder ด้วย
        add_system_notification(
            user_id=hire_request.elder_user_id,
            message=f"สลิปเงินค่าจ้าง ฿{payment.amount:,.0f} ได้รับการตรวจสอบและยืนยันแล้ว",
            type="payment",
            reference_id=payment.id
        )

    return jsonify({
        "ok": True,
        "message": "ยืนยันการรับเงินสำเร็จ เงินพักรอการจบงาน",
        "payment": payment.to_dict(),
    }), 200


# ======================== Admin Routes ========================

SYSTEM_SETTINGS = {
    "min_experience_years": 0,
    "max_wage": 50000,
    "min_wage": 8000,
    "ai_model_default": "random_forest",
    "auto_approve": False,
    "matching_top_n": 5,
    "score_weights": {
        "skill_precision": 0.6,
        "nearby_factor": 0.1,
    }
}


def admin_required(fn):
    """Decorator: เฉพาะ admin เท่านั้น"""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or not user.is_admin:
            return api_error("ไม่มีสิทธิ์เข้าถึง (Admin only)", 403)
        return fn(*args, **kwargs)
    return wrapper


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    """Admin Login — แยกจาก user login ปกติ"""
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "").strip()

    if not email or not password:
        return api_error("กรุณากรอกอีเมลและรหัสผ่าน", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return api_error("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401)
    if not user.is_active:
        return api_error("บัญชีนี้ถูกปิดใช้งาน", 401)
    if not user.is_admin:
        return api_error("บัญชีนี้ไม่มีสิทธิ์แอดมิน", 403)

    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "ok": True,
        "message": "เข้าสู่ระบบแอดมินสำเร็จ",
        "token": access_token,
        "admin": user.to_dict()
    }), 200


@app.route("/api/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    """Dashboard: ภาพรวมสถิติแพลตฟอร์ม"""
    total_users = User.query.filter_by(is_admin=False).count()
    total_elders = User.query.filter_by(user_type="elder", is_admin=False).count()
    total_caregivers = User.query.filter_by(user_type="caregiver", is_admin=False).count()

    pending_elders = User.query.filter_by(user_type="elder", approval_status="pending").count()
    pending_caregivers = User.query.filter_by(user_type="caregiver", approval_status="pending").count()
    approved_users = User.query.filter_by(approval_status="approved").count()
    rejected_users = User.query.filter_by(approval_status="rejected").count()

    total_matches = HireRequest.query.count()
    pending_matches = HireRequest.query.filter_by(status="pending").count()
    accepted_matches = HireRequest.query.filter_by(status="accepted").count()
    completed_matches = HireRequest.query.filter_by(status="completed").count()
    rejected_matches = HireRequest.query.filter_by(status="rejected").count()

    total_feedbacks = Feedback.query.count()
    avg_rating = db.session.query(db.func.avg(Feedback.rating)).scalar() or 0
    avg_service = db.session.query(db.func.avg(Feedback.service_quality)).scalar() or 0
    avg_punctuality = db.session.query(db.func.avg(Feedback.punctuality)).scalar() or 0
    avg_communication = db.session.query(db.func.avg(Feedback.communication)).scalar() or 0

    # ข้อมูลผู้ใช้ 7 วันล่าสุด
    from datetime import datetime, timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    new_users_7d = User.query.filter(
        User.created_at >= seven_days_ago,
        User.is_admin == False
    ).count()
    new_matches_7d = HireRequest.query.filter(HireRequest.created_at >= seven_days_ago).count()

    # ลงทะเบียนรายวัน (30 วัน)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    daily_registrations = []
    for i in range(30):
        day = thirty_days_ago + timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = User.query.filter(
            User.created_at >= day,
            User.created_at < next_day,
            User.is_admin == False
        ).count()
        daily_registrations.append({
            "date": day.strftime("%Y-%m-%d"),
            "count": count
        })

    return jsonify({
        "ok": True,
        "stats": {
            "users": {
                "total": total_users,
                "elders": total_elders,
                "caregivers": total_caregivers,
                "pending_elders": pending_elders,
                "pending_caregivers": pending_caregivers,
                "approved": approved_users,
                "rejected": rejected_users,
                "new_7d": new_users_7d,
            },
            "matches": {
                "total": total_matches,
                "pending": pending_matches,
                "accepted": accepted_matches,
                "completed": completed_matches,
                "rejected": rejected_matches,
                "new_7d": new_matches_7d,
            },
            "feedback": {
                "total": total_feedbacks,
                "avg_rating": round(float(avg_rating), 2),
                "avg_service_quality": round(float(avg_service), 2),
                "avg_punctuality": round(float(avg_punctuality), 2),
                "avg_communication": round(float(avg_communication), 2),
            },
            "daily_registrations": daily_registrations,
        }
    })


@app.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_list_users():
    """รายชื่อผู้ใช้ทั้งหมด — พร้อม filter"""
    user_type = request.args.get("type", "")  # elder / caregiver / all
    status = request.args.get("status", "")   # pending / approved / rejected / all
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = User.query.filter_by(is_admin=False)
    if user_type in ("elder", "caregiver"):
        query = query.filter_by(user_type=user_type)
    if status in ("pending", "approved", "rejected"):
        query = query.filter_by(approval_status=status)

    query = query.order_by(User.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "ok": True,
        "users": [u.to_dict() for u in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    })


@app.route("/api/admin/users/<int:user_id>/approve", methods=["PUT"])
@admin_required
def admin_approve_user(user_id):
    """อนุมัติผู้ใช้"""
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)
    user.approval_status = "approved"
    user.is_active = True
    db.session.commit()
    return jsonify({"ok": True, "message": f"อนุมัติ {user.full_name} สำเร็จ", "user": user.to_dict()})


@app.route("/api/admin/users/<int:user_id>/reject", methods=["PUT"])
@admin_required
def admin_reject_user(user_id):
    """ปฏิเสธผู้ใช้"""
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)
    payload = request.get_json(silent=True) or {}
    user.approval_status = "rejected"
    db.session.commit()
    return jsonify({"ok": True, "message": f"ปฏิเสธ {user.full_name} แล้ว", "user": user.to_dict()})


@app.route("/api/admin/users/<int:user_id>/toggle-active", methods=["PUT"])
@admin_required
def admin_toggle_user_active(user_id):
    """เปิด/ปิดบัญชีผู้ใช้"""
    user = User.query.get(user_id)
    if not user:
        return api_error("ไม่พบผู้ใช้", 404)
    user.is_active = not user.is_active
    db.session.commit()
    status_text = "เปิดใช้งาน" if user.is_active else "ปิดใช้งาน"
    return jsonify({"ok": True, "message": f"{status_text}บัญชี {user.full_name} แล้ว", "user": user.to_dict()})


@app.route("/api/admin/matches", methods=["GET"])
@admin_required
def admin_list_matches():
    """รายการการจับคู่ทั้งหมด"""
    status = request.args.get("status", "")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = HireRequest.query
    if status in ("pending", "accepted", "rejected", "completed"):
        query = query.filter_by(status=status)

    query = query.order_by(HireRequest.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "ok": True,
        "matches": [r.to_dict() for r in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    })


@app.route("/api/admin/feedback", methods=["GET"])
@admin_required
def admin_list_feedback():
    """รายการ Feedback ทั้งหมด"""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    paginated = Feedback.query.order_by(Feedback.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # สถิติ Feedback รายโมเดล (จำลองจาก caregiver_sheet_id prefix)
    feedback_summary = {
        "total": Feedback.query.count(),
        "avg_rating": round(float(db.session.query(db.func.avg(Feedback.rating)).scalar() or 0), 2),
        "rating_distribution": {
            str(i): Feedback.query.filter_by(rating=i).count()
            for i in range(1, 6)
        }
    }

    return jsonify({
        "ok": True,
        "feedbacks": [f.to_dict() for f in paginated.items],
        "summary": feedback_summary,
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    })


@app.route("/api/admin/feedback/retrain", methods=["POST"])
@admin_required
def admin_trigger_retrain():
    """ส่งข้อมูล Feedback ไปยัง AI Engine เพื่อ retrain"""
    feedbacks = Feedback.query.all()
    if not feedbacks:
        return api_error("ไม่มีข้อมูล Feedback สำหรับ retrain", 400)

    # สรุปข้อมูลสำหรับส่ง retrain
    feedback_data = [f.to_dict() for f in feedbacks]
    avg_rating = sum(f["rating"] for f in feedback_data) / len(feedback_data)

    return jsonify({
        "ok": True,
        "message": f"ส่งข้อมูล {len(feedbacks)} รายการไปยัง AI Engine สำเร็จ (avg rating: {avg_rating:.2f})",
        "feedback_count": len(feedbacks),
        "avg_rating": round(avg_rating, 2),
        "status": "queued"
    })


@app.route("/api/admin/settings", methods=["GET"])
@admin_required
def admin_get_settings():
    """ดึงการตั้งค่าระบบ"""
    return jsonify({"ok": True, "settings": SYSTEM_SETTINGS})


@app.route("/api/admin/settings", methods=["PUT"])
@admin_required
def admin_update_settings():
    """อัปเดตการตั้งค่าระบบ"""
    payload = request.get_json(silent=True) or {}
    allowed_keys = set(SYSTEM_SETTINGS.keys())
    for key, value in payload.items():
        if key in allowed_keys:
            SYSTEM_SETTINGS[key] = value
    return jsonify({"ok": True, "message": "บันทึกการตั้งค่าสำเร็จ", "settings": SYSTEM_SETTINGS})


@app.route("/api/admin/create", methods=["POST"])
def create_admin():
    """สร้าง Admin account (เรียกได้เฉพาะเมื่อยังไม่มี admin ในระบบ)"""
    existing_admin = User.query.filter_by(is_admin=True).first()
    if existing_admin:
        return api_error("มี Admin ในระบบแล้ว — ติดต่อ Admin เดิมเพื่อสร้างบัญชีใหม่", 403)

    payload = request.get_json(silent=True) or {}
    secret = payload.get("secret", "")
    admin_secret = os.getenv("ADMIN_SECRET", "eldercare_admin_2026")
    if secret != admin_secret:
        return api_error("รหัสลับไม่ถูกต้อง", 403)

    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "").strip()
    full_name = payload.get("full_name", "ผู้ดูแลระบบ").strip()

    if not email or not password:
        return api_error("กรุณากรอกอีเมลและรหัสผ่าน", 400)
    if User.query.filter_by(email=email).first():
        return api_error("อีเมลนี้ถูกใช้งานแล้ว", 400)

    admin = User(
        email=email,
        full_name=full_name,
        user_type="admin",
        is_admin=True,
        approval_status="approved",
        is_active=True,
    )
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()

    return jsonify({"ok": True, "message": "สร้างบัญชี Admin สำเร็จ", "admin": admin.to_dict()}), 201


# ── Feedback (user route) ─────────────────────────────────────────────────────

@app.route("/api/feedback", methods=["POST"])
@jwt_required()
def submit_feedback():
    """ผู้ใช้ส่ง Feedback หลังได้รับบริการ"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.user_type != "elder":
        return api_error("เฉพาะผู้สูงอายุเท่านั้นที่สามารถให้ Feedback ได้", 403)

    payload = request.get_json(silent=True) or {}
    caregiver_sheet_id = payload.get("caregiver_sheet_id", "").strip()
    hire_request_id = payload.get("hire_request_id")
    rating = payload.get("rating")
    comment = payload.get("comment", "").strip()

    if not caregiver_sheet_id:
        return api_error("กรุณาระบุรหัสผู้ดูแล", 400)
    if not rating or not (1 <= int(rating) <= 5):
        return api_error("คะแนนต้องอยู่ระหว่าง 1-5", 400)

    existing_feedback = Feedback.query.filter_by(
        elder_user_id=user_id,
        caregiver_sheet_id=caregiver_sheet_id,
        hire_request_id=hire_request_id,
    ).first()
    if existing_feedback:
        return jsonify({
            "ok": True,
            "message": "บันทึก Feedback ไว้แล้ว",
            "feedback": existing_feedback.to_dict(),
            "already_submitted": True,
        }), 200

    feedback = Feedback(
        elder_user_id=user_id,
        caregiver_sheet_id=caregiver_sheet_id,
        hire_request_id=hire_request_id,
        rating=int(rating),
        comment=comment,
        service_quality=payload.get("service_quality"),
        punctuality=payload.get("punctuality"),
        communication=payload.get("communication"),
    )
    db.session.add(feedback)
    db.session.commit()

    return jsonify({"ok": True, "message": "บันทึก Feedback สำเร็จ", "feedback": feedback.to_dict()}), 201


@app.route("/api/caregivers/<caregiver_id>/reviews", methods=["GET"])
def get_caregiver_reviews(caregiver_id):
    """ดึงข้อมูลรีวิวของผู้ดูแล"""
    feedbacks = Feedback.query.filter_by(caregiver_sheet_id=caregiver_id).order_by(Feedback.created_at.desc()).all()
    return jsonify({
        "ok": True,
        "reviews": [f.to_dict() for f in feedbacks]
    })


# ── Admin: Payments List ──────────────────────────────────────────────────────

@app.route("/api/admin/payments", methods=["GET"])
@admin_required
def admin_list_payments():
    """รายการการชำระเงินทั้งหมด — admin"""
    status = request.args.get("status", "")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = Payment.query
    if status in ("held", "pending_confirm", "released", "refunded"):
        query = query.filter_by(status=status)

    query = query.order_by(Payment.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "ok": True,
        "payments": [p.to_dict() for p in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    })


# ── Admin: Chat Rooms List ────────────────────────────────────────────────────

@app.route("/api/admin/chat-rooms", methods=["GET"])
@admin_required
def admin_list_chat_rooms():
    """รายการห้องแชททั้งหมด — admin"""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    active_only = request.args.get("active", "")

    query = ChatRoom.query
    if active_only == "true":
        query = query.filter_by(is_active=True)
    elif active_only == "false":
        query = query.filter_by(is_active=False)

    query = query.order_by(ChatRoom.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    rooms_data = []
    for room in paginated.items:
        last_msg = room.messages.order_by(ChatMessage.created_at.desc()).first()
        d = room.to_dict()
        d["last_message"] = last_msg.message if last_msg else None
        rooms_data.append(d)

    return jsonify({
        "ok": True,
        "chat_rooms": rooms_data,
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
        "active_count": ChatRoom.query.filter_by(is_active=True).count(),
        "closed_count": ChatRoom.query.filter_by(is_active=False).count(),
    })


# ── Admin: Create New Admin (by existing admin) ───────────────────────────────

@app.route("/api/admin/create-new", methods=["POST"])
@admin_required
def create_admin_by_admin():
    """Admin สร้าง Admin บัญชีใหม่ — ต้องใส่ ADMIN_SECRET ยืนยัน"""
    payload = request.get_json(silent=True) or {}
    secret = payload.get("secret", "")
    admin_secret = os.getenv("ADMIN_SECRET", "eldercare_admin_2026")
    if secret != admin_secret:
        return api_error("รหัสลับไม่ถูกต้อง", 403)

    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "").strip()
    full_name = payload.get("full_name", "ผู้ดูแลระบบ").strip()

    if not email or not password:
        return api_error("กรุณากรอกอีเมลและรหัสผ่าน", 400)
    if len(password) < 6:
        return api_error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", 400)
    if User.query.filter_by(email=email).first():
        return api_error("อีเมลนี้ถูกใช้งานแล้ว", 400)

    new_admin = User(
        email=email,
        full_name=full_name,
        user_type="admin",
        is_admin=True,
        approval_status="approved",
        is_active=True,
    )
    new_admin.set_password(password)
    db.session.add(new_admin)
    db.session.commit()

    return jsonify({"ok": True, "message": f"สร้างบัญชี Admin '{full_name}' สำเร็จ", "admin": new_admin.to_dict()}), 201


# =============================================================================
# SUPPORT CHAT API
# =============================================================================

@app.route("/api/support/chat", methods=["GET"])
@jwt_required()
def get_my_support_chat():
    user_id = int(get_jwt_identity())
    room = SupportChatRoom.query.filter_by(user_id=user_id).first()
    if not room:
        room = SupportChatRoom(user_id=user_id, is_active=True)
        db.session.add(room)
        db.session.commit()

    mark_read = request.args.get("mark_read", "false").lower() == "true"
    if mark_read:
        # Mark user unread messages as read
        for msg in room.messages:
            if msg.is_admin_sender and not msg.is_read:
                msg.is_read = True
        db.session.commit()

    return jsonify({
        "ok": True,
        "room": room.to_dict(viewer_role="user"),
        "messages": [m.to_dict() for m in room.messages]
    })

@app.route("/api/support/chat", methods=["POST"])
@jwt_required()
def send_support_message():
    user_id = int(get_jwt_identity())
    payload = request.get_json(silent=True) or {}
    message_text = payload.get('message', '').strip()
    image_url = payload.get('image_url', None)

    if not message_text and not image_url:
        return api_error("กรุณากรอกข้อความหรือแนบรูป", 400)

    room = SupportChatRoom.query.filter_by(user_id=user_id).first()
    if not room:
        room = SupportChatRoom(user_id=user_id, is_active=True)
        db.session.add(room)
    else:
        if not room.is_active:
            room.is_active = True
    db.session.commit()

    msg = SupportChatMessage(
        room_id=room.id,
        is_admin_sender=False,
        message=message_text,
        image_url=image_url,
        is_read=False
    )
    db.session.add(msg)
    
    # Optional: Send system notification to admins? 
    # For now, admin just checks the tab.
    
    db.session.commit()

    return jsonify({"ok": True, "message": msg.to_dict()}), 201

@app.route("/api/admin/support/chats", methods=["GET"])

@app.route("/api/admin/support/chats/<int:room_id>/close", methods=["POST"])
@jwt_required()
def close_support_chat(room_id):
    admin_id = get_jwt_identity()
    admin = User.query.get(admin_id)
    if not admin or admin.role != "admin":
        return api_error("ไม่มีสิทธิ์เข้าถึง", 403)

    try:
        room = SupportChatRoom.query.get(room_id)
        if not room:
            return api_error("ไม่พบห้องแชท", 404)
        
        room.is_active = False
        room.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "ปิดเคสเรียบร้อยแล้ว", "room": room.to_dict(viewer_role="admin")}), 200
    except Exception as e:
        print(f"Error closing support chat: {str(e)}")
        return api_error("ไม่สามารถปิดเคสได้", 500)
@admin_required
def admin_list_support_chats():
    rooms = SupportChatRoom.query.order_by(SupportChatRoom.updated_at.desc()).all()
    return jsonify({"ok": True, "rooms": [r.to_dict(viewer_role="admin") for r in rooms]})

@app.route("/api/admin/support/chats/<int:room_id>", methods=["GET"])
@admin_required
def admin_get_support_chat(room_id):
    room = SupportChatRoom.query.get(room_id)
    if not room:
        return api_error("ไม่พบห้องแชท", 404)

    # Mark admin unread messages as read
    for msg in room.messages:
        if not msg.is_admin_sender and not msg.is_read:
            msg.is_read = True
    db.session.commit()

    return jsonify({
        "ok": True,
        "room": room.to_dict(viewer_role="admin"),
        "messages": [m.to_dict() for m in room.messages]
    })

@app.route("/api/admin/support/chats/<int:room_id>", methods=["POST"])
@admin_required
def admin_send_support_message(room_id):
    room = SupportChatRoom.query.get(room_id)
    if not room:
        return api_error("ไม่พบห้องแชท", 404)

    payload = request.get_json(silent=True) or {}
    message_text = payload.get('message', '').strip()
    image_url = payload.get('image_url', None)

    if not message_text and not image_url:
        return api_error("กรุณากรอกข้อความหรือแนบรูป", 400)

    msg = SupportChatMessage(
        room_id=room.id,
        is_admin_sender=True,
        message=message_text,
        image_url=image_url,
        is_read=False
    )
    db.session.add(msg)
    
    # Notify user
    add_system_notification(room.user_id, "มีข้อความใหม่จาก Admin (ระบบ Support)", "system")
    
    db.session.commit()

    return jsonify({"ok": True, "message": msg.to_dict()}), 201

if __name__ == "__main__":
    app.run(host=DEFAULT_HOST, port=DEFAULT_PORT, debug=True, use_reloader=False)
