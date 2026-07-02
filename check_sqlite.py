import sqlite3

db_path = "instance/eldercare.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print("Tables:", tables)
print()

if "users" in tables:
    cursor.execute("SELECT id, email, full_name, user_type, google_id, elder_id, caregiver_id, created_at FROM users")
    rows = cursor.fetchall()
    print(f"=== USERS ({len(rows)} total) ===")
    for r in rows:
        print(f"  id={r['id']} | {r['email']} | {r['full_name']} | type={r['user_type']} | google={bool(r['google_id'])} | elder_id={r['elder_id']} | cg_id={r['caregiver_id']}")

# check other tables for row counts
for table in tables:
    if table != "users":
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        if count > 0:
            print(f"\n=== {table.upper()} ({count} rows) ===")
            cursor.execute(f"SELECT * FROM {table} LIMIT 3")
            rows = cursor.fetchall()
            for r in rows:
                print(f"  {dict(zip(r.keys(), tuple(r)))}")

conn.close()
