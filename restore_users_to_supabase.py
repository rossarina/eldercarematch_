"""
Restore user accounts from local SQLite into the configured Supabase/Postgres DB.

This is safer than the one-time migration script for repeated use:
- matches existing users by email
- updates account fields instead of creating duplicate users
- keeps newer Supabase elder_id/caregiver_id values if SQLite has them blank
- rewrites localhost static image URLs to BACKEND_PUBLIC_URL when provided
"""
import os
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

SQLITE_PATH = os.getenv("SQLITE_PATH", "instance/eldercare.db")
BACKEND_PUBLIC_URL = (os.getenv("BACKEND_PUBLIC_URL") or "").rstrip("/")

from app import app, db
from models import User


def sqlite_columns(conn, table_name):
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table_name})")}


def existing_static_file(image_url):
    if not image_url or "/static/" not in image_url:
        return None
    static_path = image_url.split("/static/", 1)[1].replace("/", os.sep)
    return os.path.join(os.path.dirname(__file__), "static", static_path)


def normalize_image_url(image_url):
    if not image_url:
        return None
    if BACKEND_PUBLIC_URL and "/static/" in image_url:
        static_path = image_url.split("/static/", 1)[1]
        return f"{BACKEND_PUBLIC_URL}/static/{static_path}"
    return image_url


COPY_FIELDS = [
    "password_hash",
    "full_name",
    "user_type",
    "phone",
    "profile_image",
    "avatar_url",
    "google_id",
    "caregiver_id",
    "elder_id",
    "is_active",
    "is_admin",
    "approval_status",
    "payout_promptpay",
    "payout_bank_name",
    "payout_bank_account",
    "payout_account_name",
]


def value_from(row, field):
    value = row[field]
    if field == "profile_image":
        return normalize_image_url(value)
    return value


def main():
    if not os.path.exists(SQLITE_PATH):
        raise FileNotFoundError(f"SQLite database not found: {SQLITE_PATH}")

    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    columns = sqlite_columns(sqlite_conn, "users")
    rows = sqlite_conn.execute("SELECT * FROM users ORDER BY id").fetchall()

    restored = 0
    created = 0
    missing_images = []

    with app.app_context():
        for row in rows:
            email = (row["email"] or "").strip().lower()
            if not email:
                continue

            user = User.query.filter_by(email=email).first()
            if not user:
                user = User(email=email)
                db.session.add(user)
                created += 1

            original_image = row["profile_image"] if "profile_image" in columns else None
            local_file = existing_static_file(original_image)
            image_file_missing = bool(local_file and not os.path.exists(local_file))

            for field in COPY_FIELDS:
                if field not in columns or not hasattr(user, field):
                    continue
                if field == "profile_image" and image_file_missing:
                    continue
                value = value_from(row, field)
                if value in (None, "") and getattr(user, field, None) not in (None, ""):
                    continue
                setattr(user, field, value)

            if not user.password_hash:
                user.password_hash = row["password_hash"] if "password_hash" in columns else ""
            if not user.full_name:
                user.full_name = email
            if not user.user_type:
                user.user_type = "elder"

            if image_file_missing:
                missing_images.append((email, os.path.basename(local_file), original_image))

            restored += 1

        db.session.commit()

    sqlite_conn.close()

    print(f"Restored/updated users: {restored}")
    print(f"Created users: {created}")
    if missing_images:
        print("\nMissing local image files:")
        for email, filename, image_url in missing_images:
            print(f"  {email}: {filename} ({image_url})")
    else:
        print("No missing local image files referenced by SQLite users.")


if __name__ == "__main__":
    main()
