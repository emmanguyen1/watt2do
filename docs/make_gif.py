"""
Generates docs/demo.gif — an animated walkthrough of Watt2Do.
Frames: Home -> Scan (camera HUD) -> Result (intact) -> Find drop-offs
Run with: venv/bin/python3 docs/make_gif.py
"""

from PIL import Image, ImageDraw, ImageFont
import os, math

OUT = os.path.join(os.path.dirname(__file__), "demo.gif")

W, H = 390, 760          # mobile-ish viewport
BG      = "#F2F5EE"      # app background
TX      = "#0E1410"      # text
MU      = "#4A5547"      # muted text
AC      = "#C6F432"      # accent lime
OL      = "#4F6F00"      # outline / dark lime
CD      = "#FFFFFF"      # card background
BD      = "#C4CEB8"      # border
RD      = "#C62828"      # red
RB      = "#FDECEA"      # red bg
SCAN_BG = "#050806"      # camera dark bg

def font(size, bold=False):
    # Try system fonts available on macOS
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNSText.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

def base_frame(label=None):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # Header bar
    d.rectangle([0, 0, W, 56], fill=BG)
    d.line([0, 56, W, 56], fill=BD, width=1)
    # Logo text
    d.text((16, 16), "Watt2Do", fill=TX, font=font(18, bold=True))
    # Bottom nav bar
    nav_y = H - 64
    d.rectangle([0, nav_y, W, H], fill=CD)
    d.line([0, nav_y, W, nav_y], fill=BD, width=1)
    tabs = [("Home", W//4), ("Scan", W//2), ("Find", 3*W//4)]
    for name, cx in tabs:
        active = label and name.lower() in label.lower()
        color = OL if active else MU
        d.text((cx, nav_y + 20), name, fill=color, font=font(13), anchor="mm")
        if active:
            d.rectangle([cx - 20, nav_y + 2, cx + 20, nav_y + 4], fill=AC)
    return img, d

# ── Frame 1: Home ──────────────────────────────────────────────────────────────
def frame_home():
    img, d = base_frame("Home")
    # Hero
    d.text((W//2, 110), "Watt2Do", fill=TX, font=font(32, bold=True), anchor="mm")
    d.text((W//2, 148), "Battery and e-waste disposal guide", fill=MU, font=font(14), anchor="mm")
    d.text((W//2, 165), "for Hillsborough County, FL", fill=MU, font=font(14), anchor="mm")
    # Battery icon (simple outline)
    bx, by = W//2 - 40, 190
    d.rounded_rectangle([bx, by, bx+80, by+40], radius=8, outline=OL, width=3)
    d.rectangle([bx+80, by+14, bx+88, by+26], fill=OL)
    # lightning bolt
    pts = [(W//2-4, by+8), (W//2-10, by+22), (W//2+2, by+22), (W//2-4, by+36)]
    d.polygon(pts, fill=AC)
    # CTA button
    d.rounded_rectangle([W//2-80, 260, W//2+80, 296], radius=12, fill=OL)
    d.text((W//2, 278), "Scan a battery", fill=AC, font=font(15, bold=True), anchor="mm")
    # Feature chips
    for i, txt in enumerate(["Auto-detect", "Condition check", "Drop-off finder"]):
        y = 320 + i * 36
        d.rounded_rectangle([32, y, W-32, y+28], radius=8, fill=CD, outline=BD, width=1)
        d.text((50, y+14), txt, fill=TX, font=font(13), anchor="lm")
        d.text((W-48, y+14), ">", fill=MU, font=font(13), anchor="lm")
    return img

# ── Frame 2: Scan — camera HUD ─────────────────────────────────────────────────
def frame_scan_hud():
    img, d = base_frame("Scan")
    d.text((W//2, 76), "Point camera at a battery or device", fill=MU, font=font(13), anchor="mm")
    # Camera viewfinder
    vx1, vy1, vx2, vy2 = 16, 90, W-16, 90+300
    d.rounded_rectangle([vx1, vy1, vx2, vy2], radius=20, fill=SCAN_BG, outline=OL, width=2)
    # Corner brackets
    s = 24
    for cx, cy, dx, dy in [(vx1+12,vy1+12,1,1),(vx2-12,vy1+12,-1,1),(vx1+12,vy2-12,1,-1),(vx2-12,vy2-12,-1,-1)]:
        d.line([cx, cy, cx+dx*s, cy], fill=AC, width=3)
        d.line([cx, cy, cx, cy+dy*s], fill=AC, width=3)
    # Center reticle
    mx, my = (vx1+vx2)//2, (vy1+vy2)//2
    d.ellipse([mx-18, my-18, mx+18, my+18], outline=AC, width=2)
    d.line([mx-6, my, mx+6, my], fill=AC, width=2)
    d.line([mx, my-6, mx, my+6], fill=AC, width=2)
    # Badge
    badge_w = 160
    bx1 = (vx1+vx2)//2 - badge_w//2
    d.rounded_rectangle([bx1, vy1+10, bx1+badge_w, vy1+30], radius=8, fill="#0E1410CC")
    d.text(((vx1+vx2)//2, vy1+20), "Autofocus Macro Active", fill=AC, font=font(11), anchor="mm")
    # Status text bottom of viewfinder
    d.text(((vx1+vx2)//2, vy2-16), "Scanning automatically...", fill=MU, font=font(12), anchor="mm")
    # Controls row
    ctrl_y = vy2 + 18
    # Zoom badge
    d.rounded_rectangle([20, ctrl_y, 86, ctrl_y+30], radius=8, fill="#0E1410")
    d.text((53, ctrl_y+15), "1x Wide", fill=AC, font=font(12), anchor="mm")
    # Flip
    d.rounded_rectangle([96, ctrl_y, 136, ctrl_y+30], radius=8, fill="#0E1410")
    d.text((116, ctrl_y+15), "Flip", fill="#fff", font=font(12), anchor="mm")
    # Torch
    d.rounded_rectangle([W-80, ctrl_y, W-20, ctrl_y+30], radius=8, fill="#0E1410")
    d.text((W-50, ctrl_y+15), "Torch", fill="#fff", font=font(12), anchor="mm")
    # Scan Now button
    sn_y = ctrl_y + 46
    d.rounded_rectangle([W//2-80, sn_y, W//2+80, sn_y+40], radius=12, fill=OL)
    d.text((W//2, sn_y+20), "Scan Now", fill=AC, font=font(15, bold=True), anchor="mm")
    return img

# ── Frame 3: Result — intact condition card ────────────────────────────────────
def frame_result_intact():
    img, d = base_frame("Scan")
    d.text((W//2, 76), "Scan complete", fill=MU, font=font(13), anchor="mm")
    # Condition card — green / intact
    cx1, cy1, cx2, cy2 = 20, 90, W-20, 170
    d.rounded_rectangle([cx1, cy1, cx2, cy2], radius=16, fill="#E8F5C8", outline=OL, width=2)
    d.text((W//2, cy1+28), "Intact and cool", fill=OL, font=font(20, bold=True), anchor="mm")
    d.text((W//2, cy1+52), "No visible damage detected", fill=OL, font=font(13), anchor="mm")
    d.text((W//2, cy1+70), "Safe to transport to a drop-off", fill=OL, font=font(12), anchor="mm")
    # Item card
    ic1, ic2 = 20, 185
    d.rounded_rectangle([ic1, ic2, W-20, ic2+80], radius=12, fill=CD, outline=BD, width=1)
    d.text((36, ic2+20), "AA Alkaline Battery", fill=TX, font=font(16, bold=True))
    d.text((36, ic2+42), "Category: Battery  |  Type: Alkaline", fill=MU, font=font(12))
    d.text((36, ic2+60), "Confidence: 88%", fill=MU, font=font(12))
    # Instructions
    d.text((20, 282), "What to do", fill=TX, font=font(15, bold=True))
    steps = [
        "Confirm the label says alkaline.",
        "Keep loose batteries out of curbside recycling.",
        "Drop off at a certified collection point.",
    ]
    for i, step in enumerate(steps):
        sy = 308 + i * 32
        d.ellipse([22, sy+4, 34, sy+16], fill=OL)
        d.text((30, sy+10), str(i+1), fill=AC, font=font(10), anchor="mm")
        d.text((42, sy+10), step, fill=TX, font=font(12), anchor="lm")
    # Find drop-off button
    fb_y = H - 180
    d.rounded_rectangle([20, fb_y, W-20, fb_y+44], radius=12, fill=OL)
    d.text((W//2, fb_y+22), "Find nearby drop-off", fill=AC, font=font(15, bold=True), anchor="mm")
    return img

# ── Frame 4: Result — damaged condition card ───────────────────────────────────
def frame_result_damaged():
    img, d = base_frame("Scan")
    d.text((W//2, 76), "Scan complete", fill=MU, font=font(13), anchor="mm")
    # Condition card — red / damaged
    cx1, cy1, cx2, cy2 = 20, 90, W-20, 180
    d.rounded_rectangle([cx1, cy1, cx2, cy2], radius=16, fill=RB, outline=RD, width=2)
    d.text((W//2, cy1+28), "Damaged battery detected", fill=RD, font=font(18, bold=True), anchor="mm")
    d.text((W//2, cy1+52), "Visible swelling on casing", fill=RD, font=font(13), anchor="mm")
    d.text((W//2, cy1+72), "Do not place in regular recycling", fill="#7A1C14", font=font(12), anchor="mm")
    d.text((W//2, cy1+90), "Call (813) 272-5680 before transporting", fill="#7A1C14", font=font(11), anchor="mm")
    # Safety steps
    d.text((20, 290), "Safety steps", fill=TX, font=font(15, bold=True))
    steps = [
        "If smoking or burning, move away and call 911.",
        "Do not charge or use. Leave battery in place.",
        "Keep out of trash and curbside recycling.",
        "Call county solid waste before transporting.",
    ]
    for i, step in enumerate(steps):
        sy = 316 + i * 34
        d.ellipse([22, sy+4, 34, sy+16], fill=RD)
        d.text((30, sy+10), "!", fill="#fff", font=font(10), anchor="mm")
        # Word-wrap at ~52 chars
        d.text((42, sy+10), step, fill=TX, font=font(11), anchor="lm")
    return img

# ── Frame 5: Find drop-offs map ────────────────────────────────────────────────
def frame_find():
    img, d = base_frame("Find")
    d.text((W//2, 76), "Drop-off locations near you", fill=MU, font=font(13), anchor="mm")
    # Map placeholder
    mx1, my1, mx2, my2 = 16, 90, W-16, 90+220
    d.rounded_rectangle([mx1, my1, mx2, my2], radius=16, fill="#D8E8D0", outline=BD, width=1)
    # Simple grid lines to suggest a map
    for gx in range(mx1+40, mx2, 40):
        d.line([gx, my1, gx, my2], fill="#C4CEB8", width=1)
    for gy in range(my1+40, my2, 40):
        d.line([mx1, gy, mx2, gy], fill="#C4CEB8", width=1)
    # Drop-off pins
    pins = [(130, 155), (210, 180), (280, 148), (170, 230), (250, 240)]
    for px, py in pins:
        d.ellipse([px-8, py-8, px+8, py+8], fill=OL)
        d.ellipse([px-4, py-4, px+4, py+4], fill=AC)
    # You-are-here
    d.ellipse([W//2-10, 200, W//2+10, 220], fill=RD, outline="#fff", width=2)
    # Filter chips
    fy = my2 + 12
    for i, (label, active) in enumerate([("All", False), ("Batteries", True), ("E-waste", False), ("Hazardous", False)]):
        fw = 80 if label == "Batteries" else 68
        fx = 16 + i * 90
        if fx + fw > W - 16:
            break
        bg = OL if active else CD
        tc = AC if active else TX
        d.rounded_rectangle([fx, fy, fx+fw, fy+28], radius=8, fill=bg, outline=BD if not active else OL, width=1)
        d.text((fx+fw//2, fy+14), label, fill=tc, font=font(12), anchor="mm")
    # Site cards
    sites = [
        ("Home Depot - Fowler", "0.4 mi", "Batteries, Hazardous"),
        ("Best Buy - Fowler", "0.5 mi", "Batteries, E-waste"),
        ("USF EHS Office", "1.1 mi", "Batteries, E-waste, Hazardous"),
    ]
    card_y = fy + 44
    for name, dist, accepts in sites:
        d.rounded_rectangle([16, card_y, W-16, card_y+54], radius=10, fill=CD, outline=BD, width=1)
        d.text((32, card_y+16), name, fill=TX, font=font(13, bold=True))
        d.text((32, card_y+36), dist + "  |  " + accepts, fill=MU, font=font(11))
        card_y += 64
        if card_y + 54 > H - 70:
            break
    return img

# ── Assemble GIF ───────────────────────────────────────────────────────────────
frames_config = [
    (frame_home,           100),   # 2.5s  home
    (frame_scan_hud,        80),   # 2.0s  camera HUD
    (frame_scan_hud,        60),   # 1.5s  still scanning...
    (frame_result_intact,  100),   # 2.5s  intact result
    (frame_result_damaged,  80),   # 2.0s  damaged result
    (frame_find,           120),   # 3.0s  drop-offs map
    (frame_home,            80),   # 2.0s  back to home (loop)
]

frames = []
durations = []
for fn, dur in frames_config:
    img = fn()
    frames.append(img.convert("P", palette=Image.ADAPTIVE, colors=200))
    durations.append(dur * 10)   # Pillow uses centiseconds (ms/10)

frames[0].save(
    OUT,
    format="GIF",
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    optimize=True,
)
print(f"Saved {OUT}  ({os.path.getsize(OUT) // 1024} KB)")
