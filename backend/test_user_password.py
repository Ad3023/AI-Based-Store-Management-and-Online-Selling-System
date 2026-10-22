import psycopg2

if __name__ == '__main__':
    password = "ad30@17#"
    for port in [5432, 5433]:
        try:
            conn = psycopg2.connect(
                dbname="ai_online_selling_db",
                user="postgres",
                password=password,
                host="localhost",
                port=port,
                connect_timeout=3
            )
            print(f"SUCCESS: Connected to PostgreSQL 'ai_online_selling_db' on port {port} with user 'postgres'!")
            cur = conn.cursor()
            cur.execute("SELECT current_database(), current_user, version();")
            res = cur.fetchone()
            print(f"Database Details: {res}")
            conn.close()
            exit(0)
        except Exception as e:
            print(f"Failed on port {port}: {e}")

    exit(1)
