"""Five-minute scoring ledger. All writes go through a serialized transaction."""
import argparse
import math
import sqlite3
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

PERIODS = ('daily', 'weekly', 'monthly', 'yearly')


def period_key(start, period, zone):
    day = datetime.fromtimestamp(start, ZoneInfo(zone)).date()
    if period == 'weekly':
        day -= timedelta(days=day.weekday())
    return {'daily': day.isoformat(), 'weekly': day.isoformat(),
            'monthly': day.isoformat()[:7], 'yearly': str(day.year)}[period]


def transact(db, action, period=None, level=None, grace=None, zone=None, clock=time.time):
    with db:
        db.execute('BEGIN IMMEDIATE')
        now = int(clock())
        start = now // 300 * 300
        db.execute('CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, grace INTEGER, zone TEXT)')
        db.execute('CREATE TABLE IF NOT EXISTS blocks(start INTEGER PRIMARY KEY, due INTEGER NOT NULL, period TEXT NOT NULL, level INTEGER NOT NULL, bucket TEXT NOT NULL, degree INTEGER, points TEXT)')
        for op in ('UPDATE', 'DELETE'):
            db.execute(f"CREATE TRIGGER IF NOT EXISTS lock_{op} BEFORE {op} ON blocks WHEN OLD.degree IS NOT NULL BEGIN SELECT RAISE(ABORT,'sealed block'); END")
        db.execute("INSERT OR IGNORE INTO settings VALUES(1,0,'UTC')")
        old_grace, old_zone = db.execute('SELECT grace,zone FROM settings').fetchone()
        # A pending earlier block must be settled before a later one. Grace is
        # fixed after the first entry so deadline order always equals start order.
        for s, p, l, b in db.execute('SELECT start,period,level,bucket FROM blocks WHERE degree IS NULL AND due<=? ORDER BY start', (now,)).fetchall():
            n = 1 + db.execute('SELECT count(*) FROM blocks WHERE degree IS NOT NULL AND period=? AND level=? AND bucket=?', (p,l,b)).fetchone()[0]
            db.execute('UPDATE blocks SET degree=?,points=? WHERE start=?', (n,str(math.comb(n+l-1,l)),s))
        if action == 'config':
            if db.execute('SELECT 1 FROM blocks LIMIT 1').fetchone():
                raise ValueError('تنظیمات پس از اولین بلوک ثابت است')
            if grace < 0:
                raise ValueError('مهلت اضافه نباید منفی باشد')
            ZoneInfo(zone)
            db.execute('UPDATE settings SET grace=?,zone=?',(grace,zone))
        elif action == 'set':
            if period not in PERIODS or not 1 <= level <= 100:
                raise ValueError('دوره نامعتبر یا سطح خارج از بازه ۱ تا ۱۰۰')
            db.execute('INSERT INTO blocks(start,due,period,level,bucket) VALUES(?,?,?,?,?) ON CONFLICT(start) DO UPDATE SET period=excluded.period,level=excluded.level,bucket=excluded.bucket', (start,start+300+old_grace,period,level,period_key(start,period,old_zone)))
        elif action != 'history':
            raise ValueError(action)
        return db.execute('SELECT start,due,period,level,degree,points FROM blocks ORDER BY start DESC').fetchall()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='eila.sqlite3')
    sub = parser.add_subparsers(dest='action', required=True)
    cfg = sub.add_parser('config')
    cfg.add_argument('--grace', type=int, default=0)
    cfg.add_argument('--zone', default='UTC')
    put = sub.add_parser('set')
    put.add_argument('period', choices=PERIODS)
    put.add_argument('level', type=int)
    sub.add_parser('history')
    args = vars(parser.parse_args())
    db = sqlite3.connect(args.pop('db'))
    try:
        rows = transact(db, **args)
        print('شروع (UTC) | مهلت ثبت (UTC) | دوره | سطح | درجه | امتیاز')
        for s,d,p,l,n,v in rows:
            print(*(datetime.fromtimestamp(t,ZoneInfo('UTC')).isoformat() for t in (s,d)),p,l,n or '—',v or 'در انتظار',sep=' | ')
    except (ValueError, KeyError, sqlite3.Error) as exc:
        parser.exit(1, f'{exc}\n')
    finally:
        db.close()


if __name__ == '__main__':
    main()
