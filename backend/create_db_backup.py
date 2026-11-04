import os
import subprocess
import datetime

backup_dir = r"c:\Users\Addisu\Desktop\AI_Online_Selling_System\backups"
os.makedirs(backup_dir, exist_ok=True)

timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_file = os.path.join(backup_dir, f"ai_online_selling_db_backup_{timestamp}.sql")

pg_dump_path = r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"

env = os.environ.copy()
env["PGPASSWORD"] = "ad30@17#"

cmd = [
    pg_dump_path,
    "-h", "localhost",
    "-p", "5432",
    "-U", "postgres",
    "-d", "ai_online_selling_db",
    "-F", "p",
    "-f", backup_file
]

print(f"Running pg_dump: {' '.join(cmd)}")
result = subprocess.run(cmd, env=env, capture_output=True, text=True)

if result.returncode == 0 and os.path.exists(backup_file):
    size = os.path.getsize(backup_file)
    print(f"SUCCESS: Backup created at {backup_file}")
    print(f"File size: {size:,} bytes")
    # Quick sanity check on content
    with open(backup_file, 'r', encoding='utf-8', errors='ignore') as f:
        head = [f.readline() for _ in range(10)]
    print("Backup header preview:")
    for line in head:
        print("  ", line.strip())
else:
    print(f"ERROR running pg_dump (code {result.returncode}):")
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
