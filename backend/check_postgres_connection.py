import psycopg2

ports = [5432, 5433]
passwords = [
    "postgres", "admin", "root", "123456", "1234", "12345", 
    "Addisu", "addisu", "password", "ai_online_selling_db", ""
]
users = ["postgres", "Addisu", "addisu"]

for port in ports:
    for u in users:
        for p in passwords:
            try:
                conn = psycopg2.connect(
                    dbname="ai_online_selling_db",
                    user=u,
                    password=p,
                    host="localhost",
                    port=port,
                    connect_timeout=2
                )
                print(f"FOUND ON PORT {port}! user='{u}', password='{p}'")
                conn.close()
                exit(0)
            except Exception as e:
                err_str = str(e).strip().replace('\n', ' ')
                if "does not exist" in err_str:
                    print(f"Port {port}: DB does not exist for user {u}")
                    break
                elif "password authentication failed" in err_str:
                    # wrong password, try next
                    continue
                else:
                    # other error
                    pass

print("Finished search on 5432 and 5433 without finding matching credentials.")
