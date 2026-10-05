"""Cut-out crew renders for the main menu (public/brand/cast-<pose>.webp).

  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/menu_cast.py -- [names...]

Reuses the staging helpers from minigame_cards.py (alien import, lights,
camera) and renders each pose on a transparent background, lit with party
rim lights so the cut-outs sit well on the dark solar-system menu.
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
# Load the minigame-card helpers without running their render-everything main().
_src = open(os.path.join(HERE, 'minigame_cards.py'), encoding='utf-8').read()
_src = _src[: _src.rstrip().rfind('main()')]
mc = {'__file__': os.path.join(HERE, 'minigame_cards.py'), '__name__': 'minigame_cards'}
exec(compile(_src, 'minigame_cards.py', 'exec'), mc)
kit = mc['kit']

OUT = os.path.join(kit.ROOT, 'public', 'brand')
R = math.radians


def stage(w, h):
    scene = mc['begin']()
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.film_transparent = True
    # Brighter and more saturated than the card art: these sit on a near-black menu.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = -0.35
    mc['ambient']('#c4baff', 0.6)
    # warm key, soft fill, and two coloured party rims
    mc['area']((-3.5, -6, 5), (0, 0, 1.4), '#fff1dc', 1000, 5)
    mc['area']((4, -5, 2), (0, 0, 1.4), '#e6eeff', 380, 6)
    mc['lamp']((-3.2, 3.0, 3.2), '#ff4fd0', 1100, 1.2)
    mc['lamp']((3.4, 2.6, 2.6), '#33e0ff', 1100, 1.2)
    mc['bloom'](0.25, 1.2, 0.4)
    return scene


def render(name):
    os.makedirs(OUT, exist_ok=True)
    scene = bpy.context.scene
    s = scene.render.image_settings
    s.file_format = 'WEBP'
    s.color_mode = 'RGBA'
    s.quality = 86
    scene.render.filepath = os.path.join(OUT, 'cast-' + name + '.webp')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath, os.path.getsize(scene.render.filepath))


def die(loc, size, rot):
    """A chunky party die with rounded edges and inset pips (5 toward the camera)."""
    body = mc['box']('Die', mc['mat']('DieWhite', '#f7f9ff', rough=0.25, coat=0.6), (0, 0, 0), (size, size, size), (0, 0, 0), size * 0.22)
    pip = mc['mat']('Pip', '#2a3170', rough=0.3, coat=0.4)
    s = size / 2 + 0.001
    o = size * 0.25
    faces = {
        (0, -1, 0): [(-o, -o), (o, -o), (0, 0), (-o, o), (o, o)],  # 5 front
        (0, 0, 1): [(-o, -o), (o, o)],  # 2 top
        (1, 0, 0): [(-o, -o), (0, 0), (o, o)],  # 3 right
        (-1, 0, 0): [(-o, -o), (o, -o), (-o, o), (o, o)],  # 4 left
    }
    pips = []
    for n, spots in faces.items():
        for a, b in spots:
            if n[1]:
                p = (a, n[1] * s, b)
            elif n[2]:
                p = (a, b, n[2] * s)
            else:
                p = (n[0] * s, a, b)
            sc = tuple(0.35 if c else 1.0 for c in n)
            pips.append(mc['sphere']('Pip', pip, p, size * 0.085, sc, (0, 0, 0), 16))
    for p in pips:
        kit.parent(p, body)
    body.rotation_mode = 'XYZ'
    body.rotation_euler = tuple(R(a) for a in rot)
    body.location = loc
    return body


CAST = {}


def cast(fn):
    CAST[fn.__name__] = fn
    return fn


@cast
def cheer():
    stage(520, 640)
    mc['alien']((0, 0, 0), face=22, shirt='#f25265', pose='hop', tilt=(8, -10))
    mc['camera']((0.9, -4.3, 1.75), (0, 0, 1.38), 50)
    render('cheer')


@cast
def dice():
    stage(520, 760)
    mc['alien']((0, 0, 0.12), face=-12, shirt='#f4b62c', pose='cheer', tilt=(0, 4))
    die((-0.12, -0.1, 3.02), 0.86, (14, -10, -24))
    mc['camera']((-0.8, -5.0, 2.0), (0, 0, 1.75), 50)
    render('dice')


@cast
def wave():
    stage(520, 640)
    mc['alien']((0, 0, 0), face=-14, shirt='#2a9ff0', pose='wave', tilt=(0, 3))
    mc['camera']((-0.8, -4.3, 1.75), (0, 0, 1.38), 50)
    render('wave')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for n in argv or list(CAST):
        CAST[n]()


main()
