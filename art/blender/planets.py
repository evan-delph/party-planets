"""Bake the menu planets' surface maps.

  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/planets.py [-- earth selene]

Each planet is a 3D procedural shader evaluated on a UV sphere and baked
(Cycles EMIT) into equirectangular maps that three.js wraps onto a sphere:
  <id>-color.webp   albedo
  <id>-height.webp  bump height (grayscale)
  <id>-rough.webp   roughness (oceans shiny, land matte)
  <id>-clouds.webp  cloud coverage (grayscale, used as alpha)
  <id>-glow.webp    emissive (lava world only)
Sampling 3D object coordinates keeps the maps seamless across the UV seam.
"""
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'textures', 'planets')
os.makedirs(OUT, exist_ok=True)
WANTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.margin = 8
scene.render.bake.margin_type = 'EXTEND'
bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=1)
sphere = bpy.context.active_object
for p in sphere.data.polygons:
    p.use_smooth = True


class G:
    """Tiny node-graph helper: every method returns an output socket."""

    def __init__(self, mat):
        self.t = mat.node_tree
        self.n = self.t.nodes
        self.l = self.t.links
        self.n.clear()
        self.out = self.n.new('ShaderNodeOutputMaterial')
        self.emit = self.n.new('ShaderNodeEmission')
        self.l.new(self.emit.outputs[0], self.out.inputs['Surface'])
        coords = self.n.new('ShaderNodeTexCoord')
        self.p = coords.outputs['Object']

    def link(self, a, b):
        self.l.new(a, b)

    def noise(self, vec, scale, detail=6, rough=0.55, distort=0.0, lac=2.0):
        n = self.n.new('ShaderNodeTexNoise')
        n.noise_dimensions = '3D'
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['Lacunarity'].default_value = lac
        n.inputs['Distortion'].default_value = distort
        self.link(vec, n.inputs['Vector'])
        return n.outputs['Fac']

    def voronoi(self, vec, scale, feature='F1', rand=1.0):
        n = self.n.new('ShaderNodeTexVoronoi')
        n.voronoi_dimensions = '3D'
        n.feature = feature
        n.inputs['Scale'].default_value = scale
        n.inputs['Randomness'].default_value = rand
        self.link(vec, n.inputs['Vector'])
        return n.outputs['Distance']

    def math(self, op, a, b=0.0, clamp=False):
        n = self.n.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                self.link(v, n.inputs[i])
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.n.new('ShaderNodeVectorMath')
        n.operation = op
        self.link(a, n.inputs[0])
        if b is not None:
            if isinstance(b, tuple):
                n.inputs[1].default_value = b
            else:
                self.link(b, n.inputs[1])
        if scale is not None:
            n.inputs['Scale'].default_value = scale
        return n.outputs['Vector'] if op != 'LENGTH' and op != 'DOT_PRODUCT' else n.outputs['Value']

    def ramp(self, fac, stops, interp='LINEAR'):
        n = self.n.new('ShaderNodeValToRGB')
        r = n.color_ramp
        r.interpolation = interp
        r.elements[0].position, r.elements[0].color = stops[0][0], stops[0][1]
        r.elements[1].position, r.elements[1].color = stops[-1][0], stops[-1][1]
        for pos, col in stops[1:-1]:
            e = r.elements.new(pos)
            e.color = col
        self.link(fac, n.inputs['Fac'])
        return n.outputs['Color']

    def mix(self, fac, a, b):
        n = self.n.new('ShaderNodeMix')
        n.data_type = 'RGBA'
        self.link(fac, n.inputs['Factor']) if not isinstance(fac, float) else None
        if isinstance(fac, float):
            n.inputs['Factor'].default_value = fac
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, tuple):
                sock.default_value = v
            else:
                self.link(v, sock)
        return n.outputs[2]

    def gray(self, v):
        if isinstance(v, (int, float)):
            rgb = self.n.new('ShaderNodeRGB')
            rgb.outputs[0].default_value = (v, v, v, 1.0)
            return rgb.outputs[0]
        return self.ramp(v, [(0, (0, 0, 0, 1)), (1, (1, 1, 1, 1))])

    def warp(self, vec, amount, scale):
        """Domain-warp coordinates with noise for swirly, natural shapes."""
        n = self.n.new('ShaderNodeTexNoise')
        n.noise_dimensions = '3D'
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = 3
        self.link(vec, n.inputs['Vector'])
        offset = self.vmath('SUBTRACT', n.outputs['Color'], (0.5, 0.5, 0.5))
        return self.vmath('ADD', vec, self.vmath('SCALE', offset, scale=amount))


def gray_stop(v):
    return (v, v, v, 1.0)


# ── Planet recipes: each returns {pass: socket} ─────────────────────────────
def earth(g):
    """Tropical ocean world: island chains, turquoise shallows, swirling clouds."""
    p = g.warp(g.p, 0.35, 1.4)
    h = g.math('ADD', g.noise(p, 1.5, 8, 0.58), g.math('MULTIPLY', g.noise(p, 5.0, 4, 0.5), 0.18))
    color = g.ramp(h, [
        (0.30, srgb('#071f4d')), (0.50, srgb('#0d4a92')), (0.60, srgb('#1677b8')),
        (0.645, srgb('#27c2c8')), (0.665, srgb('#8be3d3')), (0.672, srgb('#efd9a2')),
        (0.69, srgb('#5aa83e')), (0.74, srgb('#2f7a32')), (0.80, srgb('#6b6b3e')),
        (0.86, srgb('#9a8a6a')),
    ])
    lat = g.math('ABSOLUTE', g.vmath('DOT_PRODUCT', g.p, (0, 0, 1)))
    ice = g.math('MULTIPLY', g.math('SUBTRACT', g.math('ADD', lat, g.math('MULTIPLY', g.noise(g.p, 6, 3), 0.08)), 0.97), 18, clamp=True)
    color = g.mix(ice, color, srgb('#f4fbff'))
    land = g.math('GREATER_THAN', h, 0.668)
    height = g.ramp(h, [(0.0, gray_stop(0.0)), (0.668, gray_stop(0.02)), (0.672, gray_stop(0.25)), (0.9, gray_stop(1.0))])
    rough = g.gray(g.math('ADD', g.math('MULTIPLY', land, 0.6), 0.28))
    cp = g.warp(g.warp(g.p, 0.9, 2.2), 0.4, 6.0)
    clouds = g.ramp(g.noise(cp, 2.8, 8, 0.62), [(0.54, gray_stop(0)), (0.64, gray_stop(0.8)), (0.75, gray_stop(1))])
    return {'color': color, 'height': height, 'rough': rough, 'clouds': clouds}


def selene(g):
    """Cratered moon: dark maria, bright highlands, layered crater fields."""
    maria = g.ramp(g.noise(g.warp(g.p, 0.5, 1.2), 1.1, 5, 0.5), [(0.42, gray_stop(1)), (0.56, gray_stop(0))])
    base = g.mix(maria, srgb('#5b6274'), srgb('#b9bfcc'))
    grain = g.noise(g.p, 24, 8, 0.7)
    base = g.mix(g.math('MULTIPLY', grain, 0.25), base, srgb('#e4e7ee'))
    crater_height = None
    for scale, weight in ((4.0, 1.0), (9.0, 0.7), (21.0, 0.45), (48.0, 0.25)):
        d = g.voronoi(g.warp(g.p, 0.06, 8), scale)
        profile = g.ramp(d, [(0.0, gray_stop(0.15)), (0.22, gray_stop(0.35)), (0.3, gray_stop(1.0)), (0.42, gray_stop(0.5)), (1.0, gray_stop(0.5))])
        sep = g.n.new('ShaderNodeSeparateColor')
        g.link(profile, sep.inputs[0])
        layer = g.math('MULTIPLY', g.math('SUBTRACT', sep.outputs[0], 0.5), weight)
        crater_height = layer if crater_height is None else g.math('ADD', crater_height, layer)
    height01 = g.math('ADD', g.math('MULTIPLY', crater_height, 0.6), 0.5, clamp=True)
    color = g.mix(g.math('MULTIPLY', g.math('SUBTRACT', 0.5, height01, clamp=True), 1.6), base, srgb('#3d4352'))
    color = g.mix(g.math('MULTIPLY', g.math('SUBTRACT', height01, 0.62, clamp=True), 2.2), color, srgb('#f2f4f8'))
    return {'color': color, 'height': g.gray(height01), 'rough': g.gray(0.92)}


def ignara(g):
    """Lava world: basalt plates split by glowing rivers and molten seas."""
    p = g.warp(g.p, 0.25, 1.6)
    crust = g.ramp(g.noise(p, 3.0, 8, 0.6), [(0.3, srgb('#140f12')), (0.55, srgb('#2d2226')), (0.75, srgb('#4a3833'))])
    cracks = g.voronoi(g.warp(g.p, 0.12, 3.0), 4.5, 'DISTANCE_TO_EDGE')
    fine = g.voronoi(g.warp(g.p, 0.08, 9.0), 13.0, 'DISTANCE_TO_EDGE')
    river = g.math('MAXIMUM',
                   g.ramp(cracks, [(0.0, gray_stop(1)), (0.035, gray_stop(0))]),
                   g.math('MULTIPLY', g.ramp(fine, [(0.0, gray_stop(1)), (0.03, gray_stop(0))]), 0.6))
    sea = g.ramp(g.noise(p, 1.3, 4, 0.5), [(0.36, gray_stop(1)), (0.42, gray_stop(0))])
    sepr = g.n.new('ShaderNodeSeparateColor')
    g.link(river, sepr.inputs[0])
    seps = g.n.new('ShaderNodeSeparateColor')
    g.link(sea, seps.inputs[0])
    molten = g.math('MAXIMUM', sepr.outputs[0], seps.outputs[0])
    heat = g.ramp(g.math('ADD', molten, g.math('MULTIPLY', g.noise(g.p, 18, 4), 0.25)),
                  [(0.0, srgb('#000000')), (0.25, srgb('#000000')), (0.45, srgb('#a51d05')), (0.7, srgb('#ff6a12')), (1.0, srgb('#ffe27a'))])
    color = g.mix(molten, crust, srgb('#ff7a1c'))
    height = g.gray(g.math('SUBTRACT', 0.6, g.math('MULTIPLY', molten, 0.5)))
    ash = g.ramp(g.noise(g.warp(g.p, 0.8, 2.0), 3.5, 6, 0.6), [(0.55, gray_stop(0)), (0.72, gray_stop(0.55))])
    return {'color': color, 'height': height, 'rough': g.gray(0.75), 'glow': heat, 'clouds': ash}


def verdara(g):
    """Sky world: pastel cloud bands, a great storm and a few floating reefs."""
    # Noise squashed along the pole axis gives bands of uneven width.
    p = g.warp(g.p, 0.18, 2.2)
    band_raw = g.noise(g.vmath('MULTIPLY', p, (0.28, 0.28, 2.4)), 1.0, 5, 0.5)
    band_fac = g.math('MULTIPLY', g.math('SUBTRACT', band_raw, 0.34), 3.2, clamp=True)

    class _Wave:
        outputs = {'Fac': band_fac}

    wave = _Wave()
    bands = g.ramp(band_fac, [
        (0.0, srgb('#5fb6dc')), (0.22, srgb('#9fe2ea')), (0.4, srgb('#c4b3f2')),
        (0.58, srgb('#f6d3e6')), (0.75, srgb('#fff0d2')), (1.0, srgb('#7cc9e6')),
    ])
    storm = g.ramp(g.vmath('LENGTH', g.vmath('SUBTRACT', g.warp(g.p, 0.1, 5), (0.55, -0.75, 0.25))), [(0.0, gray_stop(1)), (0.3, gray_stop(0))])
    color = g.mix(g.math('MULTIPLY', storm, 0.8), bands, srgb('#ff9fc8'))
    reefs = g.ramp(g.noise(g.p, 3.2, 6, 0.6), [(0.655, gray_stop(0)), (0.67, gray_stop(1))])
    color = g.mix(reefs, color, srgb('#4fbf8a'))
    clouds = g.ramp(g.noise(g.warp(g.p, 0.6, 3.0), 5.0, 6, 0.6), [(0.55, gray_stop(0)), (0.7, gray_stop(0.75))])
    sep = g.n.new('ShaderNodeSeparateColor')
    g.link(reefs, sep.inputs[0])
    height = g.gray(g.math('ADD', g.math('MULTIPLY', sep.outputs[0], 0.6), g.math('MULTIPLY', wave.outputs['Fac'], 0.15)))
    return {'color': color, 'height': height, 'rough': g.gray(0.6), 'clouds': clouds}


RECIPES = {'earth': earth, 'selene': selene, 'ignara': ignara, 'verdara': verdara}
SIZES = {'color': (2048, 1024), 'height': (2048, 1024), 'rough': (1024, 512), 'clouds': (2048, 1024), 'glow': (2048, 1024)}

for pid, recipe in RECIPES.items():
    if WANTED and pid not in WANTED:
        continue
    mat = bpy.data.materials.new(pid)
    mat.use_nodes = True
    sphere.data.materials.clear()
    sphere.data.materials.append(mat)
    g = G(mat)
    passes = recipe(g)
    for name, socket in passes.items():
        w, h = SIZES[name]
        img = bpy.data.images.new(f'{pid}-{name}', w, h, alpha=False, float_buffer=False)
        if name in ('height', 'rough', 'clouds'):
            img.colorspace_settings.name = 'Non-Color'
        node = g.n.new('ShaderNodeTexImage')
        node.image = img
        g.n.active = node
        for link in list(g.emit.inputs['Color'].links):
            g.l.remove(link)
        g.link(socket, g.emit.inputs['Color'])
        bpy.context.view_layer.objects.active = sphere
        sphere.select_set(True)
        bpy.ops.object.bake(type='EMIT')
        img.filepath_raw = os.path.join(OUT, f'{pid}-{name}.webp')
        img.file_format = 'WEBP'
        scene.render.image_settings.quality = 88
        img.save()
        g.n.remove(node)
        print('BAKED', pid, name, os.path.getsize(img.filepath_raw))
