import sys
s=open('run48.py').read()
i=s.index("    pg.add_style_tag"); j=s.index("    b.close()")
new='''    print(pg.evaluate("featuresHtml(S.entries.get('cbriargullet').statblock,'cbriargullet')")[:2500])
'''
open('peekrun.py','w').write(s[:i]+new+s[j:])
