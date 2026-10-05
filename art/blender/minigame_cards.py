"""Key-art previews for the minigame vote cards (public/textures/minigames/<id>.webp).

  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/minigame_cards.py -- [ids...]

With no ids every minigame is rendered. Each preview is a small staged scene
built from primitives, the Poly Haven scans in art/source and the crew alien
(public/models/alien.glb), lit for a punchy key-art look and rendered with
EEVEE at 800x500 (16:10). game/art-minigames.tsx maps ids to these files.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(__file__))
import kit  # noqa: E402

# Under textures/ so the offline single-file build embeds them too.
OUT = os.path.join(kit.ROOT, 'public', 'textures', 'minigames')
ALIEN = os.path.join(kit.MODELS, 'alien.glb')
UFO = os.path.join(kit.MODELS, 'ufo.glb')
W, H = 800, 500
SHIRTS = ['#12ad9a', '#f25265', '#7549cb', '#f4b62c']
TOOK = {}


# -- Scene plumbing ---------------------------------------------------------
def begin():
    kit.reset()
    kit._cache.clear()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = W, H
    scene.render.resolution_percentage = 100
    scene.eevee.taa_render_samples = int(os.environ.get('PP_SAMPLES', '48'))
    try:
        scene.eevee.use_shadows = True
        scene.eevee.use_raytracing = True
        scene.eevee.ray_tracing_options.resolution_scale = '2'
    except Exception:
        pass
    scene.eevee.use_fast_gi = True
    scene.view_settings.view_transform = 'AgX'
    for look in ('AgX - Punchy', 'Punchy', 'AgX - Medium High Contrast'):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = 0.0
    world = bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    return scene


def ambient(color, strength=0.6):
    bg = bpy.context.scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = kit.linear(color)
    bg.inputs['Strength'].default_value = strength


def bloom(strength=0.6, threshold=1.0, size=0.6):
    scene = bpy.context.scene
    tree = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = tree.nodes.new('CompositorNodeRLayers')
    glare = tree.nodes.new('CompositorNodeGlare')
    glare.inputs['Type'].default_value = 'Bloom'
    glare.inputs['Threshold'].default_value = threshold
    glare.inputs['Strength'].default_value = strength
    glare.inputs['Size'].default_value = size
    out = tree.nodes.new('NodeGroupOutput')
    tree.links.new(rl.outputs['Image'], glare.inputs['Image'])
    tree.links.new(glare.outputs[0], out.inputs[0])
    scene.compositing_node_group = tree


def camera(loc, target, lens=35, focus=None, fstop=4.0):
    scene = bpy.context.scene
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if focus is not None:
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = (Vector(focus) - Vector(loc)).length
        cam.data.dof.aperture_fstop = fstop
    return cam


def sun(rot, color='#fff1d6', energy=4.0, angle=4.0):
    light = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    light.data.energy = energy
    light.data.color = kit.linear(color)[:3]
    light.data.angle = math.radians(angle)
    light.rotation_euler = tuple(math.radians(a) for a in rot)
    bpy.context.scene.collection.objects.link(light)
    return light


def lamp(loc, color, energy=300, radius=0.5, kind='POINT'):
    light = bpy.data.objects.new('Lamp', bpy.data.lights.new('Lamp', kind))
    light.data.energy = energy
    light.data.color = kit.linear(color)[:3]
    if kind in ('POINT', 'SPOT'):
        light.data.shadow_soft_size = radius
    else:
        light.data.size = radius
    light.location = loc
    bpy.context.scene.collection.objects.link(light)
    return light


def area(loc, target, color, energy=800, size=6):
    light = lamp(loc, color, energy, size, 'AREA')
    light.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return light


def render(name):
    os.makedirs(OUT, exist_ok=True)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 80
    scene.render.filepath = os.path.join(OUT, name + '.webp')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath, os.path.getsize(scene.render.filepath))


# -- Materials --------------------------------------------------------------
def mat(name, color, rough=0.5, metal=0.0, emit=0.0, emit_color=None, sss=0.0, coat=0.0, alpha=1.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = kit.linear(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    try:
        b.inputs['Specular IOR Level'].default_value = spec
    except KeyError:
        pass
    if emit:
        b.inputs['Emission Color'].default_value = kit.linear(emit_color or color)
        b.inputs['Emission Strength'].default_value = emit
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (0.4, 0.2, 0.1)
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except AttributeError:
            pass
    return m


def glow(name, color, strength=8.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = kit.linear(color)
    e.inputs['Strength'].default_value = strength
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], o.inputs['Surface'])
    return m


def scan(name, asset, tint=None, rough=None, uv=3.0, metal=0.0):
    """Scanned PBR set, optionally multiplied by a tint for game-friendly color."""
    key = ('scan', name, asset, tint, rough, metal)
    if key in kit._cache:
        return kit._cache[key]
    m = kit.scanned(name, asset, metal=metal).copy()
    kit._cache[key] = m
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    if tint:
        tex = b.inputs['Base Color'].links[0].from_node
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(tex.outputs['Color'], mix.inputs['A'])
        mix.inputs['B'].default_value = kit.linear(tint)
        nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    if rough is not None:
        for l in list(b.inputs['Roughness'].links):
            nt.links.remove(l)
        b.inputs['Roughness'].default_value = rough
    return m


def sky_dome(stops, r=400, strength=1.0):
    """Camera-visible gradient sky: stops = [(height 0..1, hex)], 0.5 is the horizon."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=r)
    dome = bpy.context.active_object
    dome.name = 'Sky'
    m = bpy.data.materials.new('Sky')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], kit.linear(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], kit.linear(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = kit.linear(col)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    dome.data.materials.append(m)
    dome.visible_shadow = False
    return dome


# -- Geometry helpers -------------------------------------------------------
def obj_from_bm(name, bm, material=None, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if material:
        o.data.materials.append(material)
    if smooth_shade:
        for p in me.polygons:
            p.use_smooth = True
    return o


def sphere(name, material, loc, radius=1.0, scale=(1, 1, 1), rot=(0, 0, 0), seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=radius, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def blob(name, material, loc, radius=1.0, scale=(1, 1, 1), jitter=0.25, seed=0, sub=3, smooth=True):
    """Lumpy icosphere: rocks, clouds, bushes, snow piles."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=radius)
    lumps = [(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized(), rnd.uniform(-1, 1)) for _ in range(9)]
    for v in bm.verts:
        n = v.co.normalized()
        k = sum(a * max(0.0, n.dot(d)) ** 3 for d, a in lumps)
        v.co = v.co * (1 + jitter * k + rnd.uniform(-0.02, 0.02) * jitter)
    o = obj_from_bm(name, bm, material, smooth)
    o.location = loc
    o.scale = scale
    return o


def cyl(name, material, loc, radius=1.0, depth=1.0, rot=(0, 0, 0), verts=32, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    o.scale = scale
    o.data.materials.append(material)
    return o


def cone(name, material, loc, r1=1.0, r2=0.0, depth=1.0, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def box(name, material, loc, size=(1, 1, 1), rot=(0, 0, 0), bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    o.data.materials.append(material)
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.shade_smooth()
    return o


def torus(name, material, loc, major=1.0, minor=0.25, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48, minor_segments=16, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    o.scale = scale
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def terrain(name, material, size=80, res=120, height=None, uv=4.0, loc=(0, 0, 0)):
    """Subdivided ground plane; height(x, y) -> z shapes it."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=res, y_segments=res, size=size / 2)
    if height:
        for v in bm.verts:
            v.co.z = height(v.co.x + loc[0], v.co.y + loc[1])
    o = obj_from_bm(name, bm, material)
    o.location = loc
    kit.world_uvs(o, uv)
    return o


def ribbon(name, material, pts, width=0.3, lift=0.03, taper=True):
    """Flat strip along a polyline on the ground (cracks, trails, paths)."""
    bm = bmesh.new()
    left, right = [], []
    for i, p in enumerate(pts):
        a = Vector(pts[max(0, i - 1)])
        b = Vector(pts[min(len(pts) - 1, i + 1)])
        d = (b - a)
        d.z = 0
        d.normalize()
        n = Vector((-d.y, d.x, 0))
        w = width * (math.sin(math.pi * i / (len(pts) - 1)) * 0.8 + 0.2 if taper else 1)
        pp = Vector(p) + Vector((0, 0, lift))
        left.append(bm.verts.new(pp + n * w / 2))
        right.append(bm.verts.new(pp - n * w / 2))
    for i in range(len(pts) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    return obj_from_bm(name, bm, material, False)


def crack(rnd, start, angle, steps=10, step=0.7, wander=0.5):
    pts = [Vector(start)]
    for _ in range(steps):
        angle += rnd.uniform(-wander, wander)
        pts.append(pts[-1] + Vector((math.cos(angle) * step, math.sin(angle) * step, 0)))
    return [tuple(p) for p in pts]


def specks(name, material, count, bounds, size=(0.04, 0.12), seed=1, shape='cube', z_fn=None):
    """Many tiny pieces in one mesh (embers, snow, confetti, bubbles, stars)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    (x0, x1), (y0, y1), (z0, z1) = bounds
    for _ in range(count):
        s = rnd.uniform(*size)
        loc = Vector((rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(z0, z1)))
        if z_fn:
            loc.z = z_fn(loc.x, loc.y, rnd)
        if shape == 'ico':
            geo = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=s)
        elif shape == 'flake':
            geo = bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=s)
        else:
            geo = bmesh.ops.create_cube(bm, size=s)
        rot = Euler((rnd.uniform(0, 6.3), rnd.uniform(0, 6.3), rnd.uniform(0, 6.3))).to_matrix()
        for v in geo['verts']:
            v.co = rot @ v.co + loc
    return obj_from_bm(name, bm, material, shape == 'ico')


def multi(name, materials, count, bounds, size=(0.06, 0.14), seed=3):
    """Confetti in several colors (one object per color)."""
    return [specks(f'{name}{i}', m, count // len(materials), bounds, size, seed + i, 'flake') for i, m in enumerate(materials)]


# -- Set dressing -----------------------------------------------------------
def palm(loc, height=6.0, lean=12, turn=0, seed=0, trunk=None, leaf=None):
    rnd = random.Random(seed)
    trunk = trunk or mat('PalmTrunk', '#8a6a4a', rough=0.85)
    leaf = leaf or mat('PalmLeaf', '#2fa24a', rough=0.6, sss=0.1)
    segs = 7
    base = Vector(loc)
    top = base
    tilt = math.radians(lean)
    for i in range(segs):
        t = (i + 1) / segs
        p = base + Vector((math.sin(math.radians(turn)) * math.sin(tilt) * height * t * t,
                           math.cos(math.radians(turn)) * math.sin(tilt) * height * t * t,
                           height * t))
        kit.strut('Trunk', top, p, 0.22 * (1.15 - 0.4 * t), trunk, 10)
        sphere('Ring', trunk, p, 0.24 * (1.15 - 0.4 * t), (1, 1, 0.45), seg=12)
        top = p
    for k in range(9):
        a = k / 9 * math.tau + rnd.uniform(-0.2, 0.2)
        length = rnd.uniform(2.4, 3.1)
        bm = bmesh.new()
        n = 8
        rows = []
        for j in range(n + 1):
            t = j / n
            r = length * t
            droop = -1.6 * t * t + 0.6 * t
            w = 0.55 * math.sin(math.pi * min(1, t * 1.1)) + 0.04
            c = Vector((math.cos(a) * r, math.sin(a) * r, droop))
            side = Vector((-math.sin(a), math.cos(a), 0)) * w
            rows.append((bm.verts.new(c + side + Vector((0, 0, -0.12 * w))), bm.verts.new(c), bm.verts.new(c - side + Vector((0, 0, -0.12 * w)))))
        for j in range(n):
            bm.faces.new((rows[j][0], rows[j][1], rows[j + 1][1], rows[j + 1][0]))
            bm.faces.new((rows[j][1], rows[j][2], rows[j + 1][2], rows[j + 1][1]))
        o = obj_from_bm('Frond', bm, leaf)
        o.location = top
    sphere('Coconut', mat('Coco', '#5a3b22', rough=0.7), top + Vector((0.2, -0.2, -0.3)), 0.22)
    sphere('Coconut', mat('Coco', '#5a3b22', rough=0.7), top + Vector((-0.25, -0.1, -0.32)), 0.22)


def pine(loc, height=5.0, snow=False, seed=0, green='#1f6b48'):
    leaf = mat('Pine', green, rough=0.8)
    white = mat('Snowcap', '#f4fbff', rough=0.6, sss=0.2)
    cyl('PineTrunk', mat('Bark', '#5b3d2a', rough=0.9), (loc[0], loc[1], loc[2] + 0.5), 0.2, 1.0, verts=10)
    for i in range(4):
        t = i / 4
        r = (1.0 - t * 0.7) * height * 0.32
        z = loc[2] + 0.9 + t * height * 0.75
        cone('Tier', leaf, (loc[0], loc[1], z + 0.6), r, 0.05, height * 0.38, verts=14)
        if snow:
            cone('Snow', white, (loc[0], loc[1], z + 0.75), r * 0.86, 0.05, height * 0.3, verts=14)


def rock(loc, size=1.0, material=None, seed=0, squash=0.7):
    material = material or scan('Rock', 'coast_land_rocks_01')
    o = blob('Rock', material, loc, size, (1, 1, squash), 0.35, seed, 2, smooth=False)
    o.rotation_euler = (0, 0, seed * 1.3)
    kit.world_uvs(o, 1.5)
    return o


def cloud(loc, scale=1.0, seed=0, color='#ffffff', emit=0.0):
    m = mat('Cloud', color, rough=1.0, sss=0.0, emit=emit)
    rnd = random.Random(seed)
    for i in range(6):
        off = Vector((rnd.uniform(-2.2, 2.2), rnd.uniform(-0.6, 0.6), rnd.uniform(-0.3, 0.7))) * scale
        blob('Cloud', m, Vector(loc) + off, rnd.uniform(0.9, 1.6) * scale, (1.2, 1, 0.8), 0.15, seed * 10 + i, 2)


def water(name='Water', size=120, res=160, color='#1aa0c8', deep='#0b5d8c', waves=None, rough=0.06, loc=(0, 0, 0), foam_level=None):
    def h(x, y):
        z = 0.0
        for amp, fx, fy, ph in (waves or [(0.12, 0.35, 0.2, 0), (0.08, -0.2, 0.5, 1.3), (0.05, 0.8, -0.6, 2.1)]):
            z += amp * math.sin(fx * x + fy * y + ph)
        return z
    o = terrain(name, None, size, res, h, 6.0, loc)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = kit.linear(color)
    ramp.color_ramp.elements[1].color = kit.linear(deep)
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = 0.8
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    o.data.materials.append(m)
    return o, h


def foam_ring(loc, radius, width=0.18, seed=0, h=None):
    """Broken, wobbly foam band hugging something that floats."""
    m = mat('Foam', '#f4fdff', rough=0.6, emit=0.2, alpha=0.92)
    rnd = random.Random(seed)
    for k, (rr, ww) in enumerate(((1.0, 1.0), (1.22, 0.55))):
        a0 = rnd.uniform(0, math.tau)
        n = 40
        pts = []
        for j in range(n + 1):
            a = a0 + j / n * math.tau * (0.98 if k == 0 else 0.7)
            r = radius * rr * (1 + 0.06 * math.sin(a * 5 + seed) + rnd.uniform(-0.02, 0.02))
            x, y = loc[0] + math.cos(a) * r, loc[1] + math.sin(a) * r
            pts.append((x, y, (h(x, y) if h else loc[2]) + 0.04))
        ribbon('Foam', m, pts, width * 2 * ww, 0.0, True)


# -- The crew alien ---------------------------------------------------------
HIDE = ('Acc', 'Aloha', 'Overalls', 'Dots', 'Stripes', 'Hair', 'Beard', 'Freckles', 'Lid', 'MouthFrown', 'MouthSmile', 'Glove')


def alien(loc, face=0.0, shirt=SHIRTS[0], pose='idle', scale=1.0, tilt=(0, 0), mouth='grin'):
    """Import the crew alien. face: degrees around Z (0 faces -Y, the camera side).

    Poses: idle, cheer, run, hop, balance, throw, duck, swim, ride, wave.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ALIEN)
    new = [o for o in bpy.data.objects if o not in before]
    root = next(o for o in new if o.parent is None and o.name.startswith('Alien'))
    by = {o.name.split('.')[0]: o for o in new}
    keep_mouth = {'grin': 'MouthGrin', 'smile': 'MouthSmile'}.get(mouth)
    for o in new:
        base = o.name.split('.')[0]
        if base.startswith(HIDE) and base != keep_mouth:
            bpy.data.objects.remove(o, do_unlink=True)
    if keep_mouth != 'MouthGrin' and 'MouthGrin' in by:
        bpy.data.objects.remove(by['MouthGrin'], do_unlink=True)
    shirt_lin = kit.linear(shirt)
    tint = {'Shirt': shirt_lin, 'ShirtSeam': tuple(c * 0.55 for c in shirt_lin[:3]) + (1,)}
    copies = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name.split('.')[0] in HIDE:
            continue
        if not (o.parent and (o.parent == root or o.parent.parent == root)):
            continue
        for slot in o.material_slots:
            m = slot.material
            base = m.name.split('.')[0] if m else ''
            if base in tint:
                if m.name not in copies:
                    c = m.copy()
                    b = c.node_tree.nodes.get('Principled BSDF')
                    if b:
                        if b.inputs['Base Color'].links:
                            c.node_tree.links.remove(b.inputs['Base Color'].links[0])
                        b.inputs['Base Color'].default_value = tint[base]
                    copies[m.name] = c
                slot.material = copies[m.name]
    root.location = loc
    root.rotation_mode = 'XYZ'
    root.rotation_euler = (math.radians(tilt[0]), math.radians(tilt[1]), math.radians(face))
    root.scale = (scale, scale, scale)
    arm0, arm1 = by.get('Arm0'), by.get('Arm1')
    leg0, leg1 = by.get('Leg0'), by.get('Leg1')
    R = math.radians
    poses = {
        'idle': ((0, R(12), 0), (0, R(-12), 0), (0, 0, 0), (0, 0, 0)),
        'cheer': ((R(-25), R(138), 0), (R(-25), R(-138), 0), (0, R(-6), 0), (0, R(6), 0)),
        'wave': ((0, R(150), 0), (0, R(-15), 0), (0, 0, 0), (0, 0, 0)),
        'run': ((R(55), R(15), 0), (R(-60), R(-15), 0), (R(-45), 0, 0), (R(40), 0, 0)),
        'hop': ((R(-30), R(130), 0), (R(-30), R(-130), 0), (R(30), 0, 0), (R(-20), 0, 0)),
        'balance': ((0, R(85), 0), (0, R(-80), 0), (0, R(-10), 0), (0, R(10), 0)),
        'throw': ((R(-160), R(10), 0), (R(40), R(-25), 0), (R(-25), 0, 0), (R(25), 0, 0)),
        'duck': ((R(-60), R(30), 0), (R(-60), R(-30), 0), (R(35), 0, 0), (R(35), 0, 0)),
        'swim': ((R(-150), R(30), 0), (R(30), R(-30), 0), (R(30), 0, 0), (R(-30), 0, 0)),
        'ride': ((R(-70), R(10), 0), (R(-70), R(-10), 0), (R(-80), R(-8), 0), (R(-80), R(8), 0)),
        'point': ((R(-90), R(0), 0), (0, R(-14), 0), (0, 0, 0), (0, 0, 0)),
    }
    pa, pb, la, lb = poses[pose]
    for part, rot in ((arm0, pa), (arm1, pb), (leg0, la), (leg1, lb)):
        if part:
            part.rotation_mode = 'XYZ'
            part.rotation_euler = rot
    return root


# -- Scenes -----------------------------------------------------------------
SCENES = {}


def scene(fn):
    SCENES[fn.__name__] = fn
    return fn


@scene
def tidetiles():
    """Caldera Critter: a molten critter charges across a cracked caldera floor."""
    begin()
    rnd = random.Random(7)
    sky_dome([(0.0, '#2a0d0a'), (0.5, '#ff6a2a'), (0.56, '#c2361f'), (0.7, '#5a1622'), (1.0, '#1c0a1e')])
    ambient('#ff7a4a', 0.35)

    def ground(x, y):
        r = math.hypot(x, y)
        rim = min(3.5, max(0.0, r - 11) ** 1.4 * 0.3)
        return rim + 0.12 * math.sin(x * 0.9) * math.cos(y * 0.7) + 0.06 * math.sin(x * 2.3 + y * 1.7)
    terrain('Caldera', scan('Basalt', 'volcanic_rock_tiles', tint='#8a5a4c', rough=0.6), 70, 140, ground, 2.2)
    lava = glow('Lava', '#ff5a0a', 4.0)
    hot = glow('LavaCore', '#ffb21a', 7.0)
    crust = mat('Crust', '#2a1512', rough=0.9)
    for i in range(8):
        a = i / 8 * math.tau + rnd.uniform(-0.3, 0.3)
        start = (math.cos(a) * rnd.uniform(1.5, 3.5) - 1.5, math.sin(a) * rnd.uniform(1.5, 3.5) + 1.5, 0)
        pts = crack(rnd, start, a, steps=12, step=0.75, wander=0.45)
        pts = [(x, y, ground(x, y)) for x, y, _ in pts]
        ribbon('FissureLip', crust, [(x, y, z + 0.005) for x, y, z in pts], 0.75)
        ribbon('Fissure', lava, [(x, y, z + 0.01) for x, y, z in pts], 0.42)
        ribbon('FissureCore', hot, [(x, y, z + 0.02) for x, y, z in pts], 0.13)
        mid = pts[len(pts) // 2]
        lamp((mid[0], mid[1], mid[2] + 0.8), '#ff6a12', 220, 1.0)
    # Bubbling lava pools around the rim.
    for i, (x, y, r) in enumerate([(-7.5, 3.0, 1.6), (6.8, 5.5, 1.3), (8.5, -1.5, 1.0), (-5.0, 8.5, 1.8)]):
        cyl('Pool', lava, (x, y, ground(x, y) + 0.04), r, 0.1, scale=(1, 0.75, 1))
        for k in range(4):
            sphere('Bubble', hot, (x + rnd.uniform(-r, r) * 0.6, y + rnd.uniform(-r, r) * 0.4, ground(x, y) + 0.15), rnd.uniform(0.12, 0.28), (1, 1, 0.6), seg=12)
        lamp((x, y, ground(x, y) + 1.2), '#ff6a12', 420, 1.5)
    rockm = scan('Crag', 'dark_rock', tint='#7a5a55', rough=0.8)
    for i in range(26):
        a = i / 26 * math.tau
        r = rnd.uniform(12.5, 16)
        rock((math.cos(a) * r, math.sin(a) * r, ground(math.cos(a) * r, math.sin(a) * r) - 0.4), rnd.uniform(1.4, 3.2), rockm, i, rnd.uniform(0.9, 1.6))
    # Distant volcano with a glowing crown.
    v = cone('Volcano', rockm, (-6, 48, 2), 26, 6, 26, verts=48)
    kit.world_uvs(v, 3)
    cyl('Crown', glow('Crown', '#ff8a2a', 20), (-6, 48, 15.1), 6.2, 0.4)
    lamp((-6, 46, 18), '#ff7a2a', 6000, 4)
    for k in range(7):
        blob('Smoke', mat('Smoke', '#3a2228', rough=1), (-6 + rnd.uniform(-5, 7), 50 + rnd.uniform(-2, 2), 20 + k * 3.2), 3.5 + k * 0.7, (1.3, 1, 0.8), 0.3, k, 2)

    # The critter, mid-charge toward the camera side.
    critter((-2.4, 2.6, 0), 1.35, 25)
    lamp((-0.5, -1.5, 3.2), '#ffb070', 650, 1.5)
    specks('Dust', mat('Dust', '#6d4a40', rough=1), 70, ((-5.5, -3.0), (3.5, 6.0), (0.1, 1.6)), (0.08, 0.25), 4, 'ico')

    # Crew aliens scattering toward the viewer.
    alien((2.2, -2.2, ground(2.2, -2.2)), 55, SHIRTS[0], 'run', tilt=(0, -6))
    alien((4.6, 1.2, 1.4), 70, SHIRTS[1], 'hop', tilt=(-14, 0))
    alien((-0.6, -3.6, ground(-0.6, -3.6)), 15, SHIRTS[2], 'run', tilt=(0, 6))
    alien((-6.2, 0.6, ground(-6.2, 0.6)), -30, SHIRTS[3], 'duck')

    specks('Embers', glow('Ember', '#ffb44a', 9), 140, ((-14, 14), (-4, 30), (0.4, 12)), (0.025, 0.07), 9)
    sun((50, 0, 140), '#ffd2a8', 2.6, 8)
    area((10, -8, 7), (0, 2, 1), '#a8ccff', 1600, 8)  # cool rim for separation
    area((-9, -9, 9), (0, 1, 1), '#ffd8b0', 900, 8)
    bloom(0.7, 0.95, 0.7)
    camera((8.0, -11.2, 4.6), (-0.8, 1.6, 1.7), 30, (-1.6, 1.8, 1.8), 4.5)
    render('tidetiles')


def critter(loc, scale=1.0, face=0.0):
    """Molten, spiky salamander-blob built facing -Y at the origin, then placed."""
    parts = []
    skin = mat('CritterSkin', '#ff4e1f', rough=0.32, sss=0.3, coat=0.5)
    belly = mat('CritterBelly', '#ffc04a', rough=0.4, emit=2.5, emit_color='#ff9a2a')
    parts.append(sphere('Critter', skin, (0, 0, 1.35), 1.0, (1.45, 1.6, 1.18)))
    parts.append(sphere('Belly', belly, (0, -0.7, 1.0), 0.95, (1.05, 0.7, 0.75)))
    plate = mat('Plates', '#3b1d1a', rough=0.5, coat=0.3)
    tip = glow('PlateTip', '#ffcf4a', 6)
    for k in range(5):
        t = k / 4
        y = -0.6 + t * 1.8
        z = 2.55 - abs(t - 0.35) * 0.8
        parts.append(cone('Spike', plate, (0, y, z), 0.32, 0.04, 0.85, (25 + 20 * t, 0, 0), 12))
        parts.append(sphere('SpikeTip', tip, (0, y + 0.18 + t * 0.2, z + 0.38), 0.08, seg=10))
    for side in (-1, 1):
        parts.append(cone('Horn', plate, (side * 0.75, -0.55, 2.35), 0.16, 0.02, 0.6, (0, side * -35, 0), 10))
    white = mat('EyeWhite', '#ffffff', rough=0.15, coat=0.8)
    pupil = mat('Pupil', '#1b1020', rough=0.2, coat=0.8)
    for side in (-1, 1):
        ex, ey, ez = side * 0.5, -1.35, 2.05
        parts.append(sphere('Eye', white, (ex, ey, ez), 0.42, (1, 0.85, 1.12)))
        parts.append(sphere('Pupil', pupil, (ex - side * 0.05, ey - 0.3, ez - 0.05), 0.22))
        parts.append(sphere('Glint', glow('Glint', '#ffffff', 3), (ex - side * 0.12, ey - 0.46, ez + 0.07), 0.06, seg=10))
        parts.append(sphere('Brow', plate, (ex, ey + 0.05, ez + 0.45), 0.3, (1.2, 0.5, 0.35), (0, side * 18, 0)))
    parts.append(sphere('Mouth', mat('MouthDark', '#4a0a14', rough=0.6), (0, -1.48, 1.32), 0.55, (1.25, 0.45, 0.5)))
    parts.append(sphere('Tongue', mat('Tongue', '#ff6f8a', rough=0.4), (0, -1.6, 1.18), 0.3, (1.2, 0.5, 0.35)))
    for k in range(5):
        parts.append(cone('Tooth', mat('Tooth', '#fff6e0', rough=0.3), (-0.42 + k * 0.21, -1.82, 1.55), 0.075, 0.0, 0.22, (180, 0, 0), 8))
    for side in (-1, 1):
        for fwd in (-1, 1):
            parts.append(sphere('Foot', skin, (side * 0.95, fwd * 0.8, 0.28), 0.42, (1, 1.25, 0.65)))
    parts.append(cone('Tail', skin, (0, 1.9, 0.75), 0.5, 0.05, 1.6, (-70, 0, 0), 16))
    root = bpy.data.objects.new('CritterRoot', None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        kit.parent(p, root)
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(face))
    root.scale = (scale, scale, scale)
    return root


@scene
def boulderbuffet():
    """Ripple Rumble: one alien balances on a bobbing saucer as rivals splash waves."""
    begin()
    rnd = random.Random(3)
    sky_dome([(0.0, '#7fd3ff'), (0.5, '#aee8ff'), (0.56, '#58b8ff'), (0.75, '#2a86f0'), (1.0, '#1450c8')])
    ambient('#9ad8ff', 0.75)
    sea, h = water(size=160, res=200, color='#29c4d6', deep='#0a5fa8', waves=[(0.22, 0.42, 0.18, 0), (0.12, -0.25, 0.55, 1.3), (0.06, 0.9, -0.7, 2.1)])
    # Saucer: the crew's UFO, beached on the swell.
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=UFO)
    ufo = next(o for o in bpy.data.objects if o not in before and o.parent is None)
    ufo.location = (0, 2, -0.95)
    ufo.rotation_euler = (math.radians(7), math.radians(-6), math.radians(20))
    ufo.scale = (1.0, 1.0, 1.0)
    for name in list(o.name for o in bpy.data.objects if o not in before):
        if name.split('.')[0] == 'Ramp':
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    foam_ring((0, 2, h(0, 2)), 3.1, 0.2, 1, h)
    alien((0.15, 1.9, 1.05), 25, SHIRTS[3], 'balance', 1.15, (8, -12))
    # Three rivals in floaties, splashing.
    tube_colors = ['#ff5a6e', '#ffd23f', '#7a5cff']
    for i, (x, y, face) in enumerate([(-4.8, -0.2, -60), (4.2, -0.6, 60), (2.0, 8.0, 160)]):
        z = h(x, y)
        tube = mat(f'Tube{i}', tube_colors[i], rough=0.25, coat=0.8)
        torus('Floatie', tube, (x, y, z + 0.25), 0.95, 0.38)
        for k in range(6):
            a = k / 6 * math.tau
            sphere('Stripe', mat('TubeWhite', '#ffffff', rough=0.25, coat=0.8), (x + math.cos(a) * 0.95, y + math.sin(a) * 0.95, z + 0.27), 0.39, (1, 1, 1), seg=16).scale = (0.45, 0.45, 1)
        alien((x, y, z - 0.75), face, SHIRTS[[1, 0, 2][i]], 'cheer' if i != 1 else 'throw')
        foam_ring((x, y, z), 1.35, 0.14, i, h)
        # Splash sheets curling toward the saucer.
        d = Vector((0 - x, 2 - y, 0)).normalized()
        splash = mat('Splash', '#e9fbff', rough=0.1, alpha=0.85, emit=0.1)
        for k in range(22):
            t = rnd.uniform(0.15, 0.6)
            p = Vector((x, y, z)) + d * (t * 4.0) + Vector((-d.y, d.x, 0)) * rnd.uniform(-0.9, 0.9)
            p.z += math.sin(t * math.pi) * 2.2 + rnd.uniform(-0.2, 0.3)
            sphere('Drop', splash, p, rnd.uniform(0.08, 0.2), seg=12)
        # Foam crest of the wave they sent rolling.
        mid = Vector((x, y, 0)) + d * 3.0
        side = Vector((-d.y, d.x, 0))
        crest = [tuple(mid + side * s + d * (0.35 * (1 - s * s / 4)) + Vector((0, 0, h(*(mid + side * s).xy) + 0.18))) for s in (-2, -1.4, -0.7, 0, 0.7, 1.4, 2)]
        ribbon('Crest', mat('CrestFoam', '#f4fdff', rough=0.5, emit=0.25), crest, 0.55)
    # Distant islands with palms.
    sand = scan('Sand', 'coast_sand_01', tint='#ffe2b0', rough=0.9)
    for i, (x, y, r) in enumerate([(-26, 46, 7), (22, 54, 9), (40, 30, 4)]):
        isl = blob('Isle', sand, (x, y, -1.2), r, (1, 0.8, 0.28), 0.2, i, 3)
        kit.world_uvs(isl, 3)
        for k in range(3):
            palm((x + rnd.uniform(-r, r) * 0.4, y + rnd.uniform(-r, r) * 0.3, 0.6), rnd.uniform(5, 7), rnd.uniform(5, 18), rnd.uniform(0, 360), i * 3 + k)
    for i, (x, y, z, s) in enumerate([(-30, 80, 14, 3.2), (12, 90, 20, 4.0), (45, 70, 12, 2.6), (-8, 70, 9, 2.0)]):
        cloud((x, y, z), s, i)
    specks('Spray', mat('Spray', '#ffffff', rough=0.2, emit=0.2), 120, ((-7, 7), (-2, 9), (0.3, 3.5)), (0.03, 0.08), 5, 'ico')
    sun((48, 8, 200), '#fff2d8', 4.5, 3)
    area((-8, -12, 9), (0, 2, 1), '#ffe2b8', 900, 8)
    bloom(0.5, 1.0, 0.6)
    camera((5.6, -8.6, 3.4), (-0.2, 2.6, 1.7), 28, (0.1, 1.9, 1.8), 5.0)
    render('boulderbuffet')


@scene
def cannoncay():
    """Snowball Showdown: snow sentries lob snowballs across a frozen pond."""
    begin()
    rnd = random.Random(11)
    sky_dome([(0.0, '#bfe8ff'), (0.5, '#eaf7ff'), (0.58, '#9fd3ff'), (1.0, '#3c86e0')])
    ambient('#cfe9ff', 0.85)

    def ground(x, y):
        r = math.hypot(x * 0.9, y)
        bank = min(2.5, max(0.0, r - 7.5) ** 1.2 * 0.2)
        return bank + 0.15 * math.sin(x * 0.6 + y * 0.4) + 0.08 * math.cos(y * 1.3)
    snow = mat('Snow', '#f3f9ff', rough=0.55, sss=0.35)
    terrain('Snowfield', snow, 90, 150, ground, 4.0)
    # Frozen pond: glossy, slightly see-through ice with cracks.
    ice = mat('Ice', '#8fd5ff', rough=0.04, coat=1.0, spec=0.9)
    cyl('Pond', ice, (0, 0, 0.12), 7.6, 0.2, scale=(1.15, 1, 1), verts=96)
    crackm = mat('IceCrack', '#d9f3ff', rough=0.2, emit=0.4)
    for i in range(7):
        a = rnd.uniform(0, math.tau)
        pts = crack(rnd, (math.cos(a) * 1.5, math.sin(a) * 1.5, 0.22), a, 7, 0.7, 0.6)
        ribbon('Crack', crackm, pts, 0.06, 0.0, False)
    torus('PondRim', snow, (0, 0, 0.18), 7.75, 0.45, scale=(1.15, 1, 0.6))
    # Snow forts.
    for i, (x, y, a) in enumerate([(-5.5, -2.5, 20), (4.5, -3.8, -25), (6.5, 2.5, -70)]):
        for k in range(5):
            box('FortBlock', snow, (x + math.cos(math.radians(a)) * (k - 2) * 0.62, y + math.sin(math.radians(a)) * (k - 2) * 0.62, 0.45 + (k % 2) * 0.05), (0.6, 0.5, 0.55), (0, 0, a), 0.08)
        for k in range(4):
            box('FortBlock', snow, (x + math.cos(math.radians(a)) * (k - 1.5) * 0.62, y + math.sin(math.radians(a)) * (k - 1.5) * 0.62, 1.0), (0.6, 0.5, 0.5), (0, 0, a), 0.08)
    # Snow sentries on the far bank, winding up.
    coal = mat('Coal', '#1b1f2a', rough=0.4)
    carrot = mat('Carrot', '#ff7a1a', rough=0.5)
    stick = mat('Stick', '#6b4630', rough=0.9)
    scarf = [mat('ScarfR', '#e8364f', rough=0.7), mat('ScarfB', '#2f6fe0', rough=0.7), mat('ScarfY', '#ffc52e', rough=0.7)]
    aim = glow('AimLine', '#6fe7ff', 6)
    for i, (x, y) in enumerate([(-5.5, 9.5), (0.5, 11.2), (6.8, 8.6)]):
        z = ground(x, y)
        sphere('SnowBase', snow, (x, y, z + 0.9), 1.15)
        sphere('SnowMid', snow, (x, y, z + 2.35), 0.85)
        sphere('SnowHead', snow, (x, y, z + 3.45), 0.62)
        torus('Scarf', scarf[i], (x, y, z + 2.95), 0.6, 0.16, scale=(1, 1, 0.8))
        for side in (-1, 1):
            sphere('CoalEye', coal, (x + side * 0.2, y - 0.52, z + 3.6), 0.09, seg=12)
        cone('Nose', carrot, (x, y - 0.85, z + 3.42), 0.12, 0.0, 0.6, (90, 0, 0), 12)
        cyl('Hat', coal, (x, y, z + 4.15), 0.4, 0.6)
        cyl('HatBrim', coal, (x, y, z + 3.88), 0.62, 0.08)
        kit.strut('Arm', (x + 0.75, y, z + 2.5), (x + 1.4, y - 0.2, z + 3.6), 0.06, stick, 8)
        kit.strut('Arm', (x - 0.75, y, z + 2.5), (x - 1.5, y + 0.1, z + 2.0), 0.06, stick, 8)
        sphere('Held', snow, (x + 1.45, y - 0.25, z + 3.8), 0.35)
        # Glowing aim line on the ice.
        tx, ty = rnd.uniform(-3, 3), rnd.uniform(-4, 1)
        ribbon('Aim', aim, [(x + (tx - x) * t, y + (ty - y) * t, 0.25) for t in (0.3, 0.5, 0.7, 0.9, 1.0)], 0.12, 0, False)
    # Snowballs in flight with frost trails.
    trail = mat('Trail', '#dff6ff', rough=0.3, alpha=0.5, emit=0.6)
    for i, (x, y, z, dx, dy) in enumerate([(-2.5, 4.0, 2.4, 0.5, -1), (2.8, 3.0, 2.0, -0.3, -1), (0.6, 6.2, 3.2, 0.1, -1)]):
        sphere('Snowball', snow, (x, y, z), 0.38)
        d = Vector((dx, dy, 0.25)).normalized()
        for k in range(1, 9):
            sphere('Trail', trail, Vector((x, y, z)) - d * k * 0.35, 0.34 * (1 - k / 10), seg=12)
    # Crew dodging on the ice.
    alien((-3.4, -0.6, 0.22), 50, SHIRTS[0], 'run', tilt=(0, 8))
    alien((2.8, 1.4, 0.22), 10, SHIRTS[1], 'duck')
    alien((-0.8, 3.2, 0.22), -20, SHIRTS[2], 'balance', tilt=(-6, 10))
    alien((0.2, -2.6, 0.9), 30, SHIRTS[3], 'hop', tilt=(-8, 0))
    # Burst of powder where a snowball landed.
    specks('Puff', snow, 50, ((2.4, 4.0), (-2.2, -0.8), (0.2, 1.4)), (0.06, 0.16), 2, 'ico')
    for i in range(16):
        a = math.radians(-20) + i / 15 * math.radians(220)
        r = rnd.uniform(13, 20)
        pine((math.cos(a) * r, math.sin(a) * r + 4, ground(math.cos(a) * r, math.sin(a) * r + 4) - 0.3), rnd.uniform(5, 8), True, i)
    for i in range(5):
        blob('Mountain', mat('Peak', '#e6f2ff', rough=0.6, sss=0.2), (-45 + i * 22, 75 + rnd.uniform(-8, 8), -2), rnd.uniform(14, 22), (1, 0.7, 1.3), 0.35, i, 3)
    specks('Snowfall', mat('Flake', '#ffffff', rough=0.5, emit=0.6), 300, ((-14, 14), (-6, 24), (0.5, 12)), (0.03, 0.07), 6, 'ico')
    sun((50, 0, 210), '#fff6e8', 3.8, 3)
    area((-10, -12, 8), (0, 2, 1), '#ffd9b0', 900, 8)
    bloom(0.4, 1.0, 0.5)
    camera((5.4, -10.5, 4.6), (0, 3.0, 1.6), 28, (0.4, -0.5, 1.2), 5.0)
    render('cannoncay')


# -- Shared looks for the remaining games -----------------------------------
SKY_DAY = [(0.0, '#8fd8ff'), (0.5, '#bfeaff'), (0.56, '#5ab4ff'), (0.8, '#2a7ff0'), (1.0, '#1a5fd0')]
SKY_SUNSET = [(0.0, '#ff9a6a'), (0.5, '#ffc98a'), (0.56, '#ff8f7a'), (0.75, '#a05ac8'), (1.0, '#3a2a8a')]
SKY_NIGHT = [(0.0, '#1a1440'), (0.5, '#4a3a9a'), (0.56, '#241c66'), (1.0, '#070720')]


def day(sky=SKY_DAY, amb='#a8dcff', strength=0.75, sun_rot=(50, 6, 200), sun_energy=4.2, warm='#fff2d8'):
    begin()
    sky_dome(sky)
    ambient(amb, strength)
    sun(sun_rot, warm, sun_energy, 3)
    area((-9, -11, 9), (0, 2, 1), '#ffe2b8', 800, 8)


def stars(count=260, seed=4):
    rnd = random.Random(seed)
    bm = bmesh.new()
    for _ in range(count):
        a = rnd.uniform(0, math.tau)
        e = rnd.uniform(0.08, 1.2)
        p = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * 300
        geo = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rnd.uniform(0.3, 0.9))
        for v in geo['verts']:
            v.co += p
    obj_from_bm('Stars', bm, glow('Star', '#ffffff', 6))


def grass_ground(size=80, tint='#8ed46a', height=None, uv=4.0):
    return terrain('Grass', scan('Grass', 'leafy_grass', tint=tint, rough=0.85), size, 120, height, uv)


def sand_ground(size=80, tint='#ffe6b8', height=None, uv=4.0):
    return terrain('Sand', scan('Sand', 'coast_sand_01', tint=tint, rough=0.9), size, 120, height, uv)


def place(name_parts, loc, face=0.0, scale=1.0):
    """Group freshly built parts under an empty, then move/rotate/scale it."""
    root = bpy.data.objects.new('Group', None)
    bpy.context.scene.collection.objects.link(root)
    for p in name_parts:
        kit.parent(p, root)
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(face))
    root.scale = (scale, scale, scale)
    return root


def beachball(loc, r=1.0, seed=0):
    cols = ['#ff4d5e', '#ffffff', '#ffd23f', '#ffffff', '#3d8bff', '#ffffff']
    mats = [mat(f'Ball{c}', c, rough=0.25, coat=0.8) for c in cols]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=18, radius=r, location=loc)
    o = bpy.context.active_object
    for m in mats:
        o.data.materials.append(m)
    for p in o.data.polygons:
        a = math.atan2(p.center.y, p.center.x) % math.tau
        p.material_index = int(a / math.tau * 6) % 6
        p.use_smooth = True
    o.rotation_euler = (math.radians(20 + seed * 13), math.radians(seed * 31), 0)
    return o


def bomb_prop(loc, r=0.6, lit=True):
    parts = [sphere('Bomb', mat('BombBody', '#1d2233', rough=0.2, coat=0.8), (0, 0, 0), r)]
    parts.append(cyl('Cap', mat('BombCap', '#8a93a6', rough=0.3, metal=0.8), (0, 0, r * 0.95), r * 0.32, r * 0.25))
    parts.append(kit.strut('Fuse', (0, 0, r * 1.05), (r * 0.25, 0, r * 1.5), r * 0.06, mat('Fuse', '#c9a66b', rough=0.8), 8))
    if lit:
        parts.append(sphere('Spark', glow('Spark', '#ffd27a', 25), (r * 0.27, 0, r * 1.55), r * 0.13, seg=12))
        lamp(Vector(loc) + Vector((r * 0.27, 0, r * 1.6)), '#ffb04a', 120, 0.2)
    parts.append(sphere('BombGlint', glow('BombGlint', '#ffffff', 2), (-r * 0.35, -r * 0.6, r * 0.45), r * 0.12, (1, 0.5, 1.4), seg=12))
    return place(parts, loc)


def crab(loc, face=0.0, scale=1.0, color='#ff5a3c'):
    shell = mat('CrabShell' + color, color, rough=0.35, coat=0.6)
    parts = [sphere('Crab', shell, (0, 0, 0.45), 0.6, (1.3, 0.9, 0.55))]
    for side in (-1, 1):
        parts.append(sphere('Claw', shell, (side * 0.95, -0.55, 0.65), 0.28, (1.1, 0.8, 0.7)))
        parts.append(kit.strut('Arm', (side * 0.6, -0.2, 0.45), (side * 0.9, -0.5, 0.6), 0.08, shell, 8))
        parts.append(kit.strut('Stalk', (side * 0.22, -0.35, 0.65), (side * 0.25, -0.45, 1.0), 0.05, shell, 8))
        parts.append(sphere('CrabEye', mat('White', '#ffffff', rough=0.2), (side * 0.25, -0.47, 1.05), 0.12, seg=12))
        parts.append(sphere('CrabPupil', mat('Black', '#111111', rough=0.2), (side * 0.25, -0.57, 1.06), 0.06, seg=10))
        for k in range(3):
            parts.append(kit.strut('Leg', (side * 0.6, 0.1 + k * 0.2 - 0.2, 0.35), (side * 1.0, 0.15 + k * 0.25 - 0.25, 0.0), 0.05, shell, 6))
    return place(parts, loc, face, scale)


def boat(loc, face=0.0, color='#ff4d5e', scale=1.0, rider=None, wake=True):
    hull = mat('Hull' + color, color, rough=0.25, coat=0.9)
    white = mat('HullWhite', '#f7f7f7', rough=0.3, coat=0.6)
    parts = [box('Hull', hull, (0, 0, 0.35), (1.5, 3.2, 0.7), bevel=0.25)]
    parts.append(cone('Bow', hull, (0, -1.95, 0.35), 0.75, 0.05, 0.9, (90, 0, 0), 4))
    parts[-1].scale = (1.0, 1.0, 0.55)
    parts.append(box('Deck', white, (0, 0.4, 0.75), (1.2, 1.8, 0.12), bevel=0.05))
    parts.append(box('Screen', mat('Glass', '#bff4ff', rough=0.05, alpha=0.5), (0, -0.55, 1.0), (1.1, 0.08, 0.45), (-25, 0, 0), 0.03))
    g = place(parts, loc, face, scale)
    if rider:
        a = alien((0, 0.35, 0.2), 0, rider, 'ride', 0.9)
        kit.parent(a, g)
    if wake:
        m = mat('Wake', '#f4fdff', rough=0.5, emit=0.2, alpha=0.9)
        d = Vector((math.sin(math.radians(face)), -math.cos(math.radians(face)), 0))
        back = Vector(loc) - d * 1.8 * scale
        for side in (-1, 1):
            n = Vector((-d.y, d.x, 0)) * side
            pts = [tuple(back - d * t * 3.0 + n * (0.5 + t * 1.4) * scale + Vector((0, 0, 0.06))) for t in (0, 0.25, 0.5, 0.75, 1.0)]
            ribbon('Wake', m, pts, 0.45 * scale)
        ribbon('WakeMid', m, [tuple(back - d * t * 4.0 + Vector((0, 0, 0.05))) for t in (0, 0.3, 0.6, 1.0)], 0.9 * scale)
    return g


def mushroom(loc, h=1.2, r=0.9, cap='#ff5a6e'):
    parts = [cyl('Stalk', mat('Stalk', '#fff3dc', rough=0.6), (0, 0, h / 2), r * 0.32, h, verts=16)]
    parts.append(sphere('Cap', mat('Cap' + cap, cap, rough=0.35, coat=0.5), (0, 0, h), r, (1, 1, 0.55)))
    for k in range(5):
        a = k / 5 * math.tau
        parts.append(sphere('Dot', mat('Dot', '#ffffff', rough=0.4), (math.cos(a) * r * 0.6, math.sin(a) * r * 0.6, h + r * 0.36), r * 0.16, (1, 1, 0.5), seg=10))
    return place(parts, loc)


def coin(loc, r=0.45, rot=(90, 0, 0)):
    o = cyl('Coin', mat('Gold', '#ffc93a', rough=0.18, metal=1.0), loc, r, r * 0.25, rot, 32)
    bpy.ops.object.shade_smooth()
    return o


def hoop(loc, face=0.0, color='#ff6ac8'):
    parts = [torus('Hoop', glow('HoopGlow' + color, color, 4), (0, 0, 0), 0.9, 0.08)]
    net = mat('Net', '#ffffff', rough=0.6, alpha=0.7)
    parts.append(cone('Net', net, (0, 0, -0.55), 0.9, 0.55, 1.0, (180, 0, 0), 16))
    parts.append(box('Board', mat('Board', '#ffffff', rough=0.2, alpha=0.6), (0, 1.0, 0.6), (2.4, 0.08, 1.6), bevel=0.05))
    parts.append(box('BoardRim', glow('Rim' + color, color, 3), (0, 1.0, 0.6), (2.5, 0.06, 1.7), bevel=0.02))
    g = place(parts, loc, face)
    return g


# -- Remaining minigames ------------------------------------------------------
@scene
def canopy():
    """Canopy Crush: a giant page with glowing cutouts descends on a storybook floor."""
    day(SKY_SUNSET, '#ffd6a8', 0.8, (55, 0, 160), 3.0, '#ffd9a0')
    paper = mat('Paper', '#fff5dc', rough=0.7, sss=0.1)
    ink = mat('Ink', '#7a5a3a', rough=0.8)
    for side in (-1, 1):
        def page(x, y, s=side):
            return 0.25 * (1 - math.cos(min(1.0, abs(x) / 9) * math.pi / 2)) * 6 if s * x > 0 else 0
        pg = box('Page', paper, (side * 5.2, 2, 0.15), (10.2, 13, 0.3), (0, side * -3, 0), 0.1)
        for k in range(14):
            box('Line', ink, (side * 5.2, -3.4 + k * 0.8, 0.33 + abs(side * 5.2) * 0.05 * 0), (8.2 if k % 4 else 5.5, 0.08, 0.02), (0, side * -3, 0), 0)
    box('Spine', mat('Leather', '#8a2f3a', rough=0.5, coat=0.3), (0, 2, -0.2), (21.5, 13.8, 0.5), bevel=0.2)
    # Glowing safe circles on the floor.
    ring = glow('SafeGlow', '#ffd84a', 5)
    for x, y in ((-4, 0), (3.5, 2.5), (0.5, -2.5)):
        torus('Safe', ring, (x, y, 0.36), 1.25, 0.09, scale=(1, 1, 0.3))
        cyl('SafeFill', mat('SafeFill', '#fff2a8', rough=0.6, emit=0.8), (x, y, 0.32), 1.2, 0.04)
    # The descending page with cutouts.
    top = box('FallingPage', mat('PaperTop', '#fffaf0', rough=0.7, sss=0.1), (0, 2, 6.2), (22, 15, 0.25), (6, 0, 0), 0)
    for x, y in ((-4, 0), (3.5, 2.5), (0.5, -2.5)):
        cutter = cyl('Cut', paper, (x, y, 6.2 + (y - 2) * 0.1), 1.25, 2.0)
        mod = top.modifiers.new('Hole', 'BOOLEAN')
        mod.object = cutter
        mod.operation = 'DIFFERENCE'
        cutter.hide_render = True
        cutter.hide_viewport = True
        torus('CutGlow', glow('CutGlow', '#ffe27a', 6), (x, y, 6.2 + (y - 2) * 0.1 - 0.15), 1.28, 0.06, (6, 0, 0))
    for k in range(10):
        box('TopLine', ink, (-5 + (k % 2) * 10.4, -3 + (k // 2) * 1.3, 6.2 + (-3 + (k // 2) * 1.3 - 2) * 0.1 - 0.14), (7.5, 0.08, 0.02), (6, 0, 0), 0)
    alien((-4, 0, 0.35), 20, SHIRTS[0], 'cheer')
    alien((3.5, 2.5, 0.35), -10, SHIRTS[1], 'idle')
    alien((0.5, -2.5, 0.35), 30, SHIRTS[2], 'duck')
    alien((-1.8, 3.6, 0.35), 40, SHIRTS[3], 'run', tilt=(0, -8))
    # Bookshelf backdrop.
    wood = mat('Wood', '#7a4a2a', rough=0.6)
    for k in range(4):
        box('Shelf', wood, (0, 16, 1 + k * 3.2), (40, 2, 0.4), bevel=0.05)
    rnd = random.Random(2)
    for k in range(60):
        x = -19 + (k % 15) * 2.6 + rnd.uniform(-0.3, 0.3)
        row = k // 15
        hgt = rnd.uniform(1.8, 2.7)
        box('Book', mat(f'Spine{k % 6}', ['#e8364f', '#2f6fe0', '#ffc52e', '#2fb36d', '#9a5ac8', '#ff8a3d'][k % 6], rough=0.5), (x, 15.6, 1.2 + row * 3.2 + hgt / 2), (rnd.uniform(0.8, 1.6), 1.4, hgt), bevel=0.04)
    specks('Dust', glow('Mote', '#ffe8b0', 3), 120, ((-12, 12), (-4, 14), (0.5, 6)), (0.02, 0.05), 3, 'ico')
    lamp((0, 0, 4.5), '#ffd27a', 900, 2)
    bloom(0.5, 1.0, 0.6)
    camera((7.5, -11.5, 6.5), (0, 1.5, 1.6), 28, (0, 0, 1), 6)
    render('canopy')


@scene
def bumper():
    """Bumper Buns: beach-ball jousting on a sandy ring above the surf."""
    day()
    sea, h = water(size=160, res=160, color='#2ad0e0', deep='#0a6ab0')
    isl = cyl('Arena', scan('Sand', 'coast_sand_01', tint='#ffe8c0', rough=0.9), (0, 2, -0.2), 7.5, 1.4, verts=96)
    kit.world_uvs(isl, 3)
    torus('ArenaRim', mat('Rope', '#ff7a59', rough=0.6), (0, 2, 0.48), 7.5, 0.14)
    foam_ring((0, 2, 0), 7.7, 0.25, 2, h)
    for i, (x, y, face, shirt) in enumerate([(-2.8, 1.0, 40, 0), (2.4, 3.6, -20, 1), (0.4, -1.6, 10, 2)]):
        beachball((x, y, 1.6), 1.05, i)
        alien((x, y, 2.4), face, SHIRTS[shirt], 'balance', 0.85, (0, 8 if i % 2 else -8))
    # One rider flying off the edge.
    beachball((7.6, 4.8, 2.6), 1.0, 5)
    alien((7.4, 5.2, 3.4), -60, SHIRTS[3], 'cheer', 0.85, (35, 0))
    splash = mat('Splash', '#e9fbff', rough=0.1, alpha=0.85, emit=0.1)
    rnd = random.Random(5)
    for k in range(30):
        sphere('Drop', splash, (8.2 + rnd.uniform(-1.4, 1.4), 5 + rnd.uniform(-1, 1), rnd.uniform(0.2, 2.2)), rnd.uniform(0.08, 0.22), seg=10)
    for k in range(4):
        palm((-9 + k * 1.5, 14 + k * 2, 0), rnd.uniform(5.5, 7.5), rnd.uniform(8, 18), rnd.uniform(-30, 30), k)
    isl2 = blob('Isle', scan('Sand', 'coast_sand_01', tint='#ffe8c0', rough=0.9), (-6, 16, -1), 6, (1.3, 0.8, 0.3), 0.2, 2, 3)
    for i, (x, y, z, s) in enumerate([(-30, 80, 14, 3.2), (12, 90, 20, 4.0), (45, 70, 12, 2.6)]):
        cloud((x, y, z), s, i)
    bloom(0.4, 1.0, 0.6)
    camera((6.5, -10.5, 5.4), (0.5, 2.6, 1.6), 28, (0, 1, 2), 6)
    render('bumper')


@scene
def rope():
    """Sizzle Skippers: hop the red-hot spinning grill bar."""
    day(SKY_SUNSET, '#ffc8a0', 0.7, (40, 0, 150), 3.2, '#ffcf9a')
    sand_ground(90, '#ffd9a8')
    steel = mat('Grill', '#3a3f4a', rough=0.35, metal=0.9)
    cyl('GrillBase', steel, (0, 2, 0.25), 6.0, 0.5, verts=96)
    torus('GrillRim', mat('GrillRim', '#c33a2a', rough=0.3, coat=0.5), (0, 2, 0.5), 6.0, 0.22)
    for k in range(-11, 12):
        box('Grate', mat('Grate', '#1e2228', rough=0.4, metal=0.9), (k * 0.5, 2, 0.52), (0.08, 2 * math.sqrt(max(0.1, 36 - (k * 0.5) ** 2)), 0.06), bevel=0)
    coals = glow('Coals', '#ff5a1a', 3)
    cyl('Coals', coals, (0, 2, 0.4), 5.6, 0.1)
    bar = cyl('HotBar', glow('HotBar', '#ff7a1a', 9), (0, 2, 0.95), 0.22, 12.4, (90, 0, 28))
    cyl('BarCore', glow('BarCore', '#ffd27a', 14), (0, 2, 0.95), 0.1, 12.6, (90, 0, 28))
    lamp((0, 2, 1.5), '#ff7a2a', 900, 2)
    cyl('Hub', steel, (0, 2, 0.9), 0.5, 0.6)
    rnd = random.Random(3)
    for end in (-1, 1):
        a = math.radians(28 + 90)
        x, y = math.cos(a) * 6.2 * end, 2 + math.sin(a) * 6.2 * end
        for k in range(8):
            sphere('Flame', glow('Flame', ['#ffd27a', '#ff8a2a', '#ff4a1a'][k % 3], 6), (x + rnd.uniform(-0.4, 0.4), y + rnd.uniform(-0.4, 0.4), 1.0 + k * 0.18), 0.4 - k * 0.04, seg=12)
    alien((-2.2, 0.2, 1.6), 20, SHIRTS[0], 'hop', tilt=(-10, 0))
    alien((2.6, 1.0, 0.55), -15, SHIRTS[1], 'idle')
    alien((-0.6, 4.6, 1.9), 10, SHIRTS[2], 'hop', tilt=(-12, 0))
    alien((3.2, 4.2, 0.55), -40, SHIRTS[3], 'duck')
    specks('Embers', glow('Ember', '#ffb44a', 9), 90, ((-6, 6), (-3, 8), (0.6, 5)), (0.03, 0.07), 9)
    for k in range(5):
        palm((-14 + k * 7, 18 + (k % 2) * 3, 0), rnd.uniform(6, 8), rnd.uniform(6, 16), rnd.uniform(-30, 30), k)
    bloom(0.7, 0.95, 0.7)
    camera((6.5, -9.5, 5.6), (0, 2.2, 1.0), 28, (0, 1, 1), 6)
    render('rope')


@scene
def coconut():
    """Coconut Crossfire: charge a coconut and send rivals flying."""
    day(sky=SKY_DAY, amb='#b8f0c8', strength=0.8)
    grass_ground(90, '#7fd05a', lambda x, y: 0.25 * math.sin(x * 0.3) * math.cos(y * 0.25))
    cyl('Arena', mat('Dirt', '#d8b07a', rough=0.9), (0, 2, 0.05), 6.5, 0.3, verts=64)
    torus('ArenaEdge', mat('Log', '#8a5a34', rough=0.8), (0, 2, 0.25), 6.5, 0.3)
    nut = mat('Coco', '#6a4428', rough=0.75)
    alien((-2.6, 0.6, 0.2), 40, SHIRTS[0], 'throw')
    sphere('Held', nut, (-2.9, 0.7, 3.0), 0.75)
    alien((2.6, 3.4, 0.2), -140, SHIRTS[1], 'throw')
    sphere('Held', nut, (2.8, 3.6, 2.8), 0.5)
    alien((1.2, -1.4, 1.2), 160, SHIRTS[2], 'cheer', tilt=(40, 20))
    alien((-1.0, 4.6, 0.2), 200, SHIRTS[3], 'run')
    # Coconut in flight with a dust trail.
    sphere('Flying', nut, (0.4, 0.2, 2.3), 0.55)
    trail = mat('Trail', '#fff2c8', rough=0.5, alpha=0.6, emit=0.4)
    for k in range(1, 8):
        sphere('Trail', trail, (0.4 - k * 0.38, 0.2 + k * 0.1, 2.3 + k * 0.08), 0.5 * (1 - k / 9), seg=12)
    stars_m = glow('ImpactStar', '#ffe27a', 4)
    for k in range(6):
        a = k / 6 * math.tau
        cone('Impact', stars_m, (1.2 + math.cos(a) * 1.1, -1.4, 2.4 + math.sin(a) * 1.1), 0.12, 0, 0.6, (0, math.degrees(-a) + 90, 0), 4)
    rnd = random.Random(8)
    for k in range(9):
        a = math.radians(10 + k * 20)
        palm((math.cos(a) * 11, 2 + math.sin(a) * 11, 0), rnd.uniform(6, 8.5), rnd.uniform(5, 15), rnd.uniform(-40, 40), k)
    for k in range(10):
        blob('Bush', mat('Bush', '#2f9a48', rough=0.7, sss=0.1), (rnd.uniform(-14, 14), rnd.uniform(9, 16), 0.4), rnd.uniform(1.2, 2.2), (1.2, 1, 0.8), 0.3, k, 2)
    bloom(0.4, 1.0, 0.5)
    camera((6.5, -10.0, 5.0), (0, 2.0, 1.6), 28, (0, 0.6, 1.8), 6)
    render('coconut')


@scene
def race():
    """Turbo Tide: four speedboats tear down buoy lanes to the finish arch."""
    day()
    sea, h = water(size=200, res=200, color='#27c4e6', deep='#0a5aa8', waves=[(0.08, 0.3, 0.2, 0), (0.05, -0.2, 0.5, 1.3)])
    lanes = [-4.5, -1.5, 1.5, 4.5]
    for i, x in enumerate(lanes):
        boat((x, -1.0 + i * 1.2, 0.0), 0, ['#ff4d5e', '#ffd23f', '#3d8bff', '#9a5aff'][i], 1.0, SHIRTS[i])
    buoy_r = mat('BuoyR', '#ff4d5e', rough=0.3, coat=0.6)
    buoy_w = mat('BuoyW', '#ffffff', rough=0.3, coat=0.6)
    for x in (-6, -3, 0, 3, 6):
        for k in range(14):
            sphere('Buoy', buoy_r if k % 2 else buoy_w, (x, 4 + k * 3.0, 0.1), 0.28, seg=16)
    arch = mat('Arch', '#ffd23f', rough=0.3, coat=0.6)
    for side in (-1, 1):
        cyl('ArchLeg', arch, (side * 8, 44, 3), 0.5, 7)
    box('Banner', mat('Banner', '#1a1240', rough=0.5), (0, 44, 6.6), (16.6, 0.4, 1.8), bevel=0.1)
    for k in range(16):
        box('Check', buoy_w if k % 2 else mat('CheckB', '#1a1240', rough=0.5), (-7.5 + k, 43.7, 6.6), (1.0, 0.1, 0.9), bevel=0)
    for i, (x, y, z, s) in enumerate([(-30, 90, 16, 3.2), (14, 95, 22, 4.0), (40, 80, 13, 2.6)]):
        cloud((x, y, z), s, i)
    specks('Spray', mat('Spray', '#ffffff', rough=0.2, emit=0.3), 160, ((-6, 6), (-8, 2), (0.2, 1.8)), (0.03, 0.08), 5, 'ico')
    bloom(0.4, 1.0, 0.6)
    camera((7.5, -10.5, 3.8), (0, 4.0, 1.0), 30, (1.5, -0.4, 1), 5)
    render('race')


@scene
def duos():
    """Cavern Kayaks: paddle the glowing cave river past a fire-breathing stone dragon."""
    begin()
    sky_dome([(0.0, '#10183a'), (0.5, '#1a2a5a'), (1.0, '#0a0a1a')])
    ambient('#6a8aff', 0.55)

    def bank(x, y):
        return 0.0 if abs(x) < 4.5 else min(5.0, (abs(x) - 4.5) ** 1.5 * 0.6)
    rockm = scan('CaveRock', 'dark_rock', tint='#6a6a9a', rough=0.75)
    terrain('Banks', rockm, 80, 120, bank, 3.0)
    sea, h = water(size=60, res=120, color='#1a9a8a', deep='#0a2a4a', waves=[(0.05, 0.6, 0.3, 0), (0.04, -0.4, 0.7, 1.3)], loc=(0, 0, 0.1))
    rnd = random.Random(4)
    for k in range(18):
        side = -1 if k % 2 else 1
        rock((side * rnd.uniform(6, 9), rnd.uniform(-4, 26), rnd.uniform(0, 3)), rnd.uniform(1.5, 3), rockm, k, 1.4)
    for k in range(12):
        cone('Stalactite', rockm, (rnd.uniform(-7, 7), rnd.uniform(4, 24), 9.5), rnd.uniform(0.3, 0.8), 0.02, rnd.uniform(2, 4), (180, 0, 0), 8)
    crystal = [glow('CrystalA', '#7affea', 4), glow('CrystalB', '#c08aff', 4)]
    for k in range(10):
        side = -1 if k % 2 else 1
        x, y = side * rnd.uniform(4.8, 6.5), rnd.uniform(-2, 22)
        for j in range(3):
            cone('Crystal', crystal[k % 2], (x + rnd.uniform(-0.3, 0.3), y + rnd.uniform(-0.3, 0.3), bank(x, y) + 0.4), 0.22, 0.0, rnd.uniform(0.8, 1.6), (rnd.uniform(-20, 20), rnd.uniform(-20, 20), 0), 6)
        lamp((x * 0.9, y, 1.5), ['#7affea', '#c08aff'][k % 2], 120, 1)
    kayak_m = [mat('KayakA', '#ffcf3a', rough=0.3, coat=0.8), mat('KayakB', '#ff4d7a', rough=0.3, coat=0.8)]
    for i, (x, y, face) in enumerate([(-1.6, 0.5, 8), (1.8, 4.5, -6)]):
        k = sphere('Kayak', kayak_m[i], (0, 0, 0.1), 1.0, (0.55, 2.8, 0.35))
        g = place([k], (x, y, 0.2), face)
        for j, oy in enumerate((-0.9, 0.9)):
            a = alien((x + math.sin(math.radians(face)) * oy * -1, y + oy, -0.25), face, SHIRTS[i * 2 + j], 'ride', 0.8)
        kit.strut('Paddle', (x - 1.4, y - 0.6, 1.4), (x + 1.4, y - 1.0, 0.8), 0.05, mat('Paddle', '#8a5a34', rough=0.7), 8)
    # Stone dragon head on the bank, breathing fire across the river.
    stone = scan('Dragon', 'coast_land_rocks_01', tint='#9a9ab0', rough=0.7)
    hx, hy = 6.0, 10.0
    sphere('DragonHead', stone, (hx, hy, 3.0), 1.3, (1.6, 1.1, 1.0), (0, 0, 20))
    sphere('DragonSnout', stone, (hx - 1.6, hy - 0.6, 2.7), 0.8, (1.3, 0.8, 0.7), (0, 0, 20))
    for side in (-1, 1):
        cone('DragonHorn', stone, (hx + 0.4, hy + side * 0.6, 4.2), 0.25, 0.02, 1.2, (side * 25, -30, 0), 8)
        sphere('DragonEye', glow('DragonEye', '#ff5a1a', 8), (hx - 0.9, hy - 0.4 + side * 0.55, 3.4), 0.16, seg=12)
    fire = [glow('FireA', '#ffd27a', 3.5), glow('FireB', '#ff8a2a', 3), glow('FireC', '#ff4a1a', 2.5)]
    for k in range(11):
        t = k / 10
        sphere('Fire', fire[k % 3], (hx - 2.2 - t * 4.5, hy - 0.8 - t * 1.4 + rnd.uniform(-0.3, 0.3), 2.6 - t * 0.8 + rnd.uniform(-0.2, 0.2)), 0.25 + t * 0.45, seg=12)
    lamp((hx - 4, hy - 1.5, 2.5), '#ff7a2a', 1200, 2)
    area((-3, -6, 6), (0, 3, 0.5), '#9af0ff', 1800, 6)
    area((5, -5, 4), (0, 3, 0.5), '#ffd0a0', 700, 4)
    specks('Sparks', glow('Spark', '#ffb44a', 6), 50, ((-1, 5), (6, 12), (0.5, 4)), (0.03, 0.07), 7)
    bloom(0.6, 0.95, 0.6)
    camera((3.6, -6.8, 2.8), (0, 4.0, 1.0), 30, (-1.6, 0.5, 1), 5)
    render('duos')


@scene
def sky():
    """Skybridge Sprint: race across floating isles and checkpoint arches."""
    day([(0.0, '#ffffff'), (0.4, '#cdeeff'), (0.55, '#7cc8ff'), (1.0, '#2a6ee0')], '#cfeaff', 0.85)
    grassm = scan('Grass', 'leafy_grass', tint='#8ee06a', rough=0.85)
    rockm = scan('IsleRock', 'coast_land_rocks_01', tint='#c8a07a', rough=0.8)
    isles = [(-3.5, 0.0, 0.0, 3.2), (3.5, 4.5, 0.8, 2.6), (-1.5, 10.0, 1.8, 3.0), (6.0, 14.0, 3.0, 2.4), (-6.0, 17.0, 3.5, 2.8)]
    for i, (x, y, z, r) in enumerate(isles):
        top = cyl('IsleTop', grassm, (x, y, z), r, 0.5, verts=48)
        kit.world_uvs(top, 3)
        c = cone('IsleRock', rockm, (x, y, z - r * 0.75), r, 0.3, r * 1.4, (180, 0, 0), 12)
        kit.world_uvs(c, 2)
        if i % 2 == 0:
            for k in range(2):
                blob('Bush', mat('Bush', '#2f9a48', rough=0.7), (x + (k - 0.5) * r * 0.9, y + r * 0.4, z + 0.6), 0.6, (1, 1, 0.8), 0.3, i * 3 + k, 2)
    plank = mat('Plank', '#c08a5a', rough=0.7)
    for (x0, y0, z0, _), (x1, y1, z1, _) in zip(isles, isles[1:]):
        n = 7
        for k in range(1, n):
            t = k / n
            box('Plank', plank, (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t + 0.2 - math.sin(t * math.pi) * 0.4), (1.2, 0.5, 0.12), (0, 0, math.degrees(math.atan2(y1 - y0, x1 - x0)) + 90), 0.03)
    gold = mat('GoldArch', '#ffc93a', rough=0.2, metal=1.0)
    for (x, y, z, r) in isles[1::2]:
        torus('Arch', gold, (x, y, z + 1.6), 1.7, 0.16, (90, 0, 20))
    alien((-3.2, 0.2, 0.25), 30, SHIRTS[0], 'run')
    alien((0.2, 2.4, 1.8), 10, SHIRTS[1], 'hop', tilt=(-15, 0))
    alien((3.4, 4.4, 1.05), -20, SHIRTS[2], 'cheer')
    alien((-1.4, 9.8, 2.05), 0, SHIRTS[3], 'run')
    rnd = random.Random(6)
    for k in range(9):
        cloud((rnd.uniform(-25, 25), rnd.uniform(0, 40), rnd.uniform(-8, -3)), rnd.uniform(2.2, 4), k)
    for k in range(4):
        cloud((rnd.uniform(-35, 35), rnd.uniform(50, 80), rnd.uniform(4, 16)), rnd.uniform(2.5, 4), 20 + k)
    bloom(0.35, 1.0, 0.5)
    camera((6.5, -9.0, 5.0), (0, 4.0, 1.4), 28, (-1, 1, 1), 6)
    render('sky')


@scene
def bomb():
    """Bomb Domb: grab falling bombs, lob them, survive the blasts."""
    day(SKY_SUNSET, '#ffd0b0', 0.75, (45, 0, 140), 3.2, '#ffd2a8')
    cyl('Arena', scan('Tiles', 'volcanic_rock_tiles', tint='#d8b8a0', rough=0.7), (0, 2, -0.2), 8, 0.6, verts=96)
    torus('ArenaRim', mat('Rim', '#ff5a3c', rough=0.4, coat=0.4), (0, 2, 0.1), 8, 0.25)
    sea, h = water(size=160, res=100, color='#ff9a7a', deep='#5a3a8a', loc=(0, 0, -0.6))
    for x, y in ((-2.0, 3.0), (3.4, 1.0), (1.0, 6.0), (-4.5, 0.0)):
        bomb_prop((x, y, 0.62), 0.55)
    bomb_prop((0.6, 2.0, 4.5), 0.6)
    bomb_prop((-2.8, 5.6, 6.0), 0.5)
    # A blast in progress.
    boom = [glow('BoomA', '#fff2a8', 9), glow('BoomB', '#ffb43a', 7), glow('BoomC', '#ff5a1a', 5)]
    rnd = random.Random(9)
    for k in range(14):
        sphere('Boom', boom[min(2, k // 5)], (4.4 + rnd.uniform(-1.2, 1.2), 5.4 + rnd.uniform(-1, 1), 1.2 + rnd.uniform(-0.5, 1.4)), rnd.uniform(0.5, 1.1) * (1 + k * 0.04), seg=14)
    for k in range(8):
        blob('Smoke', mat('Smoke', '#5a4a5a', rough=1), (4.4 + rnd.uniform(-1.8, 1.8), 6 + rnd.uniform(-1, 1), 2.6 + rnd.uniform(0, 1.4)), rnd.uniform(0.6, 1.0), (1, 1, 1), 0.3, k, 2)
    lamp((4.4, 5.0, 2.0), '#ff9a3a', 2600, 2)
    alien((-1.4, -0.6, 0.1), 30, SHIRTS[0], 'throw')
    bomb_prop((-1.7, -0.5, 2.95), 0.45)
    alien((2.2, -1.2, 0.1), -20, SHIRTS[1], 'run')
    alien((-3.8, 2.6, 0.1), 50, SHIRTS[2], 'duck')
    alien((5.8, 4.0, 1.2), -80, SHIRTS[3], 'cheer', tilt=(30, -20))
    bloom(0.7, 0.95, 0.7)
    camera((6.5, -9.5, 5.6), (0, 2.6, 1.4), 28, (0, 0, 1.4), 6)
    render('bomb')


@scene
def paint():
    """Moss Bosses: hop between mushrooms and stamp the moss in your colour."""
    day(amb='#c8f0c0', strength=0.8)
    grass_ground(90, '#86c95a')
    cols = ['#12ad9a', '#f25265', '#7549cb', '#f4b62c']
    tm = [mat('Tile' + c, c, rough=0.6, sss=0.1) for c in cols]
    moss = mat('Moss', '#6aa84a', rough=0.9)
    rnd = random.Random(3)
    for ix in range(-6, 7):
        for iy in range(-4, 9):
            if (ix * 1.1) ** 2 + ((iy - 2) * 1.1) ** 2 > 58:
                continue
            r = rnd.random()
            m = tm[int(r * 4)] if r < 0.62 else moss
            box('Tile', m, (ix * 1.1, iy * 1.1, 0.12), (1.0, 1.0, 0.24), bevel=0.08)
    cyl('Pond', mat('Pond', '#3ac0e0', rough=0.05, coat=0.8), (0, 2.2, 0.2), 1.6, 0.1)
    for k in range(5):
        sphere('Lily', mat('Lily', '#5ad06a', rough=0.5), (math.cos(k) * 1.0, 2.2 + math.sin(k) * 0.9, 0.27), 0.3, (1, 1, 0.15), seg=12)
    for (x, y, c) in ((-4.5, 5.5, '#ff5a6e'), (5.2, 5.0, '#ffb43a'), (6.4, -0.5, '#9a5aff'), (-6.0, 0.5, '#3d8bff')):
        mushroom((x, y, 0), 1.6, 1.2, c)
    alien((-2.2, -0.5, 1.6), 30, SHIRTS[0], 'hop', tilt=(-12, 0))
    alien((2.2, 0.6, 0.25), -20, SHIRTS[1], 'cheer')
    alien((-0.5, 4.8, 0.25), 10, SHIRTS[2], 'duck')
    alien((3.6, 3.6, 2.2), -30, SHIRTS[3], 'hop', tilt=(-10, 8))
    splat = glow('Splat', '#7af0e0', 2)
    for k in range(10):
        a = k / 10 * math.tau
        sphere('Splat', splat, (-2.2 + math.cos(a) * 0.9, -0.5 + math.sin(a) * 0.9, 0.3), 0.12, seg=10)
    for k in range(10):
        a = math.radians(-10 + k * 22)
        pine((math.cos(a) * 14, 3 + math.sin(a) * 12, 0), rnd.uniform(5, 7), False, k, '#2a8a4a')
    bloom(0.35, 1.0, 0.5)
    camera((6.5, -9.5, 7.0), (0, 2.0, 0.6), 28, (0, 0, 1), 6)
    render('paint')


@scene
def dig():
    """Picture Perfect: rebuild the scattered postcard picture piece by piece."""
    day(SKY_DAY, '#d8e8ff', 0.8)
    wood = scan('Planks', 'brown_planks_05', tint='#e0b080', rough=0.6)
    t = box('Table', wood, (0, 2, -0.3), (18, 13, 0.6), bevel=0.15)
    kit.world_uvs(t, 3)
    frame = mat('Frame', '#ffc93a', rough=0.3, metal=0.6)
    box('FrameBack', mat('FrameBack', '#2a1a40', rough=0.8), (-2.5, 3.5, 0.12), (6.6, 4.6, 0.2), bevel=0.05)
    for (x, y, sx, sy) in ((-2.5, 5.85, 7.0, 0.35), (-2.5, 1.15, 7.0, 0.35), (-5.85, 3.5, 0.35, 4.9), (0.85, 3.5, 0.35, 4.9)):
        box('Frame', frame, (x, y, 0.3), (sx, sy, 0.4), bevel=0.06)
    img_path = os.path.join(OUT, 'boulderbuffet.webp')
    pic = mat('Picture', '#ffffff', rough=0.5)
    if os.path.exists(img_path):
        tex = pic.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(img_path)
        pic.node_tree.links.new(tex.outputs['Color'], pic.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    rnd = random.Random(5)
    for i in range(8):
        cx, cy = i % 4, i // 4
        placed = i in (0, 1, 4)
        if placed:
            loc = (-2.5 - 2.4 + cx * 1.6 + 0.8, 3.5 - 1.0 + cy * 2.0, 0.32)
            rotz = 0
        else:
            loc = (rnd.uniform(1.8, 6.5), rnd.uniform(-1.5, 6.5), 0.32 + rnd.uniform(0, 0.4))
            rotz = rnd.uniform(-60, 60)
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        p = bpy.context.active_object
        p.scale = (1.55, 1.95, 0.18)
        p.rotation_euler = (0, 0, math.radians(rotz))
        p.data.materials.append(pic)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bm = bmesh.new()
        bm.from_mesh(p.data)
        uv = bm.loops.layers.uv.verify()
        for f in bm.faces:
            for l in f.loops:
                lx = (l.vert.co.x / 1.55 + 0.5)
                ly = (l.vert.co.y / 1.95 + 0.5)
                l[uv].uv = ((cx + lx) / 4, 1 - (1 - cy + (1 - ly)) / 2)
        bm.to_mesh(p.data)
        bm.free()
        mod = p.modifiers.new('Bevel', 'BEVEL')
        mod.width = 0.05
        if placed:
            continue
        torus('PieceGlow', glow('PieceGlow', '#ffe27a', 3), (loc[0], loc[1], loc[2] - 0.12), 1.15, 0.04, (0, 0, 0), (1.0, 1.25, 0.3)) if i == 6 else None
    alien((3.4, -2.2, 0.0), 20, SHIRTS[0], 'cheer')
    alien((5.8, 3.4, 0.0), -30, SHIRTS[1], 'point')
    alien((0.8, 7.4, 0.0), 10, SHIRTS[2], 'idle')
    alien((-6.4, -0.8, 0.0), 40, SHIRTS[3], 'wave')
    bloom(0.35, 1.0, 0.5)
    camera((4.5, -9.5, 8.5), (0, 2.6, 0.2), 30, (0, 2, 0.5), 7)
    render('dig')


@scene
def skate():
    """Aurora Glide: four laps around the iceberg under the aurora."""
    begin()
    sky_dome(SKY_NIGHT)
    ambient('#6a8aff', 0.45)
    stars()
    ribbon_m = [glow('AuroraG', '#4affb0', 2.5), glow('AuroraP', '#b07aff', 2.0)]
    for k in range(5):
        pts = [(-80 + t * 16, 120 + math.sin(t * 0.9 + k) * 12, 6 + k * 3.5 + math.sin(t * 0.6 + k) * 4) for t in range(11)]
        bm = bmesh.new()
        rows = []
        for (x, y, z) in pts:
            rows.append((bm.verts.new((x, y, z)), bm.verts.new((x, y + 2, z + 18 + k * 2))))
        for j in range(len(rows) - 1):
            bm.faces.new((rows[j][0], rows[j + 1][0], rows[j + 1][1], rows[j][1]))
        o = obj_from_bm('Aurora', bm, ribbon_m[k % 2], False)
    snow = mat('Snow', '#eef6ff', rough=0.55, sss=0.3)
    terrain('Snow', snow, 120, 100, lambda x, y: 0.0 if math.hypot(x, (y - 3) * 1.3) < 11 else min(3, (math.hypot(x, (y - 3) * 1.3) - 11) * 0.5), 4)
    ice = mat('Ice', '#9adcff', rough=0.03, coat=1.0, spec=0.9)
    cyl('Rink', ice, (0, 3, 0.06), 10.5, 0.12, scale=(1, 0.78, 1), verts=128)
    torus('RinkEdge', snow, (0, 3, 0.15), 10.5, 0.45, scale=(1, 0.78, 0.6))
    bergm = mat('Berg', '#cdeeff', rough=0.2, sss=0.4, coat=0.6)
    berg = blob('Iceberg', bergm, (0, 3.6, 0.6), 2.6, (1.5, 0.9, 0.8), 0.4, 3, 2, smooth=False)
    for k, (x, y, hgt, r) in enumerate([(-0.8, 3.6, 4.2, 1.4), (0.9, 3.9, 3.2, 1.2), (2.2, 3.4, 2.2, 0.9), (-2.3, 3.2, 2.4, 1.0)]):
        c = cone('IcePeak', bergm, (x, y, hgt / 2 + 0.6), r, 0.1, hgt, (0, (k - 1.5) * 8, k * 40), 6)
        for p in c.data.polygons:
            p.use_smooth = False
    trail = mat('SkateTrail', '#ffffff', rough=0.3, emit=0.6, alpha=0.7)
    for i, (a, face, pose) in enumerate([(-100, 0, 'balance'), (-60, -40, 'run'), (-140, 40, 'balance'), (-20, -80, 'cheer')]):
        r = 6.8
        x, y = math.cos(math.radians(a)) * r, 3 + math.sin(math.radians(a)) * r * 0.78
        alien((x, y, 0.12), face, SHIRTS[i], pose, 1.0, (0, -12))
        pts = [(math.cos(math.radians(a - 4 * t)) * r, 3 + math.sin(math.radians(a - 4 * t)) * r * 0.78, 0.14) for t in range(1, 9)]
        ribbon('Trail', trail, pts, 0.18)
    for k in range(10):
        a = math.radians(-5 + k * 21)
        pine((math.cos(a) * 16, 6 + math.sin(a) * 13, 1.5), 6, True, k)
    lamp((0, -2, 6), '#bfe8ff', 1500, 4)
    lamp((-6, 8, 4), '#4affb0', 900, 4)
    sun((55, 0, 200), '#bfd8ff', 1.2, 3)
    specks('Snowfall', mat('Flake', '#ffffff', rough=0.5, emit=1.0), 250, ((-14, 14), (-6, 24), (0.5, 12)), (0.03, 0.07), 6, 'ico')
    bloom(0.7, 0.9, 0.7)
    camera((6.0, -10.5, 5.2), (0, 3.0, 1.2), 28, (0, -3, 1), 6)
    render('skate')


@scene
def factory():
    """Bun & Done: a two-team conveyor kitchen aboard the orbital diner."""
    begin()
    sky_dome(SKY_NIGHT)
    ambient('#ffc8f0', 0.6)
    stars()
    floor = mat('Checker', '#ffffff', rough=0.4)
    nt = floor.node_tree
    ch = nt.nodes.new('ShaderNodeTexChecker')
    ch.inputs['Scale'].default_value = 12
    ch.inputs['Color1'].default_value = kit.linear('#ff6ab0')
    ch.inputs['Color2'].default_value = kit.linear('#fff2f8')
    nt.links.new(ch.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    f = box('Floor', floor, (0, 4, -0.1), (20, 16, 0.2), bevel=0)
    belt = mat('Belt', '#2a2a3a', rough=0.6)
    chrome = mat('Chrome', '#dfe6ee', rough=0.15, metal=1.0)
    bun = mat('Bun', '#e8a24a', rough=0.5, coat=0.3)
    patty = mat('Patty', '#6a3a24', rough=0.7)
    lettuce = mat('Lettuce', '#5ad06a', rough=0.5)
    for row, y in enumerate((1.0, 5.0)):
        box('Conveyor', belt, (0, y, 0.9), (14, 1.6, 0.25), bevel=0.05)
        box('ConveyorSide', chrome, (0, y - 0.85, 0.85), (14, 0.12, 0.45), bevel=0.03)
        box('ConveyorSide', chrome, (0, y + 0.85, 0.85), (14, 0.12, 0.45), bevel=0.03)
        for k in range(5):
            x = -5.5 + k * 2.8 + row
            box('Tray', mat('Tray', '#ffd23f', rough=0.3), (x, y, 1.1), (1.3, 1.1, 0.12), bevel=0.04)
            sphere('BunBottom', bun, (x, y, 1.3), 0.5, (1, 1, 0.45))
            if k % 2 == 0:
                cyl('Patty', patty, (x, y, 1.48), 0.52, 0.18)
                cyl('Lettuce', lettuce, (x, y, 1.6), 0.56, 0.06)
                sphere('BunTop', bun, (x, y, 1.75), 0.52, (1, 1, 0.6))
    for x in (-7.5, 7.5):
        box('Bin', mat('Bin', '#3d8bff', rough=0.3, coat=0.4), (x, 3, 0.8), (1.6, 1.6, 1.6), bevel=0.15)
    box('Window', mat('Hatch', '#1a1240', rough=0.3), (0, 10.5, 3), (8, 0.3, 4), bevel=0.2)
    box('Neon', glow('Neon', '#ff6ab0', 6), (0, 10.3, 5.3), (6, 0.1, 0.3), bevel=0)
    alien((-3.0, 3.0, 0), 20, SHIRTS[0], 'throw')
    sphere('HeldBun', bun, (-3.2, 3.1, 2.9), 0.45, (1, 1, 0.5))
    alien((2.0, 3.0, 0), -20, SHIRTS[1], 'run')
    alien((-5.5, 7.2, 0), 10, SHIRTS[2], 'cheer')
    alien((4.6, -0.8, 0), -40, SHIRTS[3], 'point')
    lamp((0, 3, 6), '#ffffff', 1500, 4)
    lamp((-6, -2, 4), '#ff8ad0', 800, 3)
    bloom(0.5, 1.0, 0.6)
    camera((6.0, -9.0, 6.5), (0, 3.0, 1.0), 28, (0, 2, 1), 6)
    render('factory')


@scene
def prickleice():
    """Powder Panic: ski the slalom while the avalanche rumbles behind."""
    day([(0.0, '#dff3ff'), (0.5, '#eef9ff'), (0.56, '#8ccaff'), (1.0, '#2a6ee0')], '#d8ecff', 0.85)
    snow = mat('Snow', '#f3f9ff', rough=0.55, sss=0.35)
    slope = lambda x, y: y * 0.45 + 0.3 * math.sin(x * 0.5) + 0.2 * math.cos(y * 0.4)
    terrain('Slope', snow, 100, 140, slope, 4)
    gate = [mat('GateR', '#ff3a4a', rough=0.4), mat('GateB', '#2a6fe0', rough=0.4)]
    for k in range(6):
        x = (-2.5 if k % 2 else 2.5)
        y = -2 + k * 4.5
        cyl('Pole', gate[k % 2], (x, y, slope(x, y) + 1), 0.07, 2.0)
        box('Flag', gate[k % 2], (x + 0.4, y, slope(x, y) + 1.6), (0.8, 0.05, 0.6), bevel=0)
    rnd = random.Random(4)
    for k in range(26):
        x = rnd.choice([-1, 1]) * rnd.uniform(6, 16)
        y = rnd.uniform(-4, 40)
        pine((x, y, slope(x, y) - 0.2), rnd.uniform(4, 7), True, k)
    for k in range(5):
        x, y = rnd.uniform(-5, 5), rnd.uniform(4, 25)
        rock((x, y, slope(x, y) - 0.2), rnd.uniform(0.6, 1.1), scan('Rock', 'coast_land_rocks_01', tint='#a8a8b8'), k)
    # Avalanche wall.
    av = mat('Avalanche', '#ffffff', rough=0.8, sss=0.3)
    for k in range(26):
        x = -14 + k * 1.1
        blob('Avalanche', av, (x, 30 + rnd.uniform(-2, 2), slope(0, 30) + rnd.uniform(1, 5)), rnd.uniform(2.2, 4.0), (1, 1, 1), 0.3, k, 2)
    skis = mat('Skis', '#ffd23f', rough=0.3, coat=0.8)
    for i, (x, y, face, tilt) in enumerate([(0.6, 1.0, 10, (-20, -18)), (-3.4, 6.5, -20, (-20, 14)), (3.8, 10.0, 25, (-20, -14)), (-1.0, 15.0, 0, (-20, 0))]):
        z = slope(x, y)
        a = alien((x, y, z + 0.3), face, SHIRTS[i], 'balance' if i % 2 else 'run', 1.0, tilt)
        for side in (-0.16, 0.16):
            box('Ski', skis, (x + side, y, z + 0.12), (0.14, 2.2, 0.05), (-24, 0, face), 0.02)
        ribbon('Track', mat('Track', '#cfe4f5', rough=0.6), [(x + side * 0, y + t, slope(x, y + t) + 0.02) for t in (0.8, 2, 3.5, 5)], 0.5)
    specks('Powder', snow, 120, ((-2, 3), (-1, 2), (0, 1.6)), (0.04, 0.12), 3, 'ico')
    bloom(0.35, 1.0, 0.5)
    camera((2.8, -5.2, 2.2), (-0.2, 6.0, 3.4), 28, (0.6, 1.0, 1.4), 4)
    render('prickleice')


@scene
def crabtraffic():
    """Crustacean Crossing: thread the gaps in the marching crab colony."""
    day()
    sand_ground(100, '#ffe2b0', lambda x, y: -0.6 if y > 12 else 0.08 * math.sin(x * 0.7))
    sea, h = water(size=160, res=100, color='#2ad0e0', deep='#0a6ab0', loc=(0, 70, -0.3))
    rnd = random.Random(2)
    for row in range(3):
        for k in range(7):
            x = -9 + k * 2.6 + row * 1.2 + rnd.uniform(-0.4, 0.4)
            y = -1 + row * 3.4 + rnd.uniform(-0.4, 0.4)
            if row == 1 and k in (3, 4):
                continue
            crab((x, y, 0), rnd.uniform(-110, -70), rnd.uniform(0.75, 1.25), ['#ff5a3c', '#ff7a3a', '#e8364f'][k % 3])
    alien((1.4, 2.8, 0.05), 20, SHIRTS[0], 'run')
    alien((-3.6, -2.6, 0.05), 30, SHIRTS[1], 'duck')
    alien((4.6, 5.8, 0.05), -10, SHIRTS[2], 'balance')
    alien((-1.0, 7.6, 0.05), 0, SHIRTS[3], 'cheer')
    for k in range(6):
        palm((-14 + k * 5.6, 13 + (k % 2) * 2, 0), rnd.uniform(6, 8), rnd.uniform(8, 18), rnd.uniform(-30, 30), k)
    for k in range(8):
        sphere('Shell', mat('ShellPink', '#ffc0c8', rough=0.4), (rnd.uniform(-8, 8), rnd.uniform(-4, 10), 0.08), 0.2, (1, 0.7, 0.4), seg=12)
    for i, (x, y, z, s) in enumerate([(-30, 90, 16, 3.2), (14, 95, 22, 4.0)]):
        cloud((x, y, z), s, i)
    bloom(0.4, 1.0, 0.6)
    camera((6.0, -10.0, 6.0), (0, 2.6, 0.6), 28, (0, 0, 1), 6)
    render('crabtraffic')


@scene
def crumbleclock():
    """Comet Hoops: jump-shoot glowing comets through moving hoops."""
    begin()
    sky_dome(SKY_NIGHT)
    ambient('#8a7aff', 0.45)
    stars(400)
    court = mat('Court', '#3a2a7a', rough=0.35, coat=0.4)
    cyl('Court', court, (0, 2, -0.1), 9, 0.3, verts=96)
    torus('CourtLine', glow('CourtLine', '#7affea', 3), (0, 2, 0.06), 6.5, 0.05, scale=(1, 1, 0.2))
    torus('CourtEdge', glow('CourtEdge', '#ff6ac8', 3), (0, 2, 0.06), 8.9, 0.08, scale=(1, 1, 0.2))
    hoop((-4.0, 8.0, 5.0), 0, '#ff6ac8')
    hoop((0.5, 9.0, 6.4), 0, '#ffe27a')
    hoop((5.0, 8.0, 4.6), 0, '#7affea')
    cols = ['#ffe27a', '#ff6ac8', '#7affea']
    for i, (x, y, z, dx, dz) in enumerate([(0.0, 5.0, 4.8, -0.6, -0.8), (-3.0, 4.0, 3.4, 0.6, -0.9)]):
        c = cols[i]
        sphere('Comet', glow('Comet' + c, c, 10), (x, y, z), 0.42)
        lamp((x, y, z), c, 400, 0.5)
        trail = mat('CometTrail' + c, c, rough=0.5, emit=3, alpha=0.6)
        for k in range(1, 10):
            sphere('Trail', trail, (x + dx * k * 0.35, y - k * 0.25, z + dz * k * 0.35), 0.4 * (1 - k / 11), seg=12)
    alien((0.0, 2.2, 1.6), 10, SHIRTS[0], 'throw', tilt=(-10, 0))
    alien((-3.4, 1.2, 1.2), 20, SHIRTS[1], 'hop', tilt=(-10, 0))
    alien((3.4, 0.8, 0.2), -20, SHIRTS[2], 'cheer')
    alien((2.0, 4.4, 0.2), -10, SHIRTS[3], 'idle')
    specks('Sparkle', glow('Sparkle', '#ffffff', 6), 120, ((-8, 8), (0, 12), (1, 9)), (0.03, 0.06), 2, 'ico')
    lamp((0, -2, 8), '#c8b8ff', 1800, 5)
    bloom(0.9, 0.85, 0.75)
    camera((5.0, -8.5, 3.8), (0, 5.0, 3.4), 28, (0, 2, 2), 5)
    render('crumbleclock')


@scene
def lanternlurk():
    """Last-Second Spotlight: hold your nerve as the night beast creeps closer."""
    begin()
    sky_dome([(0.0, '#0a0a20'), (0.5, '#2a2050'), (0.56, '#141030'), (1.0, '#05050f')])
    ambient('#3a3a8a', 0.3)
    stars(300)
    sphere('Moon', glow('Moon', '#fff4d0', 4), (-40, 120, 50), 9)
    grass_ground(90, '#3a5a6a')
    rnd = random.Random(7)
    for k in range(14):
        a = math.radians(20 + k * 10)
        pine((math.cos(a) * rnd.uniform(12, 18), 4 + math.sin(a) * rnd.uniform(10, 14), 0), rnd.uniform(6, 9), False, k, '#15303a')
    # The beast: a big shadowy furball with glowing eyes.
    fur = mat('Fur', '#4a3a7a', rough=0.85, sss=0.1)
    bx, by = 0.6, 9.5
    blob('Beast', fur, (bx, by, 2.8), 2.8, (1.2, 1, 1.0), 0.35, 4, 3)
    for side in (-1, 1):
        sphere('BeastEye', glow('BeastEye', '#ffe24a', 9), (bx + side * 0.95, by - 2.45, 3.7), 0.42, (1, 0.6, 0.75))
        sphere('BeastPupil', mat('BeastPupil', '#1a0a10', rough=0.3), (bx + side * 0.95, by - 2.75, 3.7), 0.16, (0.6, 0.5, 1.2), seg=12)
        cone('Ear', fur, (bx + side * 1.5, by - 0.2, 5.3), 0.7, 0.05, 1.6, (0, side * -25, 0), 8)
        sphere('Paw', fur, (bx + side * 1.9, by - 2.0, 0.5), 0.7, (1, 1.3, 0.6))
    sphere('BeastMouth', mat('BeastMouth', '#1a0a20', rough=0.6), (bx, by - 2.5, 2.4), 0.9, (1.3, 0.4, 0.45))
    for k in range(6):
        cone('Fang', mat('Fang', '#fff6e0', rough=0.3), (bx - 0.75 + k * 0.3, by - 2.8, 2.7), 0.09, 0.0, 0.32, (180, 0, 0), 8)
    area((bx, by + 5, 6), (bx, by, 3), '#c07aff', 3000, 6)  # rim light behind the beast
    beam = mat('Beam', '#fff6c0', rough=1, emit=0.9, alpha=0.12)
    for i, (x, y, pose) in enumerate([(-3.0, 0.4, 'duck'), (-1.0, -0.4, 'point'), (1.4, -0.2, 'point'), (3.4, 0.6, 'duck')]):
        alien((x, y, 0), 180, SHIRTS[i], pose)
        if pose == 'point':
            hx, hy, hz = x - 0.25, y + 0.9, 1.75
            tx, ty, tz = bx + (x - bx) * 0.3, by - 2.5, 3.2
            mid = Vector(((hx + tx) / 2, (hy + ty) / 2, (hz + tz) / 2))
            length = (Vector((tx, ty, tz)) - Vector((hx, hy, hz))).length
            c = cone('Beam', beam, tuple(mid), 1.3, 0.1, length, (0, 0, 0), 24)
            c.rotation_mode = 'QUATERNION'
            c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((Vector((hx, hy, hz)) - Vector((tx, ty, tz))).normalized())
            cyl('Flashlight', mat('Torch', '#ffd23f', rough=0.3, metal=0.5), (hx, hy - 0.1, hz), 0.1, 0.4, (90, 0, 0), 12)
            lt = lamp((hx, hy, hz), '#fff2c0', 2500, 0.1, 'SPOT')
            lt.data.spot_size = math.radians(28)
            lt.rotation_mode = 'QUATERNION'
            lt.rotation_quaternion = Vector((0, 0, -1)).rotation_difference((Vector((tx, ty, tz)) - Vector((hx, hy, hz))).normalized())
    specks('Fireflies', glow('Firefly', '#d8ff7a', 6), 50, ((-10, 10), (0, 14), (0.5, 4)), (0.04, 0.07), 3, 'ico')
    lamp((0, -6, 5), '#6a7aff', 900, 4)
    bloom(0.7, 0.9, 0.7)
    camera((1.2, -7.5, 3.0), (0.4, 6.0, 2.6), 28, (0.5, 3, 2.6), 4)
    render('lanternlurk')


@scene
def vinevault():
    """Canopy Cadence: leap leaf to leaf up the giant vine."""
    day([(0.0, '#bff0c8'), (0.5, '#dff8e0'), (0.56, '#8ad8b0'), (1.0, '#2a8a7a')], '#c8f0d0', 0.8)
    vine = mat('Vine', '#3a8a3a', rough=0.6, sss=0.1)
    leaf = mat('Leaf', '#5ad05a', rough=0.45, sss=0.2, coat=0.3)
    for k in range(18):
        z = k * 0.9
        cyl('VineSeg', vine, (math.sin(z * 0.6) * 0.4, 3 + math.cos(z * 0.5) * 0.3, z), 0.55, 1.0, verts=16)
    for k in range(8):
        z = 0.8 + k * 1.9
        side = -1 if k % 2 else 1
        l = sphere('Leaf', leaf, (side * 2.0, 3, z), 1.0, (1.9, 1.2, 0.12), (0, side * 6, side * 10))
        kit.strut('Stem', (0, 3, z - 0.1), (side * 1.2, 3, z), 0.1, vine, 8)
    alien((2.0, 3, 1.05), 10, SHIRTS[0], 'idle')
    alien((-1.6, 2.6, 3.6), 20, SHIRTS[1], 'hop', tilt=(-10, 0))
    alien((-2.0, 3, 4.75), -10, SHIRTS[2], 'cheer')
    alien((2.2, 3, 8.6), 0, SHIRTS[3], 'run')
    rnd = random.Random(9)
    for k in range(10):
        x = rnd.choice([-1, 1]) * rnd.uniform(9, 16)
        palm((x, rnd.uniform(6, 20), -2), rnd.uniform(10, 16), rnd.uniform(0, 10), rnd.uniform(0, 360), k)
    for k in range(8):
        blob('Mist', mat('Mist', '#ffffff', rough=1, alpha=0.5), (rnd.uniform(-15, 15), rnd.uniform(10, 25), rnd.uniform(0, 6)), rnd.uniform(2, 4), (2, 1, 0.6), 0.2, k, 2)
    grass_ground(90, '#4aa04a')
    specks('Pollen', glow('Pollen', '#fff2a8', 4), 90, ((-8, 8), (-2, 10), (0.5, 14)), (0.03, 0.06), 4, 'ico')
    bloom(0.35, 1.0, 0.5)
    camera((5.0, -8.5, 6.5), (0, 3.0, 4.4), 30, (0, 3, 4), 6)
    render('vinevault')


@scene
def mangrovemotors():
    """Buoy Bandits: hairpin turns through numbered buoy gates."""
    day()
    sea, h = water(size=200, res=200, color='#22c8c0', deep='#0a5a8a')
    for i, (x, y, face) in enumerate([(-2.0, 0.0, -30), (2.8, 3.0, -55), (-4.6, 5.0, -10), (1.0, 8.0, -70)]):
        boat((x, y, 0), face, ['#ff4d5e', '#ffd23f', '#3d8bff', '#9a5aff'][i], 0.95, SHIRTS[i])
    buoy = mat('BuoyO', '#ff8a2a', rough=0.3, coat=0.6)
    white = mat('BuoyW', '#ffffff', rough=0.3, coat=0.6)
    for k, (x, y) in enumerate([(5.5, 6.0), (8.0, 7.5), (-7.0, 11.0), (-4.5, 13.0)]):
        cyl('Buoy', buoy, (x, y, 0.4), 0.45, 1.0)
        cone('BuoyTop', white, (x, y, 1.15), 0.45, 0.1, 0.5)
        foam_ring((x, y, 0), 0.7, 0.08, k, h)
    rnd = random.Random(2)
    root = mat('Root', '#6a4a30', rough=0.8)
    for i, (x, y) in enumerate([(-14, 20), (12, 24), (0, 34)]):
        for k in range(8):
            kit.strut('Root', (x + rnd.uniform(-2, 2), y + rnd.uniform(-2, 2), -0.5), (x + rnd.uniform(-0.6, 0.6), y + rnd.uniform(-0.6, 0.6), 2.5), 0.18, root, 8)
        blob('Canopy', mat('Mangrove', '#2f9a48', rough=0.7), (x, y, 4.0), 3.6, (1.4, 1.2, 0.8), 0.35, i, 3)
    for i, (x, y, z, s) in enumerate([(-30, 90, 16, 3.2), (14, 95, 22, 4.0), (40, 80, 13, 2.6)]):
        cloud((x, y, z), s, i)
    bloom(0.4, 1.0, 0.6)
    camera((7.0, -9.5, 5.5), (0, 4.0, 0.6), 28, (0, 1, 1), 6)
    render('mangrovemotors')


@scene
def bubbletrouble():
    """Reef Ring Rally: swim through drifting gold rings over the reef."""
    begin()
    sky_dome([(0.0, '#04203a'), (0.5, '#0a5a8a'), (0.8, '#1a9ad0'), (1.0, '#5ad8ff')])
    ambient('#3ab0e0', 0.8)
    floor = scan('ReefSand', 'coast_sand_01', tint='#ffe8c0', rough=0.9)
    terrain('Seabed', floor, 80, 100, lambda x, y: 0.4 * math.sin(x * 0.4) + 0.3 * math.cos(y * 0.5), 4)
    coral = ['#ff5a8a', '#ff9a3a', '#b07aff', '#3affd0', '#ffd23f']
    rnd = random.Random(3)
    for k in range(30):
        x, y = rnd.uniform(-12, 12), rnd.uniform(2, 20)
        c = coral[k % 5]
        if k % 3 == 0:
            for j in range(4):
                cone('CoralBranch', mat('Coral' + c, c, rough=0.5, sss=0.2), (x + rnd.uniform(-0.4, 0.4), y + rnd.uniform(-0.4, 0.4), 0.8), 0.25, 0.08, rnd.uniform(1.2, 2.4), (rnd.uniform(-25, 25), rnd.uniform(-25, 25), 0), 8)
        else:
            blob('CoralBrain', mat('Coral' + c, c, rough=0.5, sss=0.2), (x, y, 0.3), rnd.uniform(0.6, 1.2), (1, 1, 0.7), 0.4, k, 2)
    gold = mat('GoldRing', '#ffc93a', rough=0.15, metal=1.0)
    silver = mat('SilverRing', '#dff6ff', rough=0.15, metal=1.0)
    for i, (x, y, z, rot) in enumerate([(-2.5, 4.0, 3.0, 10), (2.4, 6.0, 4.2, -15), (0.0, 10.0, 5.0, 5), (-4.6, 9.0, 2.6, 20)]):
        torus('Ring', gold if i % 2 == 0 else silver, (x, y, z), 1.1, 0.14, (90, 0, rot))
        torus('RingGlow', glow('RingGlow', '#fff2a8', 2), (x, y, z), 1.1, 0.04, (90, 0, rot))
    jelly = mat('Jelly', '#ff8ad8', rough=0.1, alpha=0.55, emit=1.2)
    for k, (x, y, z) in enumerate([(4.5, 9.0, 5.0), (-6.0, 12.0, 6.0)]):
        sphere('Jelly', jelly, (x, y, z), 0.9, (1, 1, 0.65))
        for j in range(6):
            a = j / 6 * math.tau
            kit.strut('Tentacle', (x + math.cos(a) * 0.5, y + math.sin(a) * 0.5, z - 0.2), (x + math.cos(a) * 0.6, y + math.sin(a) * 0.6, z - 2.0), 0.04, jelly, 6)
    alien((-2.5, 3.6, 2.4), 20, SHIRTS[0], 'swim', 1.0, (-60, 0))
    alien((2.4, 2.6, 3.4), -10, SHIRTS[1], 'swim', 1.0, (-50, 10))
    alien((-0.4, 7.0, 4.6), 0, SHIRTS[2], 'cheer', 1.0, (-20, 0))
    alien((4.4, 5.0, 1.8), -40, SHIRTS[3], 'swim', 1.0, (-70, -10))
    specks('Bubbles', mat('Bubble', '#e8fbff', rough=0.05, alpha=0.6, emit=0.6), 160, ((-8, 8), (0, 14), (0.5, 9)), (0.05, 0.16), 5, 'ico')
    for k in range(6):
        l = lamp((rnd.uniform(-8, 8), rnd.uniform(0, 14), 14), '#9af0ff', 1600, 2, 'SPOT')
        l.data.spot_size = math.radians(25)
        l.rotation_euler = (math.radians(rnd.uniform(-10, 10)), math.radians(rnd.uniform(-10, 10)), 0)
    sun((30, 0, 200), '#bff4ff', 2.5, 6)
    bloom(0.6, 0.9, 0.7)
    camera((5.0, -7.5, 3.0), (0, 6.0, 3.6), 28, (0, 3, 3), 5)
    render('bubbletrouble')


@scene
def frostyfreight():
    """Summit Signal: climb the icy wall together before the blizzard hits."""
    day([(0.0, '#cfe8ff'), (0.5, '#e8f4ff'), (0.6, '#9ac8ff'), (1.0, '#3a6ee0')], '#d8ecff', 0.9, (55, 0, 25), 4.0)
    area((2, -10, 10), (0, 3, 6), '#ffe8d0', 2500, 10)
    rockm = scan('Cliff', 'coast_land_rocks_01', tint='#c8d0e8', rough=0.75)
    wall = box('Cliff', rockm, (0, 4.2, 8), (34, 2.4, 30), (8, 0, 0), 0.3)
    kit.world_uvs(wall, 4)
    snow = mat('Snow', '#f6fbff', rough=0.55, sss=0.3)
    rnd = random.Random(5)
    for k in range(24):
        r = rock((rnd.uniform(-12, 12), 3.2, rnd.uniform(-3, 20)), rnd.uniform(0.9, 2.0), rockm, k, 0.6)
    terrain('SnowBase', snow, 80, 60, lambda x, y: 0.3 * math.sin(x * 0.5), 4, (0, 0, -1.5))
    for k in range(16):
        blob('Ledge', snow, (rnd.uniform(-8, 8), 3.0, rnd.uniform(-2, 18)), rnd.uniform(0.5, 1.0), (2.2, 0.8, 0.35), 0.2, k, 2)
    holds = [mat('HoldA', '#ff5a6e', rough=0.4), mat('HoldB', '#ffd23f', rough=0.4), mat('HoldC', '#3d8bff', rough=0.4)]
    for k in range(30):
        sphere('Hold', holds[k % 3], (rnd.uniform(-6, 6), 2.8, rnd.uniform(0, 16)), 0.22, (1, 0.6, 0.8), seg=10)
    rope = mat('ClimbRope', '#ffb43a', rough=0.7)
    for i, (x, z) in enumerate([(-3.0, 3.0), (-1.2, 6.5), (2.2, 4.2), (3.6, 8.0)]):
        alien((x, 2.6, z), 180, SHIRTS[i], 'swim', 1.0, (0, 0))
    kit.strut('Rope', (-3.0, 2.5, 4.6), (-1.2, 2.5, 8.0), 0.05, rope, 8)
    kit.strut('Rope', (2.2, 2.5, 5.8), (3.6, 2.5, 9.6), 0.05, rope, 8)
    cyl('FlagPole', mat('Pole', '#dfe6ee', rough=0.2, metal=1), (0.5, 3.4, 17), 0.08, 3.0)
    box('Flag', glow('Signal', '#ff5a3a', 3), (1.2, 3.4, 18.2), (1.4, 0.05, 0.9), bevel=0)
    specks('Blizzard', mat('Flake', '#ffffff', rough=0.5, emit=0.8), 400, ((-10, 10), (-6, 2), (-2, 18)), (0.03, 0.08), 6, 'ico')
    bloom(0.35, 1.0, 0.5)
    camera((2.0, -9.0, 3.5), (0, 2.6, 6.8), 32, (0, 2.6, 5), 6)
    render('frostyfreight')


@scene
def pelicanpilots():
    """Kite Coast Crew: one partner drives the boat, the other steers the kite."""
    day()
    sea, h = water(size=200, res=200, color='#28c8e0', deep='#0a5aa8')
    for i, (x, y, face, col) in enumerate([(-3.0, 0.5, -15, '#ff4d5e'), (4.0, 6.0, 15, '#3d8bff')]):
        boat((x, y, 0), face, col, 1.0, SHIRTS[i * 2])
        kx, ky, kz = x + (1.5 if i == 0 else -1.5), y + 4.5, 6.5 - i * 0.6
        canopy = mat('Kite' + col, col, rough=0.4, sss=0.1)
        sphere('Kite', canopy, (kx, ky, kz + 1.6), 2.0, (1.4, 0.5, 0.5), (0, 0, 0))
        sphere('KiteStripe', mat('KiteW', '#ffffff', rough=0.4), (kx, ky - 0.02, kz + 1.6), 2.02, (0.45, 0.52, 0.52))
        alien((kx, ky, kz - 0.9), 10, SHIRTS[i * 2 + 1], 'cheer', 0.9)
        kit.strut('Tow', (x, y + 1.2, 1.0), (kx, ky, kz), 0.03, mat('TowLine', '#ffffff', rough=0.5), 6)
    for k, (x, y, z) in enumerate([(-0.5, 7.5, 6.5), (1.0, 9.5, 7.2), (-2.5, 10.0, 5.6), (6.5, 11.0, 6.2)]):
        coin((x, y, z), 0.45, (90, 0, k * 25))
    crate = scan('Crate', 'brown_planks_05', tint='#e0b080', rough=0.7)
    for k, (x, y) in enumerate([(-6.0, 6.0), (1.0, 13.0)]):
        box('Crate', crate, (x, y, 0.3), (1.2, 1.2, 1.2), (0, 0, k * 30), 0.06)
    for i, (x, y, z, s) in enumerate([(-30, 90, 16, 3.2), (14, 95, 22, 4.0), (40, 80, 13, 2.6)]):
        cloud((x, y, z), s, i)
    bloom(0.4, 1.0, 0.6)
    camera((7.5, -9.0, 5.0), (0.5, 5.0, 3.6), 28, (0, 3, 3), 6)
    render('pelicanpilots')


@scene
def hotelhiccup():
    """Postcard Puzzle: swap and spin six pieces until the postcard is whole."""
    day(SKY_SUNSET, '#ffd8c8', 0.8, (50, 0, 160), 3.0, '#ffd8a8')
    sand_ground(90, '#ffe2b8')
    img_path = os.path.join(OUT, 'bumper.webp') if os.path.exists(os.path.join(OUT, 'bumper.webp')) else os.path.join(OUT, 'boulderbuffet.webp')
    pic = mat('Postcard', '#ffffff', rough=0.5)
    if os.path.exists(img_path):
        tex = pic.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(img_path)
        pic.node_tree.links.new(tex.outputs['Color'], pic.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    border = mat('CardBorder', '#fff8ec', rough=0.6)
    box('Easel', mat('Easel', '#8a5a34', rough=0.7), (0, 5.2, 2.6), (8.6, 0.3, 5.6), (-12, 0, 0), 0.1)
    for i in range(6):
        cx, cy = i % 3, i // 3
        off = [(0, 0, 0), (0.25, -0.5, 18), (0, 0, 0), (-0.2, -0.4, -90), (0, 0, 0), (0.3, -0.6, 180)][i]
        x = -2.6 + cx * 2.6 + off[0]
        z = 4.0 - cy * 2.4
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 4.9 + off[1], z))
        p = bpy.context.active_object
        p.scale = (2.5, 0.12, 2.3)
        p.data.materials.append(pic)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bm = bmesh.new()
        bm.from_mesh(p.data)
        uv = bm.loops.layers.uv.verify()
        for f in bm.faces:
            for l in f.loops:
                lx = l.vert.co.x / 2.5 + 0.5
                lz = l.vert.co.z / 2.3 + 0.5
                l[uv].uv = ((cx + lx) / 3, (1 - cy + lz) / 2)
        bm.to_mesh(p.data)
        bm.free()
        p.location.y -= 0.45
        p.rotation_euler = (math.radians(-12), math.radians(off[2]), 0)
        # Glowing border: green when the piece is placed right, pink when not.
        edge = box('Edge', glow('EdgeOk' if not off[2] else 'EdgeBad', '#7affb0' if not off[2] else '#ff6a8a', 3), (x, p.location.y + 0.08, z), (2.66, 0.08, 2.46), (-12, off[2], 0), 0.03)
    alien((-3.6, 0.6, 0), 20, SHIRTS[0], 'point')
    alien((3.8, 0.0, 0), -20, SHIRTS[1], 'cheer')
    alien((-0.8, -1.2, 0), 10, SHIRTS[2], 'throw')
    alien((1.6, 1.8, 0), -5, SHIRTS[3], 'idle')
    rnd = random.Random(2)
    for k in range(5):
        palm((-14 + k * 7, 14 + (k % 2) * 3, 0), rnd.uniform(6, 8), rnd.uniform(5, 15), rnd.uniform(-30, 30), k)
    bloom(0.4, 1.0, 0.6)
    camera((3.5, -9.5, 3.6), (0, 3.0, 2.6), 30, (0, 0, 2), 6)
    render('hotelhiccup')


@scene
def picklepatrol():
    """Signal Snap: match the beacon's shape and pop the right balloon first."""
    day(amb='#c8e8ff', strength=0.8)
    grass_ground(90, '#8ed46a')
    tower = mat('Tower', '#f4f0e8', rough=0.6)
    cyl('Tower', tower, (0, 12, 3), 1.2, 6)
    cyl('TowerTop', mat('TowerRed', '#ff4d5e', rough=0.4), (0, 12, 6.3), 1.6, 0.6)
    star = bpy.ops.mesh.primitive_circle_add(vertices=10, radius=1.4, fill_type='NGON', location=(0, 11.2, 8.4))
    s = bpy.context.active_object
    for j, v in enumerate(s.data.vertices):
        if j % 2:
            v.co *= 0.45
    s.rotation_euler = (math.radians(90), 0, math.radians(18))
    s.data.materials.append(glow('SignalStar', '#ffe24a', 8))
    sol = s.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.3
    shapes = [('#ff4d5e', 'star'), ('#3d8bff', 'ball'), ('#ffd23f', 'star'), ('#9a5aff', 'cube'), ('#2fb36d', 'ball')]
    rnd = random.Random(4)
    for k, (c, shape) in enumerate(shapes):
        x, y, z = -7 + k * 3.4, 8 + rnd.uniform(-1, 2), 3.5 + rnd.uniform(0, 2.5)
        sphere('Balloon', mat('Balloon' + c, c, rough=0.15, coat=1.0), (x, y, z), 0.9, (1, 1, 1.15))
        kit.strut('String', (x, y, z - 1.0), (x + 0.2, y, z - 3.4), 0.02, mat('String', '#ffffff'), 6)
    cannon = mat('Cannon', '#3a3f5a', rough=0.3, metal=0.7)
    for i, (x, y, face) in enumerate([(-4.0, 0.0, 20), (-1.4, -1.0, 8), (1.4, -1.0, -8), (4.0, 0.0, -20)]):
        alien((x, y, 0), face + 180 + 180, SHIRTS[i], 'point')
        cyl('Cannon', cannon, (x + 0.4, y + 0.9, 1.5), 0.25, 1.4, (-60, 0, face), 16)
    pop = glow('Pop', '#ffe27a', 5)
    for k in range(8):
        a = k / 8 * math.tau
        cone('Pop', pop, (6.6 + math.cos(a) * 1.2, 9.0, 5.0 + math.sin(a) * 1.2), 0.12, 0, 0.7, (0, math.degrees(-a) + 90, 0), 4)
    bloom(0.5, 1.0, 0.6)
    camera((0.5, -8.5, 3.4), (0, 8.0, 4.4), 28, (0, 0, 1.4), 6)
    render('picklepatrol')


@scene
def mangosluggers():
    """Tap Launch: mash for speed, then fly into the sand pit."""
    day(SKY_SUNSET, '#ffd8b0', 0.8, (40, 0, 120), 3.2, '#ffd2a0')
    grass_ground(100, '#8ed46a')
    track = mat('Track', '#e8603a', rough=0.7)
    box('Runway', track, (-6, 0, 0.02), (14, 2.6, 0.06), bevel=0)
    for k in range(-1, 2, 2):
        box('Lane', mat('LaneLine', '#ffffff', rough=0.6), (-6, k * 1.2, 0.06), (14, 0.08, 0.02), bevel=0)
    box('Board', mat('TakeOff', '#ffffff', rough=0.5), (1.1, 0, 0.07), (0.5, 2.6, 0.04), bevel=0)
    pit = sand_ground(1, '#ffe2b0')
    pit.hide_render = True
    sandm = scan('Sand', 'coast_sand_01', tint='#ffe2b0', rough=0.9)
    p = box('Pit', sandm, (8, 0, 0.0), (12, 4, 0.2), bevel=0.1)
    kit.world_uvs(p, 3)
    for k in range(5):
        x = 4 + k * 2
        box('Marker', mat('Marker', '#ffffff', rough=0.5), (x, 2.4, 0.4), (0.1, 0.1, 0.8), bevel=0)
        box('MarkerFlag', mat('MarkerFlag', ['#ff4d5e', '#ffd23f', '#2fb36d', '#3d8bff', '#9a5aff'][k], rough=0.5), (x + 0.3, 2.4, 0.7), (0.5, 0.05, 0.35), bevel=0)
    alien((6.0, 0, 3.4), -90, SHIRTS[0], 'hop', 1.0, (-40, 0))
    trail = mat('JumpTrail', '#fff2a8', rough=0.5, emit=1.2, alpha=0.6)
    pts = [(1.1 + t * 4.9, 0, 0.8 + math.sin(t * math.pi * 0.62) * 3.3) for t in (0, 0.2, 0.4, 0.6, 0.8, 0.95)]
    for j, (x, y, z) in enumerate(pts):
        sphere('Arc', trail, (x, y, z + 0.6), 0.22 - j * 0.02, seg=10)
    alien((-5.5, -0.6, 0), 60, SHIRTS[1], 'cheer')
    alien((-7.5, 0.6, 0), 40, SHIRTS[2], 'run')
    alien((10.5, -2.8, 0), -40, SHIRTS[3], 'wave')
    # Mango tree.
    cyl('MangoTrunk', mat('Bark', '#6a4428', rough=0.8), (-2, 7, 2), 0.5, 4)
    blob('MangoCanopy', mat('MangoLeaf', '#2f9a48', rough=0.6), (-2, 7, 5.2), 3.0, (1.2, 1.1, 0.9), 0.3, 1, 3)
    rnd = random.Random(1)
    for k in range(10):
        sphere('Mango', mat('Mango', '#ffb43a', rough=0.4, coat=0.4), (-2 + rnd.uniform(-2.4, 2.4), 7 + rnd.uniform(-2.6, -1.2), 4.4 + rnd.uniform(-0.8, 1.6)), 0.3, (1, 0.8, 1.2), seg=12)
    specks('Sand', sandm, 60, ((5, 9), (-1.5, 1.5), (0.2, 1.0)), (0.04, 0.1), 3, 'ico')
    bloom(0.4, 1.0, 0.6)
    camera((3.0, -11.0, 3.2), (3.4, 0.5, 2.0), 30, (6, 0, 3), 6)
    render('mangosluggers')


@scene
def geckograffiti():
    """Relic Rendezvous: two teams race through the hedge maze to the shrine."""
    day(amb='#c8f0d0', strength=0.8)
    grass_ground(100, '#86c95a')
    hedge = mat('Hedge', '#2f8a3a', rough=0.75, sss=0.1)
    walls = [(-6, -2, 0, 8), (-6, 6, 0, 8), (6, -2, 0, 8), (6, 6, 0, 8), (-2, -4, 90, 6), (2, 8, 90, 6), (-9, 2, 90, 6), (9, 2, 90, 6), (-3, 2, 0, 3), (3, 2, 0, 3)]
    for x, y, rot, ln in walls:
        b = box('Hedge', hedge, (x, y, 0.9), (ln if rot == 0 else 1.0, 1.0 if rot == 0 else ln, 1.8), bevel=0.25)
        if rot == 90:
            b.scale = (1, 1, 1)
    stone = scan('Shrine', 'white_sandstone_bricks', tint='#f0e0c0', rough=0.6)
    cyl('Shrine', stone, (0, 2, 0.4), 1.6, 0.8, verts=8)
    cyl('ShrineTop', stone, (0, 2, 0.9), 1.2, 0.3, verts=8)
    sphere('ShrineGlow', glow('ShrineGlow', '#7affea', 4), (0, 2, 1.6), 0.45)
    lamp((0, 2, 2), '#7affea', 600, 0.5)
    relic = mat('Relic', '#ffc93a', rough=0.15, metal=1.0)
    for x, y in ((-7.5, 8.5), (7.5, -3.8)):
        cone('Relic', relic, (x, y, 0.9), 0.4, 0.05, 1.0, (0, 0, 0), 6)
        torus('RelicGlow', glow('RelicGlow', '#ffe27a', 3), (x, y, 0.15), 0.8, 0.05)
    alien((-4.0, 4.2, 0), 30, SHIRTS[0], 'run')
    cone('Carried', relic, (-4.3, 4.0, 2.9), 0.32, 0.05, 0.8)
    alien((-2.0, 0.0, 0), 50, SHIRTS[1], 'cheer')
    alien((4.0, 0.2, 0), -30, SHIRTS[2], 'run')
    alien((2.0, 5.2, 0), -10, SHIRTS[3], 'point')
    rnd = random.Random(5)
    for k in range(6):
        a = math.radians(20 + k * 28)
        palm((math.cos(a) * 15, 4 + math.sin(a) * 12, 0), rnd.uniform(6, 8), rnd.uniform(5, 15), rnd.uniform(-30, 30), k)
    bloom(0.4, 1.0, 0.6)
    camera((6.0, -10.0, 9.0), (0, 2.6, 0.4), 28, (0, 2, 1), 7)
    render('geckograffiti')


@scene
def skewergallery():
    """Beacon Keepers: one alien guards the beacon; three try to soak it."""
    day(SKY_SUNSET, '#ffd0c0', 0.75, (40, 0, 150), 3.0, '#ffd2a8')
    sea, h = water(size=160, res=140, color='#2ab8d8', deep='#1a3a8a')
    stone = scan('Stone', 'white_sandstone_bricks', tint='#f0d8c0', rough=0.6)
    plat = cyl('Plaza', stone, (0, 2, 0.0), 7.0, 0.8, verts=64)
    kit.world_uvs(plat, 2)
    for k in range(6):
        a = k / 6 * math.tau + 0.3
        c = cyl('Column', stone, (math.cos(a) * 4.6, 2 + math.sin(a) * 4.6, 1.6), 0.45, 2.6, verts=16)
        kit.world_uvs(c, 1.5)
    alien((0.0, 2.6, 0.4), 15, SHIRTS[3], 'cheer')
    cyl('Lantern', mat('Brass', '#ffc93a', rough=0.2, metal=1.0), (0.7, 2.4, 2.9), 0.28, 0.5)
    sphere('BeaconLight', glow('Beacon', '#ffe27a', 12), (0.7, 2.4, 3.35), 0.35)
    lamp((0.7, 2.4, 3.6), '#ffd27a', 900, 0.4)
    jet = mat('Jet', '#bff4ff', rough=0.1, alpha=0.7, emit=0.4)
    rnd = random.Random(3)
    for i, (x, y, face) in enumerate([(-4.8, -1.0, -50), (4.6, -0.6, 50), (3.4, 6.4, 140)]):
        alien((x, y, 0.4), face, SHIRTS[i], 'point')
        d = Vector((0.7 - x, 2.4 - y, 0)).normalized()
        for k in range(14):
            t = k / 13
            p = Vector((x, y, 1.6)) + d * t * 4.0
            p.z += math.sin(t * math.pi) * 1.2
            sphere('Jet', jet, p, 0.18 + t * 0.12, seg=10)
    specks('Spray', mat('Spray', '#ffffff', rough=0.2, emit=0.4), 120, ((-2, 3), (0, 5), (1.5, 4)), (0.03, 0.08), 5, 'ico')
    for i, (x, y, r) in enumerate([(-20, 30, 6), (24, 36, 8)]):
        blob('Isle', scan('Sand', 'coast_sand_01', tint='#ffe2b0', rough=0.9), (x, y, -1), r, (1, 0.8, 0.3), 0.2, i, 3)
        cyl('Lighthouse', mat('LH', '#ffffff', rough=0.5), (x, y, 4), 1.0, 8)
        sphere('LHLight', glow('LHLight', '#ffe27a', 8), (x, y, 8.6), 0.8)
    bloom(0.6, 0.95, 0.7)
    camera((6.5, -9.0, 5.0), (0, 2.6, 1.6), 28, (0, 1, 2), 6)
    render('skewergallery')


@scene
def returnsender():
    """Parcel Panic: flip the switches and send parcels back at the other depot."""
    day(amb='#d8e0ff', strength=0.8)
    floor = scan('Concrete', 'concrete_panels', tint='#c8d0e8', rough=0.6)
    f = box('Floor', floor, (0, 4, -0.1), (24, 18, 0.2), bevel=0)
    kit.world_uvs(f, 4)
    belt = mat('Belt', '#2a2a3a', rough=0.6)
    yellow = mat('Hazard', '#ffd23f', rough=0.4)
    cardboard = mat('Cardboard', '#d8a46a', rough=0.8)
    tape = mat('Tape', '#b07a40', rough=0.5)
    rnd = random.Random(2)
    for k in range(6):
        x = -6.25 + k * 2.5
        box('Lane', belt, (x, 4, 0.4), (1.6, 12, 0.3), bevel=0.05)
        box('LaneEdge', yellow, (x - 0.86, 4, 0.5), (0.12, 12, 0.2), bevel=0)
        y = rnd.uniform(0, 8)
        box('Parcel', cardboard, (x, y, 1.05), (1.1, 1.0, 0.9), (0, 0, rnd.uniform(-10, 10)), 0.05)
        box('Tape', tape, (x, y, 1.51), (0.25, 1.02, 0.02), (0, 0, 0), 0)
        cyl('Switch', glow('Switch', '#7affb0' if k % 2 else '#ff6a8a', 3), (x + 0.0, -2.8, 0.35), 0.35, 0.3)
        cone('Arrow', glow('ArrowG', '#ffffff', 2), (x, y + (0.9 if k % 2 else -0.9), 0.62), 0.3, 0.0, 0.5, (90 if k % 2 else -90, 0, 0), 3)
    for y, c in ((-3.8, '#3d8bff'), (11.8, '#ff4d5e')):
        box('Depot', mat('Depot' + c, c, rough=0.4, coat=0.4), (0, y, 1.6), (16, 1.6, 3.2), bevel=0.2)
        for k in range(10):
            sphere('Shield', glow('Shield' + c, '#ffffff', 2), (-6.75 + k * 1.5, y - 0.85 if y < 0 else y - 0.85, 2.4), 0.25, (1, 0.3, 1.2), seg=12)
    alien((-3.8, -2.2, 0), 60, SHIRTS[0], 'point')
    alien((1.2, -2.0, 0), 40, SHIRTS[1], 'run')
    alien((-1.0, 10.0, 0), 150, SHIRTS[2], 'cheer')
    alien((4.6, 10.2, 0), 120, SHIRTS[3], 'run')
    lamp((0, 4, 8), '#ffffff', 2000, 6)
    bloom(0.4, 1.0, 0.6)
    camera((13.0, -5.5, 7.5), (0, 4.2, 0.6), 28, (2, 4, 1), 7)
    render('returnsender')


def cheer_cutout(name, shirt, pose, face, tilt):
    """Transparent close-up of a cheering crew alien for the vote stage corners."""
    begin()
    scene = bpy.context.scene
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = scene.render.resolution_y = 520
    ambient('#c8d8ff', 0.9)
    sun((50, 10, 200), '#fff2e0', 3.6, 3)
    area((-4, -5, 4), (0, 0, 1.6), '#ffe2c8', 500, 4)
    area((4, 3, 3), (0, 0, 1.6), '#9ab8ff', 700, 4)  # rim
    alien((0, 0, 0), face, shirt, pose, 1.0, tilt, mouth='smile')
    camera((0.0, -4.6, 1.75), (0, 0, 1.55), 50)
    bloom(0.2, 1.2, 0.4)
    render(name)
    scene.render.image_settings.color_mode = 'RGB'


@scene
def crew():
    cheer_cutout('crew-left', SHIRTS[0], 'wave', 25, (0, -8))
    cheer_cutout('crew-right', SHIRTS[1], 'cheer', -25, (0, 8))


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = argv or list(SCENES)
    for n in names:
        if n not in SCENES:
            print('NO SCENE', n)
            continue
        SCENES[n]()


main()
