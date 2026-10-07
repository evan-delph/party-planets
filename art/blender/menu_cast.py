"""Backdrop art for the main menu (public/brand/menu-<name>.webp).

  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/menu_cast.py -- [names...]

Reuses the scene plumbing from minigame_cards.py. The menu carries no
characters (user rule): only the painted nebula layer that is screen-blended
over the solar-system scene by app/ui-menu.css.
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


CAST = {}


def cast(fn):
    CAST[fn.__name__] = fn
    return fn


@cast
def nebula():
    """Painted nebula skybox layer for the menu backdrop (screen-blended over the 3D void)."""
    scene = mc['begin']()
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1200
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.eevee.taa_render_samples = 8
    mc['ambient']('#000000', 0.0)
    bpy.ops.mesh.primitive_plane_add(size=2)
    plane = bpy.context.active_object
    plane.scale = (1.6, 1.0, 1.0)
    m = bpy.data.materials.new('Nebula')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.0
    nt.links.new(emit.outputs[0], out.inputs[0])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    obj = tc.outputs['Object']

    def noise(scale, detail, rough, w=0.0, distort=0.0):
        n = nt.nodes.new('ShaderNodeTexNoise')
        n.noise_dimensions = '4D'
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['W'].default_value = w
        n.inputs['Distortion'].default_value = distort
        nt.links.new(obj, n.inputs['Vector'])
        return n

    def ramp(src, stops):
        r = nt.nodes.new('ShaderNodeValToRGB')
        el = r.color_ramp.elements
        el[0].position, el[0].color = stops[0][0], kit.linear(stops[0][1])
        el[1].position, el[1].color = stops[-1][0], kit.linear(stops[-1][1])
        for pos, col in stops[1:-1]:
            e = el.new(pos)
            e.color = kit.linear(col)
        nt.links.new(src, r.inputs['Fac'])
        return r

    def mixc(a, b, blend='ADD', fac=1.0):
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = blend
        mx.inputs['Factor'].default_value = fac
        nt.links.new(a, mx.inputs[6])
        nt.links.new(b, mx.inputs[7])
        return mx.outputs[2]

    # big billowing gas: violet body, magenta highlights, teal pockets
    gas = noise(0.9, 12, 0.6, 1.7, 0.35)
    body = ramp(gas.outputs['Fac'], [(0.42, '#000000'), (0.52, '#241060'), (0.59, '#6a2bd6'), (0.65, '#ff5ac8'), (0.73, '#ffd6f2')])
    tealn = noise(1.4, 10, 0.6, 8.2, 0.2)
    teal = ramp(tealn.outputs['Fac'], [(0.52, '#000000'), (0.62, '#0b4a7a'), (0.7, '#20c4e8'), (0.78, '#d0fbff')])
    wisp = noise(4.5, 14, 0.7, 3.3, 0.8)
    wisps = ramp(wisp.outputs['Fac'], [(0.5, '#000000'), (0.66, '#3a1a8a'), (0.78, '#ff7ad8')])
    col = mixc(body.outputs[0], teal.outputs[0], 'SCREEN', 0.9)
    col = mixc(col, wisps.outputs[0], 'ADD', 0.45)
    # dark dust lanes carve the gas
    dust = noise(2.6, 8, 0.55, 5.0, 0.5)
    lanes = ramp(dust.outputs['Fac'], [(0.44, '#060606'), (0.58, '#ffffff')])
    col = mixc(col, lanes.outputs[0], 'MULTIPLY', 1.0)
    # star field: two voronoi layers (fine dust + a few bright stars)
    for scale, size, gate, bright in ((220, 0.09, 0.8, 1.8), (60, 0.07, 0.86, 4.0), (16, 0.035, 0.9, 9.0)):
        v = nt.nodes.new('ShaderNodeTexVoronoi')
        v.feature = 'F1'
        v.inputs['Scale'].default_value = scale
        v.inputs['Randomness'].default_value = 1.0
        nt.links.new(obj, v.inputs['Vector'])
        st = ramp(v.outputs['Distance'], [(0.0, '#ffffff'), (size, '#000000')])
        g = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(v.outputs['Color'], g.inputs[0])
        star_on = ramp(g.outputs[0], [(0.0, '#000000'), (gate, '#000000'), (gate + 0.01, '#ffffff')])
        star = mixc(st.outputs[0], star_on.outputs[0], 'MULTIPLY', 1.0)
        boost = nt.nodes.new('ShaderNodeMix')
        boost.data_type = 'RGBA'
        boost.blend_type = 'MULTIPLY'
        boost.inputs['Factor'].default_value = 1.0
        nt.links.new(star, boost.inputs[6])
        boost.inputs[7].default_value = (bright, bright, bright * 1.05, 1)
        col = mixc(col, boost.outputs[2], 'ADD', 1.0)
    nt.links.new(col, emit.inputs['Color'])
    plane.data.materials.append(m)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3.2
    cam.location = (0, 0, 5)
    os.makedirs(OUT, exist_ok=True)
    s = scene.render.image_settings
    s.file_format = 'WEBP'
    s.color_mode = 'RGB'
    s.quality = 80
    scene.render.filepath = os.path.join(OUT, 'menu-nebula.webp')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath, os.path.getsize(scene.render.filepath))


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for n in argv or list(CAST):
        CAST[n]()


main()
