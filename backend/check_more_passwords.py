import psycopg2

passwords = [
    "123", "postgre", "system", "manager", "user", "superuser",
    "postgres1", "postgres1234", "Pass1234", "112233", "123123",
    "qwerty123", "test", "demo", "dbpass", "master"
]

found = None
for p in passwords:
    try:
        conn = psycopg2.connect(
            dbname="ai_online_selling_db",
            user="postgres",
            password=p,
            host="localhost",
            port=5432,
            connect_timeout=2
        )
        print(f"FOUND: password='{p}'")
        conn.close()
        found = p
        break
    except Exception as e:
        err = str(e).strip().replace('\n', ' ')
        if "password authentication failed" not in err:
            print(f"Error on '{p}': {err}")

if not found:
    print("NO_MATCH_YET")
