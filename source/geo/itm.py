import math, numpy as np
from itmlogic.misc.qerfi import qerfi
from itmlogic.preparatory_subroutines.qlrpfl import qlrpfl
from itmlogic.statistics.avar import avar
DB=8.685890
def itm_loss(profile_m, dx_m, fmhz, htx, hrx, pol=1, q_rel=50, q_conf=50, climate=5, ens0=314, eps=15, sgm=0.005):
    """Basic transmission loss (dB) via ITM p2p for a terrain profile (list of elevations, tx first)."""
    n=len(profile_m)
    prop={'fmhz':fmhz,'hg':[htx,hrx],'ipol':pol,'eps':eps,'sgm':sgm,'klim':climate,'ens0':ens0,'lvar':5,'gma':157e-9}
    pfl=[n-1, dx_m]+list(profile_m)
    prop['pfl']=pfl; prop['kwx']=0; prop['wn']=fmhz/47.7; prop['ens']=ens0
    prop['gme']=prop['gma']*(1-0.04665*math.exp(prop['ens']/179.3))
    zq=complex(eps,376.62*sgm/prop['wn']); prop['zgnd']=np.sqrt(zq-1)
    if pol!=0: prop['zgnd']=prop['zgnd']/zq
    prop['klimx']=0; prop['mdvarx']=11
    zr=qerfi([q_rel/100])[0]; zc=qerfi([q_conf/100])[0]
    prop=qlrpfl(prop)
    fs=DB*math.log(2*prop['wn']*prop['dist'])
    a,prop=avar(zr,0,zc,prop)
    return fs+a, prop['kwx']
if __name__=="__main__":
    import time
    rng=np.random.default_rng(0)
    prof=np.clip(5+rng.normal(0,2,280).cumsum()*0.1,0,40)
    t=time.time()
    for k in range(20):
        L,kwx=itm_loss(prof[:50+k*10],90,3600,60,6)
    print("per call ms",(time.time()-t)/20*1000, L, kwx)
    # sanity: flat earth 5 km, 3.6 GHz, 60m/6m
    L,kwx=itm_loss(np.zeros(56),90,3600,60,6); fs=20*math.log10(4*math.pi*5000*3.6e9/3e8)
    print("flat 5km loss",L,"fspl",fs,kwx)
    L,kwx=itm_loss(np.zeros(223),90,3600,60,6); fs=20*math.log10(4*math.pi*20000*3.6e9/3e8)
    print("flat 20km loss",L,"fspl",fs,kwx)
    L,kwx=itm_loss(np.zeros(223),90,3600,60,1.5); print("flat 20km rx1.5",L)
