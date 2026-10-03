import sys
from PIL import Image
kind=sys.argv[1]; poses=sys.argv[2].split(',') if len(sys.argv)>2 else ['idle','walk','run','punchL','heavy','jump','fly','hurt','dead']
ims=[Image.open(f'poses/{kind}_{p}.jpg') for p in poses]
w,h=ims[0].size; cw,ch=int(w*.40),int(h*.95); x0=(w-cw)//2; y0=int(h*.03)
cols=min(5,len(ims)); rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*cw,rows*ch))
for i,im in enumerate(ims): S.paste(im.crop((x0,y0,x0+cw,y0+ch)),((i%cols)*cw,(i//cols)*ch))
S.save(f'sheet_{kind}.png'); print(S.size)
