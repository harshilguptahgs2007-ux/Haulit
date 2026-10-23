import sqlite3
import os
from datetime import datetime, timezone

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "haulit.db")

def run_migration():
    print(f"Running database migration on {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS partners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(120) NOT NULL,
        code VARCHAR(32) UNIQUE,
        contact_name VARCHAR(120),
        contact_email VARCHAR(254),
        phone VARCHAR(32),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicle_availabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        reason VARCHAR(120) NOT NULL DEFAULT 'other',
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_vehicle_availabilities_lookup 
    ON vehicle_availabilities (vehicle_id, is_active, start_time, end_time)
    """)

    cursor.execute("PRAGMA table_info(vehicles)")
    columns = [col[1] for col in cursor.fetchall()]

    if "partner_id" not in columns:
        print("Adding partner_id column to vehicles...")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN partner_id INTEGER REFERENCES partners(id)")

    if "partner_name" not in columns:
        print("Adding partner_name column to vehicles...")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN partner_name VARCHAR(120) DEFAULT 'Logistics Partner'")

    cursor.execute("PRAGMA table_info(vehicle_availabilities)")
    va_columns = [col[1] for col in cursor.fetchall()]
    if "reasons_json" not in va_columns:
        print("Adding reasons_json column to vehicle_availabilities...")
        cursor.execute("ALTER TABLE vehicle_availabilities ADD COLUMN reasons_json TEXT")

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM partners")
    partner_count = cursor.fetchone()[0]
    if partner_count == 0:
        print("Seeding initial partners...")
        partners_data = [
            ("Sharma Logistics", "PRT-SHR", "Vikram Sharma", "info@sharmalogistics.com", "+91 98111 22334"),
            ("Apex Freight Co.", "PRT-APX", "Rajesh Sharma", "contact@apexfreight.in", "+91 98765 43210"),
            ("QuickHaul Fleet Solutions", "PRT-QKH", "Amit Verma", "dispatch@quickhaul.in", "+91 98222 33445"),
            ("National Roadways Transport", "PRT-NRT", "Suresh Patel", "operations@nationalroadways.in", "+91 98333 44556"),
        ]
        cursor.executemany(
            "INSERT INTO partners (name, code, contact_name, contact_email, phone) VALUES (?, ?, ?, ?, ?)",
            partners_data
        )
        conn.commit()

    cursor.execute("SELECT id, name FROM partners")
    partners_map = {name: pid for pid, name in cursor.fetchall()}

    vehicle_partner_assignments = {
        1: ("Sharma Logistics", partners_map.get("Sharma Logistics")),
        2: ("Apex Freight Co.", partners_map.get("Apex Freight Co.")),
        3: ("QuickHaul Fleet Solutions", partners_map.get("QuickHaul Fleet Solutions")),
        4: ("National Roadways Transport", partners_map.get("National Roadways Transport")),
        5: ("Apex Freight Co.", partners_map.get("Apex Freight Co.")),
        6: ("QuickHaul Fleet Solutions", partners_map.get("QuickHaul Fleet Solutions")),
        7: ("Sharma Logistics", partners_map.get("Sharma Logistics")),
    }

    for vid, (pname, pid) in vehicle_partner_assignments.items():
        cursor.execute(
            "UPDATE vehicles SET partner_id = ?, partner_name = ? WHERE id = ? AND (partner_id IS NULL OR partner_name IS NULL)",
            (pid, pname, vid)
        )

    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
