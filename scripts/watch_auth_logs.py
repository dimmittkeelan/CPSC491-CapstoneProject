#!/usr/bin/env python3

import argparse
import os
import sys
import time
from datetime import timezone

try:
    import psycopg
except ImportError:
    psycopg = None

if psycopg is None:
    try:
        import psycopg2 as psycopg
        import psycopg2.extras as psycopg_extras
    except ImportError:
        psycopg = None
        psycopg_extras = None
else:
    psycopg_extras = None


RED = "\033[31m"
RESET = "\033[0m"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--tail", type=int, default=20)
    parser.add_argument("--from-start", action="store_true")
    return parser.parse_args()


def require_database_url(value):
    if value:
        return value
    print("DATABASE_URL is required. Pass --database-url or set DATABASE_URL.", file=sys.stderr)
    sys.exit(1)


def connect(database_url):
    if psycopg is None:
        print(
            "Missing PostgreSQL driver. Install one of: `pip install psycopg[binary]` or `pip install psycopg2-binary`.",
            file=sys.stderr,
        )
        sys.exit(1)

    connection = psycopg.connect(database_url)
    if hasattr(connection, "autocommit"):
        connection.autocommit = True
    return connection


def fetch_initial_rows(cursor, tail):
    cursor.execute(
        """
        SELECT log_id, auth_id, uid, attempted_email, event_type, success,
               failure_reason, ip_address, user_agent, created_at
        FROM auth_logs
        ORDER BY log_id DESC
        LIMIT %s
        """,
        (tail,),
    )
    rows = cursor.fetchall()
    rows.reverse()
    return rows


def fetch_new_rows(cursor, last_log_id):
    cursor.execute(
        """
        SELECT log_id, auth_id, uid, attempted_email, event_type, success,
               failure_reason, ip_address, user_agent, created_at
        FROM auth_logs
        WHERE log_id > %s
        ORDER BY log_id ASC
        """,
        (last_log_id,),
    )
    return cursor.fetchall()


def fetch_last_log_id(cursor):
    cursor.execute("SELECT COALESCE(MAX(log_id), 0) FROM auth_logs")
    row = cursor.fetchone()
    return int(row[0] or 0)


def row_to_dict(row):
    if hasattr(row, "keys"):
        return dict(row)
    return {
        "log_id": row[0],
        "auth_id": row[1],
        "uid": row[2],
        "attempted_email": row[3],
        "event_type": row[4],
        "success": row[5],
        "failure_reason": row[6],
        "ip_address": row[7],
        "user_agent": row[8],
        "created_at": row[9],
    }


def format_timestamp(value):
    if value is None:
        return "-"
    if getattr(value, "tzinfo", None) is None:
        return value.isoformat(sep=" ", timespec="seconds")
    return value.astimezone(timezone.utc).isoformat(sep=" ", timespec="seconds")


def format_line(row):
    created_at = format_timestamp(row["created_at"])
    status = "SUCCESS" if row["success"] else "FAILED"
    email = row["attempted_email"] or "-"
    event_type = row["event_type"] or "-"
    uid = row["uid"] if row["uid"] is not None else "-"
    auth_id = row["auth_id"] if row["auth_id"] is not None else "-"
    ip_address = row["ip_address"] or "-"
    failure_reason = row["failure_reason"] or "-"
    return (
        f"[{created_at}] "
        f"log_id={row['log_id']} "
        f"status={status} "
        f"event={event_type} "
        f"uid={uid} "
        f"auth_id={auth_id} "
        f"email={email} "
        f"ip={ip_address} "
        f"reason={failure_reason}"
    )


def print_row(row):
    line = format_line(row)
    if not row["success"] and sys.stdout.isatty():
        print(f"{RED}{line}{RESET}", flush=True)
        return
    print(line, flush=True)


def make_cursor(connection):
    if psycopg_extras is not None:
        return connection.cursor(cursor_factory=psycopg_extras.RealDictCursor)
    return connection.cursor(row_factory=psycopg.rows.dict_row)


def watch(database_url, poll_interval, tail, from_start):
    connection = None
    last_log_id = 0
    first_connection = True

    while True:
        try:
            if connection is None or getattr(connection, "closed", False):
                connection = connect(database_url)
                cursor = make_cursor(connection)

                if first_connection:
                    if from_start:
                        initial_rows = fetch_initial_rows(cursor, tail)
                        for row in initial_rows:
                            row_dict = row_to_dict(row)
                            print_row(row_dict)
                            last_log_id = max(last_log_id, row_dict["log_id"])
                    else:
                        last_log_id = fetch_last_log_id(cursor)
                    first_connection = False
                else:
                    if last_log_id == 0:
                        last_log_id = fetch_last_log_id(cursor)
            else:
                cursor = make_cursor(connection)

            rows = fetch_new_rows(cursor, last_log_id)
            for row in rows:
                row_dict = row_to_dict(row)
                print_row(row_dict)
                last_log_id = row_dict["log_id"]

            cursor.close()
            time.sleep(poll_interval)
        except KeyboardInterrupt:
            if connection is not None and not getattr(connection, "closed", False):
                connection.close()
            print("\nStopped.", flush=True)
            return
        except Exception as error:
            if connection is not None and not getattr(connection, "closed", False):
                connection.close()
            connection = None
            print(f"Watcher error: {error}", file=sys.stderr, flush=True)
            time.sleep(max(poll_interval, 2.0))


def main():
    args = parse_args()
    database_url = require_database_url(args.database_url)
    watch(
        database_url=database_url,
        poll_interval=max(args.poll_interval, 0.5),
        tail=max(args.tail, 1),
        from_start=args.from_start,
    )


if __name__ == "__main__":
    main()
