import sqlite3
import unittest
from eila import transact


class LedgerTest(unittest.TestCase):
    def test_deadline_and_progression(self):
        db = sqlite3.connect(':memory:')
        def run(t, *args):
            return transact(db, *args, clock=lambda:t)
        run(0,'set','daily',1)
        run(299,'set','yearly',2)
        self.assertEqual(run(300,'history')[0][4:], (1,'1'))
        run(300,'set','yearly',2)
        self.assertEqual(run(700,'history')[0][4:], (2,'3'))
        for sql in ('DELETE FROM blocks','UPDATE blocks SET level=4'):
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(sql)
