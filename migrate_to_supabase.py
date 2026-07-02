"""
Migrate data from local SQLite (instance/eldercare.db) -> Supabase PostgreSQL
"""
import sqlite3
import os
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = os.getenv("SUPABASE_DATABASE_URL") or os.getenv("DATABASE_URL")
SQLITE_PATH = os.getenv("SQLITE_PATH", "instance/eldercare.db")

if not SUPABASE_URL:
    raise RuntimeError("Set SUPABASE_DATABASE_URL or DATABASE_URL before running migration.")

os.environ["DATABASE_URL"] = SUPABASE_URL

from app import app, db
from models import User, HireRequest, ChatRoom, ChatMessage, Feedback, Payment, SystemNotification, SupportChatRoom, SupportChatMessage
from sqlalchemy import text

# Connect to SQLite
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
sc = sqlite_conn.cursor()

with app.app_context():
    print("=== Starting migration from SQLite -> Supabase ===\n")

    # 1. USERS
    sc.execute("SELECT * FROM users ORDER BY id")
    sqlite_users = sc.fetchall()
    migrated_users = 0
    user_id_map = {}  # old_id -> new_id

    for row in sqlite_users:
        d = dict(row)
        existing = User.query.filter_by(email=d['email']).first()
        if existing:
            user_id_map[d['id']] = existing.id
            print(f"  [SKIP] User already exists: {d['email']} (supabase id={existing.id})")
            continue

        u = User()
        u.email = d['email']
        u.full_name = d.get('full_name') or ''
        u.user_type = d.get('user_type') or 'elder'
        u.phone = d.get('phone') or ''
        u.google_id = d.get('google_id')
        u.avatar_url = d.get('avatar_url')
        u.elder_id = d.get('elder_id')
        u.caregiver_id = d.get('caregiver_id')
        u.is_active = bool(d.get('is_active', 1))
        u.is_approved = bool(d.get('is_approved', 1))
        u.password_hash = d.get('password_hash')
        u.profile_image = d.get('profile_image')
        db.session.add(u)
        try:
            db.session.flush()
            user_id_map[d['id']] = u.id
            migrated_users += 1
            print(f"  [OK] Migrated user: {d['email']} (old id={d['id']} -> new id={u.id})")
        except Exception as e:
            db.session.rollback()
            print(f"  [ERR] User {d['email']}: {e}")

    db.session.commit()
    print(f"\nUsers: migrated {migrated_users}/{len(sqlite_users)}\n")

    # 2. HIRE REQUESTS
    sc.execute("SELECT * FROM hire_requests ORDER BY id")
    sqlite_hires = sc.fetchall()
    migrated_hires = 0

    for row in sqlite_hires:
        d = dict(row)
        elder_uid = user_id_map.get(d['elder_user_id'])
        cg_uid = user_id_map.get(d['caregiver_user_id']) if d.get('caregiver_user_id') else None
        if not elder_uid:
            print(f"  [SKIP] HireRequest id={d['id']}: elder_user_id={d['elder_user_id']} not found in map")
            continue

        hr = HireRequest(
            elder_user_id=elder_uid,
            caregiver_sheet_id=d.get('caregiver_sheet_id') or '',
            caregiver_user_id=cg_uid,
            message=d.get('message') or '',
            status=d.get('status') or 'pending',
        )
        db.session.add(hr)
        try:
            db.session.flush()
            migrated_hires += 1
        except Exception as e:
            db.session.rollback()
            print(f"  [ERR] HireRequest {d['id']}: {e}")

    db.session.commit()
    print(f"HireRequests: migrated {migrated_hires}/{len(sqlite_hires)}\n")

    # 3. FEEDBACKS
    sc.execute("SELECT * FROM feedbacks ORDER BY id")
    sqlite_feedbacks = sc.fetchall()
    migrated_fbs = 0

    for row in sqlite_feedbacks:
        d = dict(row)
        elder_uid = user_id_map.get(d.get('elder_user_id', 0))
        if not elder_uid:
            continue
        fb = Feedback(
            elder_user_id=elder_uid,
            caregiver_sheet_id=d.get('caregiver_sheet_id') or '',
            hire_request_id=None,
            rating=d.get('rating') or 5,
            comment=d.get('comment') or '',
        )
        db.session.add(fb)
        try:
            db.session.flush()
            migrated_fbs += 1
        except Exception as e:
            db.session.rollback()
            print(f"  [ERR] Feedback {d['id']}: {e}")

    db.session.commit()
    print(f"Feedbacks: migrated {migrated_fbs}/{len(sqlite_feedbacks)}\n")

    print("=== Migration complete! ===")
    # Final count
    total_users = User.query.count()
    print(f"  Total users in Supabase now: {total_users}")

sqlite_conn.close()
