"""Синтез дикторской озвучки облёта нейросетевым мужским голосом.

Текст и параметры голоса — src/sections/narration.json. Результат — public/audio/narration/*.mp3.
Каждая глава синтезируется по предложениям (сервис иногда отвечает пусто на отдельные фразы —
их повторяем) и склеивается ffmpeg с короткими паузами. Уже готовые главы с тем же текстом не переделываются.

Нужны пакет edge-tts (python -m pip install --user edge-tts) и ffmpeg в PATH.
Запуск:  python tools/make-narration.py
"""
import asyncio
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile

import aiohttp
import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
CFG_PATH = ROOT / 'src/sections/narration.json'
cfg = json.loads(CFG_PATH.read_text(encoding='utf-8'))
out = ROOT / 'public/audio/narration'
out.mkdir(parents=True, exist_ok=True)
stamps_path = out / 'stamps.json'
stamps = json.loads(stamps_path.read_text(encoding='utf-8')) if stamps_path.exists() else {}


async def sentence(text, path, attempts=10, pause=3):
    for attempt in range(attempts):
        # Системный (потоковый) резолвер DNS: асинхронный aiodns на части Windows-машин не находит DNS-серверы.
        conn = aiohttp.TCPConnector(resolver=aiohttp.ThreadedResolver())
        tts = edge_tts.Communicate(text, cfg['voice'], rate=cfg['rate'], pitch=cfg['pitch'], connector=conn)
        try:
            await tts.save(str(path))
            return
        except edge_tts.exceptions.NoAudioReceived:
            await asyncio.sleep(pause + attempt * pause)
    raise RuntimeError(text)


async def say(key, text):
    path = out / f'{key}.mp3'
    stamp = hashlib.sha1((text + cfg['voice'] + cfg['rate'] + cfg['pitch']).encode()).hexdigest()
    if path.exists() and stamps.get(key) == stamp:
        print('без изменений:', path.name)
        return
    # Сначала вся глава одним запросом (меньше запросов — реже отказы сервиса).
    try:
        await sentence(text, path, attempts=6, pause=12)
        stamps[key] = stamp
        stamps_path.write_text(json.dumps(stamps, indent=2), encoding='utf-8')
        print('готово целиком:', path.name)
        return
    except RuntimeError:
        print('целиком не вышло, по предложениям:', path.name)
    parts = [p.strip() for p in re.split(r'(?<=[.!?…])\s+', text) if p.strip()]
    with tempfile.TemporaryDirectory() as tmp:
        files = []
        for i, p in enumerate(parts):
            f = pathlib.Path(tmp) / f'{i}.mp3'
            try:
                await sentence(p, f, attempts=12, pause=8)
            except RuntimeError:
                raise SystemExit(f'не удалось синтезировать фразу: {p}')
            files.append(f)
        # Склейка с паузой 0,35 с между предложениями.
        silence = pathlib.Path(tmp) / 'gap.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.35', '-q:a', '4', str(silence)], check=True)
        lst = pathlib.Path(tmp) / 'list.txt'
        seq = []
        for i, f in enumerate(files):
            if i:
                seq.append(silence)
            seq.append(f)
        lst.write_text(''.join(f"file '{f.as_posix()}'\n" for f in seq), encoding='utf-8')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst),
                        '-ar', '24000', '-ac', '1', '-b:a', '64k', str(path)], check=True)
    stamps[key] = stamp
    stamps_path.write_text(json.dumps(stamps, indent=2), encoding='utf-8')
    print('готово:', path.name)


async def main():
    for i, text in enumerate(cfg['chapters']):
        await say(str(i), text)
    await say('finale', cfg['finale'])
    # Сайт переключается на файлы вместо синтеза браузера.
    cfg['files'] = True
    CFG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')


asyncio.run(main())
