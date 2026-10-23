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

    cursor.execute("PRAGMA table_info(partners)")
    partner_columns = [col[1] for col in cursor.fetchall()]
    if "address" not in partner_columns:
        print("Adding address column to partners...")
        cursor.execute("ALTER TABLE partners ADD COLUMN address VARCHAR(255)")
    if "gstin" not in partner_columns:
        print("Adding gstin column to partners...")
        cursor.execute("ALTER TABLE partners ADD COLUMN gstin VARCHAR(32)")

    cursor.execute("PRAGMA table_info(vehicles)")
    columns = [col[1] for col in cursor.fetchall()]

    if "partner_id" not in columns:
        print("Adding partner_id column to vehicles...")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN partner_id INTEGER REFERENCES partners(id)")

    if "partner_name" not in columns:
        print("Adding partner_name column to vehicles...")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN partner_name VARCHAR(120) DEFAULT 'Logistics Partner'")

    if "plate_number" not in columns:
        print("Adding plate_number column to vehicles...")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN plate_number VARCHAR(32)")

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
            ("Sharma Logistics", "PRT-SHR", "Vikram Sharma", "info@sharmalogistics.com", "+91 98111 22334", "Plot 42, Transport Nagar, Nigdi, Pune, MH - 411044", "27AAACS1234A1Z5"),
            ("Apex Freight Co.", "PRT-APX", "Rajesh Sharma", "contact@apexfreight.in", "+91 98765 43210", "88 Okhla Industrial Area, Phase-III, New Delhi, DL - 110020", "07AAACA5678B1Z2"),
            ("QuickHaul Fleet Solutions", "PRT-QKH", "Amit Verma", "dispatch@quickhaul.in", "+91 98222 33445", "12 Koramangala Industrial Layout, Bengaluru, KA - 560034", "29AAACQ9012C1Z9"),
            ("National Roadways Transport", "PRT-NRT", "Suresh Patel", "operations@nationalroadways.in", "+91 98333 44556", "21 Ambattur Industrial Estate, Chennai, TN - 600058", "33AAACN3456D1Z3"),
        ]
        cursor.executemany(
            "INSERT INTO partners (name, code, contact_name, contact_email, phone, address, gstin) VALUES (?, ?, ?, ?, ?, ?, ?)",
            partners_data
        )
        conn.commit()
    else:
        partner_billing_updates = [
            ("Plot 42, Transport Nagar, Nigdi, Pune, MH - 411044", "27AAACS1234A1Z5", "Sharma Logistics"),
            ("88 Okhla Industrial Area, Phase-III, New Delhi, DL - 110020", "07AAACA5678B1Z2", "Apex Freight Co."),
            ("12 Koramangala Industrial Layout, Bengaluru, KA - 560034", "29AAACQ9012C1Z9", "QuickHaul Fleet Solutions"),
            ("21 Ambattur Industrial Estate, Chennai, TN - 600058", "33AAACN3456D1Z3", "National Roadways Transport"),
        ]
        for addr, gst, pname in partner_billing_updates:
            cursor.execute(
                "UPDATE partners SET address = ?, gstin = ? WHERE name = ? AND (address IS NULL OR gstin IS NULL)",
                (addr, gst, pname)
            )
        conn.commit()

    cursor.execute("SELECT id, name FROM partners")
    partners_map = {name: pid for pid, name in cursor.fetchall()}

    vehicle_assignments = {
        1: ("Sharma Logistics", partners_map.get("Sharma Logistics"), "MH-12-RN-4071"),
        2: ("Apex Freight Co.", partners_map.get("Apex Freight Co."), "DL-01-AB-1234"),
        3: ("QuickHaul Fleet Solutions", partners_map.get("QuickHaul Fleet Solutions"), "MH-14-GH-9923"),
        4: ("National Roadways Transport", partners_map.get("National Roadways Transport"), "TN-02-CC-8421"),
        5: ("Apex Freight Co.", partners_map.get("Apex Freight Co."), "TS-09-UB-7700"),
        6: ("QuickHaul Fleet Solutions", partners_map.get("QuickHaul Fleet Solutions"), "KA-04-E-5521"),
        7: ("Sharma Logistics", partners_map.get("Sharma Logistics"), "WB-19-K-3309"),
    }

    for vid, (pname, pid, plate) in vehicle_assignments.items():
        cursor.execute(
            """UPDATE vehicles 
               SET partner_id = COALESCE(partner_id, ?),
                   partner_name = COALESCE(partner_name, ?),
                   plate_number = COALESCE(plate_number, ?)
               WHERE id = ?""",
            (pid, pname, plate, vid)
        )

    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
