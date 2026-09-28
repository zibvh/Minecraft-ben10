# Analytic layout check of fixed/absolute HUD elements from the game's CSS, for several phone viewports.
# Rects are (left, top, right, bottom) in CSS px. Safe-area insets assumed 0 (worst case for overlap is unchanged).
def rects(W,H,portrait):
    r={}
    # joystick zone: left 20, bottom 20, 120x120
    r['joystick']=(20,H-20-120,140,H-20)
    # lock button: left 20, bottom = 20+132, 46x46
    lb=20+132; r['lock-btn']=(20,H-lb-46,66,H-lb)
    # action-buttons container: right 16, bottom 16, 180x150
    ab=(W-16-180,H-16-150,W-16,H-16)
    # individual buttons inside container (positions relative to container's right/bottom)
    R=W-16; B=H-16
    r['jump']=(R-64,B-64,R,B)
    r['attack']=(R-74-74,B-6-74,R-74,B-6)
    r['special']=(R-16-56,B-82-56,R-16,B-82)
    # alien action buttons (#actions): right 16, bottom 176, width 128 (2 per row of 58 + gap), up to 5 -> 3 rows
    small = H<=430
    aw,ah=(50,50) if small else (58,58); bot=158 if small else 176; wid=112 if small else 128
    rows=3
    r['actions']=(W-16-wid,H-bot-(ah*rows+8*(rows-1)),W-16,H-bot)
    # alien card: top 14, left 14, 190 x ~92
    r['alien-card']=(14,14,204,14+92)
    # squad panel: top-right, top 10; landscape: ~ up to 6 chips
    if portrait: r['squad']=(W-10-230,242,W-10,242+34)
    else: r['squad']=(W-10-230,10,W-10,10+34)
    # status text bottom 100 centered (transient) and alien banner top 80 centered (transient)
    return r
def ov(a,b): return not(a[2]<=b[0] or b[2]<=a[0] or a[3]<=b[1] or b[3]<=a[1])
views=[('Pixel-landscape 915x412',915,412,False),('Small-landscape 640x360',640,360,False),('iPhoneSE-land 667x375',667,375,False),('Tablet-land 1024x768',1024,768,False),('Portrait 412x915',412,915,True),('Portrait 360x640',360,640,True)]
bad=0
for name,W,H,por in views:
    r=rects(W,H,por); L=r['lock-btn']
    hits=[k for k,v in r.items() if k!='lock-btn' and ov(L,v)]
    # also off-screen check
    off = L[0]<0 or L[1]<0 or L[2]>W or L[3]>H
    print(f"{name:28s} lock-btn={tuple(round(x) for x in L)} overlaps={hits or 'none'} offscreen={off}")
    if hits or off: bad+=1
print('\nVIEWPORTS WITH PROBLEMS:',bad)
