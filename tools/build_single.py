#!/usr/bin/env python3
"""ساخت نسخهٔ تک‌فایل ایلا (eila.html) از فایل‌های پروژه.

همه‌چیز را داخل یک فایل HTML می‌گذارد: CSS، جاوااسکریپت و آیکون‌ها (base64).
نتیجه هیچ وابستگی به مسیر/سرور/پایتون ندارد — فقط دانلود و باز کن.

استفاده:
    python3 tools/build_single.py
خروجی: eila.html در ریشهٔ پروژه
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def data_uri(path: pathlib.Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")

    icon192 = ROOT / "icons" / "icon-192.png"
    icon512 = ROOT / "icons" / "icon-512.png"
    if not icon192.exists():
        print("خطا: icons/icon-192.png پیدا نشد", file=sys.stderr)
        return 1
    uri192 = data_uri(icon192)
    uri512 = data_uri(icon512) if icon512.exists() else uri192

    # ۱) آیکون نوتیفیکیشن → data-URI (دیگر هیچ مسیری لازم نیست)
    js = js.replace(
        "const NOTIF_ICON = './icons/icon-192.png';",
        f"const NOTIF_ICON = '{uri192}';",
    )
    if "NOTIF_ICON = './icons" in js:
        print("هشدار: جایگزینی آیکون نوتیف انجام نشد", file=sys.stderr)

    # ۲) CSS داخل <style>
    html = html.replace(
        '<link rel="stylesheet" href="style.css">',
        "<style>\n" + css + "\n</style>",
    )

    # ۳) JS داخل <script> — مراقب </script> داخل رشته‌ها باشیم
    js_safe = js.replace("</script", "<\\/script")
    html = html.replace(
        '<script src="app.js"></script>',
        "<script>\n" + js_safe + "\n</script>",
    )

    # ۴) فاوآیکون‌ها → data-URI
    html = html.replace('href="icons/icon-192.png"', f'href="{uri192}"')

    # ۵) مانیفست و فونت گوگل در تک‌فایل لازم نیست (آفلاین کامل) — حذفشان کن
    html = re.sub(r'<link rel="manifest"[^>]*>\s*', "", html)
    html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
    html = re.sub(
        r'<link href="https://fonts\.googleapis\.com[^>]*>\s*', "", html
    )

    # ۶) لینک دانلود داخل خودِ تک‌فایل بی‌معنی است — آن را به توضیح تبدیل کن
    html = html.replace(
        '<a class="btn full" href="eila.html" download="eila.html" '
        'style="display:block;text-align:center;text-decoration:none">'
        "📥 دانلود eila.html</a>",
        '<div class="hint">✅ داری نسخهٔ تک‌فایل را اجرا می‌کنی — همین یک فایل کافی است.</div>',
    )

    out = ROOT / "eila.html"
    out.write_text(html, encoding="utf-8")
    print(f"ساخته شد: {out} ({out.stat().st_size // 1024} KB)")
    print("حالا همین یک فایل را دانلود کن و با مرورگر بازش کن — تمام.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
