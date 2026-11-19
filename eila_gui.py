"""Offline desktop interface for the Eila ledger."""
from pathlib import Path
import sqlite3
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime
from eila import transact


def main():
    root = tk.Tk()
    root.title('دفتر امتیاز پنج‌دقیقه‌ای')
    box = ttk.Frame(root, padding=16)
    box.pack(fill='both', expand=True)
    periods = {'روزانه':'daily', 'هفتگی':'weekly', 'ماهانه':'monthly', 'سالانه':'yearly'}
    def chooser(label, values):
        ttk.Label(box, text=label).pack(anchor='e')
        widget = ttk.Combobox(box, values=values, state='readonly')
        widget.current(0)
        widget.pack(fill='x', pady=4)
        return widget
    period = chooser('ضرب‌الاجل', list(periods))
    level = chooser('سطح امتیازدهی', [f'سطح {n}' for n in range(1,101)])
    db = sqlite3.connect(Path(__file__).resolve().with_name('eila.sqlite3'))
    def refresh(save=False):
        try:
            rows = transact(db,'set',periods[period.get()],level.current()+1) if save else transact(db,'history')
        except (ValueError,sqlite3.Error) as exc:
            messagebox.showerror('خطای ثبت',str(exc))
            return
        history.delete(0,'end')
        labels = {v:k for k,v in periods.items()}
        for start,_,p,l,n,v in rows:
            stamp = datetime.fromtimestamp(start).strftime('%Y-%m-%d %H:%M')
            score = f'درجه {n}، امتیاز {v}' if n else 'در انتظار پایان مهلت'
            history.insert('end',f'{stamp}   |   {labels[p]}   |   سطح {l}   |   {score}')
    ttk.Button(box,text='ثبت انتخاب برای این پنج دقیقه',command=lambda:refresh(True)).pack(pady=8)
    history = tk.Listbox(box,width=65)
    history.pack(fill='both',expand=True)
    def tick():
        refresh()
        root.after(5000,tick)
    tick()
    root.mainloop()
    db.close()

if __name__ == '__main__':
    main()
