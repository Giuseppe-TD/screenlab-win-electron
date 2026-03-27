import os
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 64, 128, 256]
os.makedirs("assets", exist_ok=True)

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    cr = int(size * 0.22)
    for y in range(size):
        t = y / size
        r,g,b = int(10+t*8), int(16+t*16), int(42+t*30)
        draw.line([(0,y),(size-1,y)], fill=(r,g,b,255))
    mask = Image.new("L", (size,size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,size-1,size-1], radius=cr, fill=255)
    img.putalpha(mask)
    def phone(cx,cy,w,h,alpha):
        r=max(2,int(w*0.18))
        x0,y0=int(cx-w/2),int(cy-h/2)
        x1,y1=int(cx+w/2),int(cy+h/2)
        d=ImageDraw.Draw(img)
        d.rounded_rectangle([x0,y0,x1,y1],radius=r,fill=(255,255,255,alpha))
        m=max(1,int(w*0.13)); mt=max(1,int(h*0.13)); mb=max(1,int(h*0.08))
        d.rounded_rectangle([x0+m,y0+mt,x1-m,y1-mb],radius=max(1,r//2),fill=(15,20,50,255))
    s=size
    phone(s*0.50,s*0.52,s*0.30,s*0.56,230)
    phone(s*0.26,s*0.56,s*0.21,s*0.40,160)
    phone(s*0.74,s*0.54,s*0.24,s*0.46,175)
    return img

icons = [draw_icon(s) for s in SIZES]
icons[0].save("assets/icon.ico", format="ICO", append_images=icons[1:], sizes=[(s,s) for s in SIZES])
icons[-1].save("assets/icon.png")
print("OK: assets/icon generati")
