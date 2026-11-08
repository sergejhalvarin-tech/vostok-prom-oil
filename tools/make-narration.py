"""Синтез дикторской озвучки облёта нейросетевым мужским голосом.

Текст и параметры голоса — src/sections/narration.json. Результат — public/audio/narration/*.mp3.
Нужен пакет edge-tts:  python -m pip install --user edge-tts
Запуск:                python tools/make-narration.py
"""
import asyncio
import json
import pathlib

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'src/sections/narration.json').read_text(encoding='utf-8'))
out = ROOT / 'public/audio/narration'
out.mkdir(parents=True, exist_ok=True)


async def say(text, path):
    tts = edge_tts.Communicate(text, cfg['voice'], rate=cfg['rate'], pitch=cfg['pitch'])
    await tts.save(str(path))
    print('готово:', path.name)


async def main():
    for i, text in enumerate(cfg['chapters']):
        await say(text, out / f'{i}.mp3')
    await say(cfg['finale'], out / 'finale.mp3')
    # Сайт переключается на файлы вместо синтеза браузера.
    cfg['files'] = True
    text = json.dumps(cfg, ensure_ascii=False, indent=2) + chr(10)
    (ROOT / 'src/sections/narration.json').write_text(text, encoding='utf-8')


asyncio.run(main())
