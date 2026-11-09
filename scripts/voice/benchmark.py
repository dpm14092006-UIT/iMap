"""Reproducible macOS TTS -> actual faster-whisper benchmark, no microphone or API key.
Run with Python 3.12 + faster-whisper==1.2.1 (first run downloads base.en).
Audio/model cache stays outside Git. Not a human/accent/road-noise validation.
"""
import argparse, json, re, subprocess, time, wave
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

CORPUS = [
 ("fuel", "I'm running low on fuel. Find a gas station nearby."),
 ("school", "Find a school within two kilometers."),
 ("hospital", "Find a hospital near me."),
 ("toilets", "I need a public toilet."),
 ("cafe", "Find a coffee shop with at most five minutes extra."),
 ("parking", "Where can I park my car?"),
 ("unknown", "Find the station."),
 ("pharmacy", "Find a pharmacy with at most one kilometer extra."),
 ("atm", "Find an ATM nearby."),
 ("bus_stop", "Find a bus stop near me."),
 ("train_station", "Find a train station nearby."),
 ("library", "Find a public library."),
]
def words(s): return re.findall(r"[a-z0-9]+", s.lower().replace("'", ""))
def distance(a,b):
 row=list(range(len(b)+1))
 for i,x in enumerate(a,1):
  nxt=[i]
  for j,y in enumerate(b,1): nxt.append(min(nxt[-1]+1,row[j]+1,row[j-1]+(x!=y)))
  row=nxt
 return row[-1]
def main():
 p=argparse.ArgumentParser(); p.add_argument('--output',default='docs/voice/benchmark-results.json'); p.add_argument('--cache',default=str(Path.home()/'.cache/imap-voice')); args=p.parse_args()
 cache=Path(args.cache); audio=cache/'audio'; audio.mkdir(parents=True,exist_ok=True)
 model=WhisperModel('base.en',device='cpu',compute_type='int8',cpu_threads=4,download_root=str(cache/'models'))
 rows=[]; rng=np.random.default_rng(42)
 for condition,voice,rate,snr in [('clean_us','Samantha',175,None),('clean_uk','Daniel',175,None),('fast_us','Samantha',240,None),('noise_10db','Samantha',175,10)]:
  for i,(category,text) in enumerate(CORPUS):
   stem=audio/f'{condition}-{i}'; aiff=str(stem)+'.aiff'; wav=str(stem)+'.wav'
   subprocess.run(['say','-v',voice,'-r',str(rate),'-o',aiff,text],check=True)
   subprocess.run(['afconvert','-f','WAVE','-d','LEI16@16000','-c','1',aiff,wav],check=True)
   with wave.open(wav,'rb') as f: samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float32)/32768
   if snr is not None:
    power=np.mean(samples**2); samples=np.clip(samples+rng.normal(0,np.sqrt(power/10**(snr/10)),samples.shape),-1,1).astype(np.float32)
   started=time.perf_counter()
   segments,_=model.transcribe(samples,language='en',beam_size=5,temperature=0,condition_on_previous_text=False,vad_filter=False)
   transcript=' '.join(s.text.strip() for s in segments).strip(); elapsed=time.perf_counter()-started
   rows.append(dict(condition=condition,voice=voice,rate=rate,snrDb=snr,reference=text,expectedCategory=category,transcript=transcript,wordErrors=distance(words(text),words(transcript)),referenceWords=len(words(text)),audioSeconds=round(len(samples)/16000,3),seconds=round(elapsed,3)))
   print(condition,i,transcript,flush=True)
 result=dict(model='Systran/faster-whisper-base.en',engine='faster-whisper 1.2.1 / CPU int8',seed=42,generatedAudio=True,limitations='Synthetic macOS TTS, additive white noise. Not human speech, real road noise, browser ASR or Cloudflare model accuracy.',rows=rows)
 Path(args.output).write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
if __name__=='__main__': main()
