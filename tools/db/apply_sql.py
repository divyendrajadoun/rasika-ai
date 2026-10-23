"""Apply one SQL file to the database in an env file, then print what the browser roles may still do.

    apps/worker/.venv/Scripts/python.exe -I tools/db/apply_sql.py .env.worker-cloud apps/web/drizzle/0002_revoke_client_writes.sql
"""

import sys

import psycopg

env, sql = sys.argv[1], sys.argv[2]
url = next(l.split("=", 1)[1].strip().strip('"') for l in open(env) if l.startswith("DATABASE_URL="))
with psycopg.connect(url, prepare_threshold=None, autocommit=True) as c:
    c.execute(open(sql).read())
    print("applied", sql)
    rows = c.execute(
        "select grantee, table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants"
        " where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1, 2 order by 1, 2"
    ).fetchall()
    for r in rows:
        print(*r)
    print("server still reads profiles:", c.execute("select count(*) from profiles").fetchone()[0])
