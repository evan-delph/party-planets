"""Nabbit, the space raccoon who runs the steal stop.

Run headless from the project root:
  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/nabbit.py
Writes public/models/nabbit.glb and art/renders/nabbit-*.png.

Built from smooth primitives with an inverted-hull ink outline, so the 3D
figure matches the sticker-style HUD portrait in game/art.tsx. Facing -Y in
Blender, which becomes +Z (toward the board camera) in three.js.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GLB = os.path.join(ROOT, 'public', 'models', 'nabbit.glb')
RENDERS = os.path.join(ROOT, 'art', 'renders')
FPS = 24
LOOP = 48  # two-second idle loop
OUTLINE = 0.022

# ── Scene ────────────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, LOOP


def hex_rgba(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


_materials = {}


def material(name, color, rough=0.6, emit=0.0):
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = rough
    if emit:
        bsdf.inputs['Emission Color'].default_value = hex_rgba(color)
        bsdf.inputs['Emission Strength'].default_value = emit
    m.use_backface_culling = True
    _materials[name] = m
    return m


INK = material('Ink', '#1b2440', rough=1.0)
FUR = material('Fur', '#b6abd6')
FUR_DARK = material('FurDark', '#8f82b3')
CREAM = material('Cream', '#efeaff')
MASK = material('Mask', '#3a2f55', rough=0.5)
PINK = material('Pink', '#f2a3c7')
WHITE = material('EyeWhite', '#ffffff', rough=0.25)
BLACK = material('Pupil', '#141a2e', rough=0.2)
GOLD = material('Gold', '#ffcf3d', rough=0.3, emit=0.15)
SACK = material('Sack', '#c9965c', rough=0.8)
SACK_DARK = material('SackTie', '#8a5f34', rough=0.8)
STAR = material('Star', '#ffd23f', rough=0.3, emit=0.6)


def finish(obj, mat, smooth=True, subdiv=1, outline=True):
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if subdiv:
        sub = obj.modifiers.new('Subdivision', 'SUBSURF')
        sub.levels = sub.render_levels = subdiv
    if outline:
        # Inverted hull: an outward shell with flipped normals, culled from the front.
        obj.data.materials.append(INK)
        shell = obj.modifiers.new('Outline', 'SOLIDIFY')
        shell.thickness = OUTLINE
        shell.offset = 1.0
        shell.use_flip_normals = True
        shell.use_rim = False
        shell.material_offset = 1
    return obj


def blob(name, loc, scale, mat, parent=None, rot=(0, 0, 0), outline=True, segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = [math.radians(a) for a in rot]
    finish(obj, mat, subdiv=0 if segments >= 16 else 1, outline=outline)
    if parent:
        attach(obj, parent)
    return obj


def capsule(name, start, end, radius, mat, parent=None):
    start, end = Vector(start), Vector(end)
    axis = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=axis.length, location=(start + end) / 2)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(axis.normalized())
    finish(obj, mat, subdiv=0)
    for i, at in enumerate((start, end)):
        cap = blob(f'{name}Cap{i}', at, (radius,) * 3, mat, segments=16)
        cap.parent = None
        attach(cap, parent) if parent else None
    if parent:
        attach(obj, parent)
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.location = loc
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def attach(obj, parent):
    # matrix_world is stale until the depsgraph updates after scale/rotation edits.
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def star_mesh(name, loc, outer=0.075, inner=0.032, depth=0.03):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    ring = []
    for i in range(10):
        r = outer if i % 2 == 0 else inner
        a = math.pi / 2 + i * math.pi / 5
        ring.append(bm.verts.new((math.cos(a) * r, 0, math.sin(a) * r)))
    face = bm.faces.new(ring)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in ext['geom']:
        if isinstance(v, bmesh.types.BMVert):
            v.co.y += depth
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, -depth / 2, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    scene.collection.objects.link(obj)
    finish(obj, STAR, smooth=False, subdiv=0)
    return obj


# ── Rig of empties (animated nodes survive glTF export as plain transforms) ──
root = empty('Nabbit')
body = empty('Body', (0, 0, 0), root)
head = empty('Head', (0, 0, 0.78), body)
tail = empty('Tail', (0, 0.22, 0.32), body)
sack_pivot = empty('SackPivot', (0.3, 0.05, 0.92), body)
antenna = empty('Antenna', (0.02, 0, 1.36), head)

# Feet and body
for side in (-1, 1):
    blob(f'Foot{side}', (side * 0.13, -0.06, 0.05), (0.11, 0.15, 0.06), MASK, body)
blob('Torso', (0, 0, 0.4), (0.29, 0.26, 0.33), FUR, body, segments=36)
blob('Belly', (0, -0.11, 0.38), (0.2, 0.17, 0.24), CREAM, body, segments=28)

# Head
blob('Skull', (0, 0, 0.98), (0.42, 0.37, 0.36), FUR, head, segments=40)
blob('Cheeks', (0, -0.08, 0.87), (0.4, 0.3, 0.2), FUR, head, segments=32)
blob('Muzzle', (0, -0.27, 0.9), (0.19, 0.13, 0.12), CREAM, head, segments=28)
blob('Mask', (0, -0.17, 1.02), (0.41, 0.24, 0.115), MASK, head, segments=32)
for side in (-1, 1):
    blob(f'Eye{side}', (side * 0.14, -0.33, 1.03), (0.085, 0.055, 0.09), WHITE, head, outline=False)
    blob(f'Pupil{side}', (side * 0.128, -0.38, 1.035), (0.046, 0.02, 0.05), BLACK, head, outline=False)
    blob(f'Glint{side}', (side * 0.114, -0.4, 1.06), (0.016, 0.01, 0.016), WHITE, head, outline=False, segments=12)
    ear = blob(f'Ear{side}', (side * 0.29, 0.03, 1.3), (0.13, 0.05, 0.13), FUR_DARK, head, rot=(0, side * -28, 0))
    blob(f'EarInner{side}', (side * 0.285, -0.015, 1.295), (0.078, 0.025, 0.078), PINK, head, rot=(0, side * -28, 0), outline=False)
    blob(f'Brow{side}', (side * 0.15, -0.31, 1.15), (0.07, 0.02, 0.018), MASK, head, rot=(0, side * 14, 0), outline=False)
blob('Nose', (0, -0.395, 0.945), (0.05, 0.035, 0.034), BLACK, head)
# Sly lopsided grin: the lower arc of a thin torus, tipped up on one side.
bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.014, major_segments=40, minor_segments=8,
                                 location=(0.012, -0.372, 0.9), rotation=(math.radians(90), math.radians(-8), 0))
grin = bpy.context.active_object
grin.name = 'Grin'
bm = bmesh.new()
bm.from_mesh(grin.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.02], context='VERTS')
bm.to_mesh(grin.data)
bm.free()
finish(grin, MASK, subdiv=0, outline=False)
attach(grin, head)
blob('Tooth', (0.035, -0.378, 0.835), (0.022, 0.012, 0.02), WHITE, head, outline=False, segments=12)

# Alien antenna with a star
capsule('AntennaStalk', (0.02, 0, 1.32), (0.05, 0.0, 1.56), 0.013, MASK, antenna)
star = star_mesh('AntennaStar', (0.055, 0, 1.62))
attach(star, antenna)

# Arms: right hand up on the sack, left hand flipping a coin in front
capsule('ArmRight', (0.27, -0.02, 0.6), (0.3, 0.02, 0.88), 0.065, FUR, body)
blob('HandRight', (0.3, 0.02, 0.9), (0.075, 0.075, 0.075), MASK, body)
capsule('ArmLeft', (-0.27, -0.04, 0.58), (-0.3, -0.24, 0.5), 0.065, FUR, body)
blob('HandLeft', (-0.3, -0.27, 0.5), (0.075, 0.075, 0.075), MASK, body)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.075, depth=0.02, location=(-0.3, -0.36, 0.58), rotation=(math.radians(90), 0, 0))
coin = bpy.context.active_object
coin.name = 'Coin'
finish(coin, GOLD, subdiv=0)
attach(coin, body)

# Loot sack over the right shoulder
blob('Sack', (0.4, 0.16, 1.02), (0.26, 0.24, 0.29), SACK, sack_pivot, rot=(14, -18, 0), segments=32)
blob('SackNeck', (0.31, 0.0, 0.9), (0.085, 0.085, 0.075), SACK_DARK, sack_pivot)
blob('SackTuft', (0.27, -0.04, 0.84), (0.07, 0.05, 0.06), SACK, sack_pivot, rot=(0, 30, 0))
for i, (dx, dz) in enumerate(((-0.11, 0.14), (0.0, 0.2), (0.12, 0.13))):
    blob(f'SackPatch{i}', (0.42 + dx, -0.05, 1.0 + dz - 0.12), (0.05, 0.02, 0.05), SACK_DARK, sack_pivot, outline=False, segments=12)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.085, depth=0.02, location=(0.46, -0.085, 1.0), rotation=(math.radians(90), 0, math.radians(-14)))
emblem = bpy.context.active_object
emblem.name = 'SackCoin'
finish(emblem, GOLD, subdiv=0)
attach(emblem, sack_pivot)

# Bushy ringed tail curling up behind
for i in range(7):
    t = i / 6
    r = 0.13 - 0.03 * t
    loc = (0.06 * math.sin(t * 2.5), 0.24 + 0.32 * t, 0.26 + 0.62 * t ** 1.25)
    blob(f'TailRing{i}', loc, (r, r * 0.95, r * 0.85), MASK if i % 2 else FUR, tail)

# ── Idle animation: bob, sneaky glances, tail swish, spinning star ──────────
def key(obj, path, frames):
    for frame, value in frames:
        setattr(obj, path, value)
        obj.keyframe_insert(data_path=path, frame=frame)


key(body, 'location', [(1, (0, 0, 0)), (13, (0, 0, 0.035)), (25, (0, 0, 0)), (37, (0, 0, 0.035)), (49, (0, 0, 0))])
key(body, 'scale', [(1, (1.03, 1.03, 0.96)), (13, (0.99, 0.99, 1.02)), (25, (1.03, 1.03, 0.96)), (37, (0.99, 0.99, 1.02)), (49, (1.03, 1.03, 0.96))])
key(head, 'rotation_euler', [(1, (0, 0, math.radians(-12))), (20, (0, math.radians(5), math.radians(12))), (34, (0, math.radians(-4), math.radians(10))), (49, (0, 0, math.radians(-12)))])
key(tail, 'rotation_euler', [(1, (math.radians(-6), 0, math.radians(-10))), (25, (math.radians(6), 0, math.radians(10))), (49, (math.radians(-6), 0, math.radians(-10)))])
key(sack_pivot, 'rotation_euler', [(1, (0, math.radians(-3), 0)), (25, (0, math.radians(4), 0)), (49, (0, math.radians(-3), 0))])
key(antenna, 'rotation_euler', [(1, (0, math.radians(-8), 0)), (13, (0, math.radians(8), 0)), (25, (0, math.radians(-8), 0)), (37, (0, math.radians(8), 0)), (49, (0, math.radians(-8), 0))])
key(star, 'rotation_euler', [(1, (0, 0, 0)), (49, (0, 0, math.radians(360)))])
for obj in bpy.data.objects:
    ad = obj.animation_data
    if ad and ad.action:
        ad.action.name = 'Idle_' + obj.name
        for fc in getattr(ad.action, 'fcurves', []):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER' if obj is not star else 'LINEAR'

# ── Merge each animated group into one mesh (far fewer draw calls) ──────────
bpy.context.view_layer.update()
for pivot in (body, head, tail, sack_pivot, antenna):
    parts = [o for o in pivot.children if o.type == 'MESH']
    if pivot is antenna:
        parts = [o for o in parts if o is not star]
    if not parts:
        continue
    for o in parts:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts[0].name = pivot.name + 'Mesh'
    parts[0].data.name = pivot.name + 'Mesh'

# ── Export ──────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(GLB), exist_ok=True)
for obj in bpy.data.objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=GLB,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_animations=True,
    export_animation_mode='ACTIVE_ACTIONS',
    export_yup=True,
)
print('EXPORTED', GLB, os.path.getsize(GLB), 'bytes')

# ── Preview renders ─────────────────────────────────────────────────────────
world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = hex_rgba('#cfeaff')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'AREA'))
fill.data.energy = 120
fill.data.size = 3
fill.location = (2.2, -2.4, 1.6)
fill.rotation_euler = (math.radians(70), 0, math.radians(42))
scene.collection.objects.link(fill)
bpy.ops.mesh.primitive_circle_add(vertices=48, radius=0.75, fill_type='NGON', location=(0, 0, 0))
ground = bpy.context.active_object
ground.data.materials.append(material('Pad', '#c68cef', rough=0.7))
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
cam.data.lens = 60
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.resolution_x = scene.render.resolution_y = 900
scene.render.film_transparent = False
engine_set = False
for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = engine
        engine_set = True
        break
    except TypeError:
        pass
if not engine_set or '--cycles' in sys.argv:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.device = 'CPU'
os.makedirs(RENDERS, exist_ok=True)
for label, (x, y, z), frame in (('front', (1.1, -3.4, 1.45), 1), ('side', (-3.2, -1.6, 1.5), 20)):
    cam.location = (x, y, z)
    target = Vector((0, 0, 0.72))
    cam.rotation_euler = (target - Vector((x, y, z))).to_track_quat('-Z', 'Y').to_euler()
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(RENDERS, f'nabbit-{label}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
