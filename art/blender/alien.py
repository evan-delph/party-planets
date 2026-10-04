"""The crew alien with every Character Studio option (public/models/alien.glb).

  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/alien.py

Authored in three.js coordinates (Y up, face toward +Z) to match game/avatar.ts,
then converted to Blender axes by `place`. Animation stays code-driven: the
nodes Arm0/Arm1 (shoulders) and Leg0/Leg1 (hips) are rigid joints, Eye0/Eye1 and
Lid0/Lid1 blink, and Face holds the mouth shapes. Option parts are named nodes
toggled per avatar: Hair1–7, Beard1–2, Acc1–6, Collar, Placket, Stripes, Dots,
Overalls, Aloha, Freckles, Hand*/Glove*. Recolorable materials: Shirt,
ShirtSeam, ShirtThread, Hair, Eye, Shoe.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import kit  # noqa: E402

kit.reset()
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()


def place(obj, pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """Set an object's world transform from three.js-space position/rotation/scale."""
    m = Matrix.Translation(pos) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))
    obj.matrix_world = C @ m @ CI
    return obj


def B(p):
    return Vector((p[0], -p[2], p[1]))


# ── Materials ───────────────────────────────────────────────────────────────
def skin_material(name, color, rough=0.52):
    m = kit.flat(name, color, rough=rough)
    bsdf = m.node_tree.nodes['Principled BSDF']
    for key, value in (('Sheen Weight', 0.35), ('Sheen Roughness', 0.4)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    return m


SKIN = skin_material('Skin', '#86da62')
SHADE = skin_material('SkinShade', '#66b84e')
LID = skin_material('Lid', '#65b849')
NOSE = skin_material('NoseSkin', '#75c454')
CHEEK = kit.flat('Cheek', '#b1e873', rough=0.6)
FRECKLE = kit.flat('Freckle', '#437e46', rough=0.7)
SHIRT = kit.scanned('Shirt', 'denim_fabric', flat_color='#12ad9a', metal=0.0)
SEAM = kit.flat('ShirtSeam', '#16858a', rough=0.8)
THREAD = kit.flat('ShirtThread', '#9fded1', rough=0.75)
CREAM = kit.flat('Cream', '#fff2be', rough=0.7)
BUTTON = kit.flat('Button', '#fefbf0', rough=0.3)
HAIR = kit.flat('Hair', '#603821', rough=0.42)
EYE = kit.flat('Eye', '#071219', rough=0.06)
GLINT = kit.flat('Glint', '#e6fffb', rough=0.2, emit=0.6)
GLINT2 = kit.flat('Glint2', '#a4d6e2', rough=0.2, emit=0.3)
MOUTH = kit.flat('Mouth', '#173b30', rough=0.6)
TEETH = kit.flat('Teeth', '#fffde2', rough=0.25)
TONGUE = kit.flat('Tongue', '#e48490', rough=0.5)
SHOE = kit.scanned('Shoe', 'fabric_leather_02', flat_color='#183e47', metal=0.0)
SOLE = kit.flat('Sole', '#e4edcf', rough=0.8)
LACE = kit.flat('Lace', '#fff9dd', rough=0.8)
GLOVE = kit.scanned('Glove', 'fabric_leather_02', flat_color='#f7f1d9', metal=0.0)
CUFF = kit.flat('GloveCuff', '#d4e3c6', rough=0.7)
STRIPE = kit.flat('Stripe', '#fff3d1', rough=0.8)
DOT = kit.flat('Dot', '#ffea88', rough=0.7)
DENIM = kit.scanned('Denim', 'denim_fabric', metal=0.0)
BRASS = kit.flat('Brass', '#d6a84a', rough=0.3, metal=1.0)
PETAL_A = kit.flat('PetalGold', '#ffdc74', rough=0.6)
PETAL_B = kit.flat('PetalCream', '#fff8df', rough=0.6)
BLOOM = kit.flat('Bloom', '#ef877e', rough=0.6)
LEAF = kit.flat('Leaf', '#255f58', rough=0.6)
GOLD = kit.flat('Gold', '#f2cd65', rough=0.22, metal=1.0)
LENS = kit.flat('Lens', '#bfe9ff', rough=0.05, alpha=0.25)
PINK = kit.flat('FlowerPink', '#ff79a7', rough=0.5)
YELLOW = kit.flat('FlowerYellow', '#ffe166', rough=0.5)
FLOAT = kit.flat('PoolFloat', '#fa718c', rough=0.25)
PHONE = kit.flat('Headphone', '#a4dcf0', rough=0.3)
BAND = kit.flat('HeadphoneBand', '#294f6f', rough=0.4)
PACK = kit.scanned('Backpack', 'fabric_leather_02', flat_color='#a683d2', metal=0.0)
STRAW = kit.flat('Straw', '#f7e0a0', rough=0.85)
STRAW_DARK = kit.flat('StrawDark', '#e0af66', rough=0.85)
GEM = kit.flat('Gem', '#ff5a8a', rough=0.1, emit=0.3)


# ── Primitive builders (three.js space) ─────────────────────────────────────
def sphere(name, mat, pos, scale=(1, 1, 1), rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(4, seg // 2), radius=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    kit.smooth(obj, 80)
    return place(obj, pos, rot, scale)


def cylinder(name, mat, pos, r_top, r_bottom, height, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r_bottom, radius2=r_top, depth=height)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    kit.smooth(obj, 50)
    return place(obj, pos, rot)


def cone(name, mat, pos, radius, height, rot=(0, 0, 0), seg=16):
    return cylinder(name, mat, pos, 0.0, radius, height, rot, seg)


def box(name, mat, pos, size, rot=(0, 0, 0), bevel=0.25):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = min(size) * bevel
        mod.segments = 3
    return place(obj, pos, rot, size)


def torus(name, mat, pos, major, minor, rot=(0, 0, 0), arc=None, seg=48, scale=(1, 1, 1)):
    """Ring lying in the XZ plane (horizontal); arc keeps the +Y-side half when rotated upright."""
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg, minor_segments=10)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    if arc == 'half':
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -1e-4], context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()
    kit.smooth(obj, 80)
    return place(obj, pos, rot, scale)


def skin_tube(name, mat, points, radii, edges=None, subdiv=2):
    """Organic limb/hand from a stick skeleton via Blender's Skin modifier."""
    mesh = bpy.data.meshes.new(name)
    edges = edges or [(i, i + 1) for i in range(len(points) - 1)]
    mesh.from_pydata([B(p) for p in points], edges, [])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new('Skin', 'SKIN')
    for i, r in enumerate(radii):
        obj.data.skin_vertices[0].data[i].radius = (r, r)
    obj.data.skin_vertices[0].data[0].use_root = True
    sub = obj.modifiers.new('Subdivision', 'SUBSURF')
    sub.levels = sub.render_levels = subdiv
    obj.data.materials.append(mat)
    kit.apply_all(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def lathe(name, mat, profile, steps=64, subdiv=1, close_top=True):
    obj = kit.lathe(name, profile, steps=steps, close_top=close_top)
    obj.data.materials.append(mat)
    if subdiv:
        sub = obj.modifiers.new('Subdivision', 'SUBSURF')
        sub.levels = subdiv
    kit.smooth(obj, 80)
    return obj


def empty(name, pos, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    place(obj, pos)
    if parent:
        kit.parent(obj, parent)
    return obj


def group(name, objects, parent):
    """Join parts into one node (multi-material) and attach it to a parent."""
    obj = kit.join(objects, name)
    kit.parent(obj, parent)
    return obj


root = empty('Alien', (0, 0, 0))

# ── Head: one sculpted shape — wide cranium tapering to a narrow chin ───────
bpy.ops.mesh.primitive_uv_sphere_add(segments=44, ring_count=28, radius=0.46)
head = bpy.context.active_object
head.name = 'Head'
for v in head.data.vertices:
    side, front, up = v.co.x, -v.co.y, v.co.z
    t = up / 0.46
    k = max(0.0, -t) ** 1.6
    side *= 1.1 * (1 - 0.4 * k)
    front *= 0.91 * (1 - 0.22 * k) * (0.97 if front > 0 else 1.0)
    up *= 1.14 + 0.12 * k
    # Gentle temple hollows and a brow ridge give the face structure.
    if front > 0.15 and 0.05 < t < 0.4:
        front *= 1.0 + 0.03 * math.sin((t - 0.05) / 0.35 * math.pi)
    v.co = (side, -front, up)
head.data.materials.append(SKIN)
kit.smooth(head, 80)
place(head, (0, 1.76, 0))
body_parts = [head]
for side in (-1, 1):
    body_parts.append(sphere(f'Ear{side}', SKIN, (side * 0.475, 1.785, -0.01), (0.105, 0.184, 0.061), (0, 0, side * -0.36), seg=16))
    body_parts.append(sphere(f'EarIn{side}', SHADE, (side * 0.497, 1.79, 0.034), (0.06, 0.115, 0.017), (0, 0, side * -0.36), seg=12))
    body_parts.append(sphere(f'Cheek{side}', CHEEK, (side * 0.22, 1.5, 0.296), (0.06, 0.03, 0.012), seg=12))
torso = lathe('Torso', SKIN, [(0.0, 0.66), (0.2, 0.67), (0.235, 0.75), (0.245, 0.9), (0.24, 1.04), (0.225, 1.12),
                              (0.17, 1.22), (0.13, 1.3), (0.125, 1.38), (0.15, 1.46), (0.0, 1.47)])
body_parts.append(torso)
for side in (-1, 1):
    body_parts.append(sphere(f'Shoulder{side}', SKIN, (side * 0.27, 1.1, 0), (0.085, 0.085, 0.085), seg=14))
body = group('Body', body_parts, root)

# ── Shirt: cloth shell with wrinkles, rolled hem and sleeve caps ───────────
shirt = lathe('ShirtShell', SHIRT, [(0.252, 0.715), (0.262, 0.74), (0.27, 0.8), (0.279, 0.93), (0.273, 1.05),
                                     (0.251, 1.12), (0.205, 1.18), (0.165, 1.215)], steps=40, subdiv=1, close_top=False)
noise = bpy.data.textures.new('Wrinkles', 'CLOUDS')
noise.noise_scale = 0.07
disp = shirt.modifiers.new('Wrinkles', 'DISPLACE')
disp.texture = noise
disp.strength = 0.011
disp.mid_level = 0.5
solid = shirt.modifiers.new('Thickness', 'SOLIDIFY')
solid.thickness = 0.008
shirt_parts = [shirt, torus('Hem', SEAM, (0, 0.737, 0), 0.256, 0.013, seg=32),
               torus('HemStitch', THREAD, (0, 0.754, 0), 0.266, 0.004, seg=32)]
for side in (-1, 1):
    shirt_parts.append(sphere(f'SleeveCap{side}', SHIRT, (side * 0.27, 1.1, 0), (0.1, 0.098, 0.1), seg=16))
group('Shirt', shirt_parts, root)

# Option overlays for the five patterns.
collar = []
for side in (-1, 1):
    collar.append(box(f'CollarFlap{side}', THREAD, (side * 0.069, 1.106, 0.27), (0.094, 0.104, 0.024), (0.25, 0, side * 0.58)))
group('Collar', collar, root)
placket = [box('PlacketStrip', SEAM, (0, 0.942, 0.276), (0.028, 0.32, 0.014), bevel=0.3)]
for i in range(3):
    placket.append(sphere('ShirtButton', BUTTON, (0, 0.835 + i * 0.103, 0.29), (0.013, 0.013, 0.006), seg=12))
placket.append(box('Pocket', SHIRT, (-0.132, 1.01, 0.244), (0.1, 0.094, 0.018)))
placket.append(box('PocketStitch', THREAD, (-0.132, 1.046, 0.254), (0.1, 0.01, 0.012), bevel=0))
group('Placket', placket, root)
stripes = []
for i in range(3):
    y = 1.09 - i * 0.14
    r = {1.09: 0.264, 0.95: 0.281, 0.81: 0.276}[round(y, 2)]
    stripes.append(cylinder(f'Stripe{i}', STRIPE, (0, y, 0), r + 0.006, r + 0.006, 0.036, seg=72))
group('Stripes', stripes, root)
dots = []
for i in range(14):
    a = i * 2.4
    y = 0.79 + (i % 4) * 0.085
    dots.append(sphere('PolkaDot', DOT, (math.sin(a) * 0.279, y, math.cos(a) * 0.279), (0.03, 0.03, 0.008), (0, a, 0), seg=8))
group('Dots', dots, root)
overalls = [box('Bib', DENIM, (0, 0.82, 0.262), (0.34, 0.2, 0.03)),
            torus('Waistband', DENIM, (0, 0.735, 0), 0.262, 0.02)]
for side in (-1, 1):
    # Straps lean back over the chest (top toward -Z) and forward over the back.
    overalls.append(box(f'Strap{side}', DENIM, (side * 0.13, 1.0, 0.232), (0.062, 0.3, 0.02), (-0.2, 0, side * -0.06)))
    overalls.append(box(f'StrapBack{side}', DENIM, (side * 0.12, 1.0, -0.232), (0.062, 0.3, 0.02), (0.2, 0, side * 0.1)))
    overalls.append(sphere(f'Rivet{side}', BRASS, (side * 0.13, 0.9, 0.276), (0.017, 0.017, 0.008), seg=12))
group('Overalls', overalls, root)
aloha = [box('AlohaPlacket', CREAM, (0, 0.93, 0.283), (0.028, 0.37, 0.016), bevel=0.3)]
for side in (-1, 1):
    aloha.append(box(f'AlohaCollar{side}', CREAM, (side * 0.075, 1.095, 0.25), (0.1, 0.12, 0.026), (0.25, 0, side * 0.55)))
for i in range(3):
    aloha.append(sphere('AlohaButton', BUTTON, (0, 0.81 + i * 0.105, 0.296), (0.014, 0.014, 0.006), seg=12))
for i in range(11):
    a = i * 2.4 + 0.42
    y = 0.8 + (i % 3) * 0.11
    r = 0.278
    center = Vector((math.sin(a) * r, y, math.cos(a) * r))
    for petal in range(5):
        th = petal * math.pi * 0.4
        local = Vector((math.sin(th) * 0.026, math.cos(th) * 0.026, 0.004))
        local.rotate(Euler((0, a, 0)))
        aloha.append(sphere('Petal', PETAL_A if i % 2 else PETAL_B, center + local, (0.02, 0.028, 0.006), (0, a, -th), seg=6))
    aloha.append(sphere('FlowerHeart', BLOOM, center + Vector((math.sin(a), 0, math.cos(a))) * 0.008, (0.016, 0.016, 0.006), (0, a, 0), seg=6))
    leaf_pos = center + Vector((math.cos(a) * 0.04, -0.03, -math.sin(a) * 0.04))
    aloha.append(sphere('Leaf', LEAF, leaf_pos, (0.014, 0.034, 0.005), (0, a, -0.6), seg=6))
group('Aloha', aloha, root)

# ── Arms: rigid shoulder joints with skinned-shape limbs and two hand types ──
for index, side in enumerate((-1, 1)):
    joint = empty(f'Arm{index}', (side * 0.29, 1.1, 0), root)
    o = Vector((side * 0.29, 1.1, 0))
    arm = skin_tube(f'ArmSkin{index}', SKIN,
                    [o + Vector((side * 0.02, 0.02, 0)), o + Vector((side * 0.05, -0.2, -0.012)), o + Vector((side * 0.06, -0.385, 0.012))],
                    [0.07, 0.058, 0.05])
    sleeve = cylinder(f'Sleeve{index}', SHIRT, tuple(o + Vector((side * 0.035, -0.05, 0))), 0.088, 0.084, 0.15)
    cuff = torus(f'SleeveCuff{index}', SEAM, tuple(o + Vector((side * 0.035, -0.12, 0))), 0.084, 0.01)
    group(f'ArmShape{index}', [arm, sleeve, cuff], joint)
    wrist, palm = o + Vector((side * 0.06, -0.39, 0.015)), o + Vector((side * 0.06, -0.455, 0.018))
    pts = [wrist, palm]
    edges = [(0, 1)]
    radii = [0.052, 0.066]
    for f in (-1, 0, 1):
        base = palm + Vector((f * 0.032, -0.03, 0.01))
        tip = palm + Vector((f * 0.042, -0.115, 0.025))
        pts += [base, tip]
        edges += [(1, len(pts) - 2), (len(pts) - 2, len(pts) - 1)]
        radii += [0.026, 0.021]
    thumb_tip = palm + Vector((side * 0.06, -0.01, 0.05))
    pts.append(thumb_tip)
    edges.append((1, len(pts) - 1))
    radii.append(0.024)
    hand = skin_tube(f'Hand{index}', SKIN, pts, radii, edges)
    kit.parent(hand, joint)
    glove = skin_tube(f'GloveShape{index}', GLOVE, pts, [r * 1.1 for r in radii], edges)
    glove_cuff = cylinder(f'GloveCuff{index}', CUFF, tuple(wrist + Vector((0, -0.005, 0))), 0.07, 0.076, 0.05)
    group(f'Glove{index}', [glove, glove_cuff], joint)

# ── Legs: hip joints, slim legs and laced sneakers ─────────────────────────
for index, side in enumerate((-1, 1)):
    joint = empty(f'Leg{index}', (side * 0.14, 0.67, 0), root)
    o = Vector((side * 0.14, 0.67, 0))
    leg = skin_tube(f'LegSkin{index}', SKIN, [o + Vector((0, 0.02, 0)), o + Vector((0, -0.25, 0.008)), o + Vector((0, -0.5, 0))], [0.072, 0.06, 0.052])
    kit.parent(leg, joint)
    shoe = [sphere(f'ShoeUpper{index}', SHOE, tuple(o + Vector((0, -0.565, 0.075))), (0.112, 0.085, 0.2), seg=20),
            sphere(f'ShoeSole{index}', SOLE, tuple(o + Vector((0, -0.628, 0.08))), (0.118, 0.026, 0.21), seg=20),
            sphere(f'ShoeToe{index}', SOLE, tuple(o + Vector((0, -0.6, 0.235))), (0.08, 0.045, 0.06), seg=20),
            box(f'HeelTab{index}', SHIRT, tuple(o + Vector((0, -0.54, -0.105))), (0.06, 0.07, 0.016))]
    for lace in range(3):
        shoe.append(box(f'Lace{index}', LACE, tuple(o + Vector((0, -0.49 - lace * 0.012, 0.08 + lace * 0.04))), (0.1, 0.012, 0.014), (0.6, (0.16 if lace % 2 else -0.16), 0), bevel=0))
    group(f'Shoe{index}', shoe, joint)

# ── Face: eyes with highlights, lids, brows, nose, mouth shapes ────────────
for index, side in enumerate((-1, 1)):
    eye = sphere(f'Eye{index}', EYE, (side * 0.21, 1.835, 0.334), (0.185, 0.253, 0.092), (0, 0, side * -0.23), seg=40)
    hi = sphere(f'EyeGlint{index}', GLINT, (0, 0, 0), (1, 1, 1), seg=16)
    hi2 = sphere(f'EyeGlint2{index}', GLINT2, (0, 0, 0), (1, 1, 1), seg=12)
    # Highlights live in the eye's unit space so blinking squashes them too.
    hi.parent = eye
    hi.matrix_parent_inverse = Matrix.Identity(4)
    hi.location, hi.scale = B((-0.32, 0.4, 0.89)), (0.092, 0.023, 0.161)
    hi2.parent = eye
    hi2.matrix_parent_inverse = Matrix.Identity(4)
    hi2.location, hi2.scale = B((0.29, -0.38, 0.94)), (0.075, 0.011, 0.075)
    kit.parent(eye, root)
    lid = torus(f'Lid{index}', LID, (side * 0.21, 1.835, 0.37), 0.184, 0.013, (math.pi / 2, 0, side * -0.23), arc='half', scale=(1, 1, 1))
    kit.parent(lid, root)
    brow = cylinder(f'Brow{index}', HAIR, (side * 0.21, 2.11, 0.303), 0.014, 0.014, 0.17, (0, 0, math.pi / 2 + side * -0.13), seg=12)
    kit.parent(brow, root)
nose = sphere('Nose', NOSE, (0, 1.535, 0.344), (0.034, 0.035, 0.04))
kit.parent(nose, root)
face = empty('Face', (0, 1.425, 0.334), root)
smile = torus('MouthSmile', MOUTH, (0, 1.425 + 0.025, 0.349), 0.092, 0.02, (math.pi / 2, 0, math.pi), arc='half')
frown = torus('MouthFrown', MOUTH, (0, 1.425 + 0.025, 0.349), 0.092, 0.02, (math.pi / 2, 0, 0), arc='half')
grin = group('MouthGrin', [sphere('GrinHole', MOUTH, (0, 1.425, 0.334), (0.12, 0.076, 0.023)),
                           box('GrinTeeth', TEETH, (0, 1.45, 0.358), (0.15, 0.034, 0.016), bevel=0.3),
                           sphere('GrinTongue', TONGUE, (0, 1.387, 0.356), (0.052, 0.012, 0.005))], face)
for m in (smile, frown):
    kit.parent(m, face)
freckles = []
for side in (-1, 1):
    for i in range(3):
        freckles.append(sphere('Freckle', FRECKLE, (side * (0.18 + i * 0.038), 1.52 - (i % 2) * 0.03, 0.34 - i * 0.025), (0.012, 0.012, 0.005), seg=8))
group('Freckles', freckles, root)

# ── Hair styles (1–7), beards, accessories ──────────────────────────────────
hairs = {
    1: [sphere('Tuft', HAIR, ((i - 2) * 0.14, 2.23 + math.sin(i) * 0.025, -0.025), (0.12, 0.09, 0.12), (0.3 * (i - 2) * 0.2, 0, -(i - 2) * 0.18)) for i in range(5)],
    2: [cone('Quiff', HAIR, (0, 2.3, -0.03), 0.22, 0.34, (0, 0, -0.2), seg=24)],
    3: [sphere('Bowl', HAIR, (0, 2.17, -0.17), (0.477, 0.18, 0.36), seg=40)],
    4: [cone(f'Spike{i}', HAIR, ((i - 1) * 0.18, 2.28, -0.01), 0.13, 0.32, (0, 0, -(i - 1) * 0.25)) for i in range(3)],
    5: [cylinder('Brim', STRAW, (0, 2.2, 0), 0.56, 0.56, 0.045, seg=48),
        cylinder('HatCrown', STRAW_DARK, (0, 2.31, 0), 0.3, 0.4, 0.19, seg=40),
        cylinder('HatBand', SHIRT, (0, 2.245, 0), 0.36, 0.38, 0.05, seg=40)],
    6: [sphere('BunCap', HAIR, (0, 2.2, -0.11), (0.41, 0.144, 0.328), seg=40), sphere('Bun', HAIR, (0, 2.06, -0.45), (0.19, 0.19, 0.19), seg=24)],
    7: [cone(f'Mohawk{i}', HAIR, (0, 2.26, (-2 + i) * 0.14), 0.09, 0.22) for i in range(5)],
}
for style, parts in hairs.items():
    group(f'Hair{style}', parts, root)
group('Beard1', [cylinder(f'Stache{s}', HAIR, (s * 0.064, 1.475, 0.365), 0.024, 0.024, 0.09, (0, 0, s * 0.85), seg=12) for s in (-1, 1)], root)
group('Beard2', [sphere('Goatee', HAIR, (0, 1.28, 0.254), (0.075, 0.049, 0.03))], root)
glasses = [box('Bridge', GOLD, (0, 1.845, 0.445), (0.09, 0.025, 0.026), bevel=0.3)]
for s in (-1, 1):
    glasses.append(torus(f'Frame{s}', GOLD, (s * 0.21, 1.835, 0.44), 0.198, 0.02, (math.pi / 2, 0, s * -0.23), scale=(0.98, 1, 1.23)))
    glasses.append(sphere(f'Lens{s}', LENS, (s * 0.21, 1.835, 0.44), (0.19, 0.24, 0.01), (0, 0, s * -0.23)))
group('Acc1', glasses, root)
flower = [sphere('HairPetal', PINK, (0.42 + math.sin(i * 1.256) * 0.08, 2.08 + math.cos(i * 1.256) * 0.08, 0.1), (0.068, 0.068, 0.027)) for i in range(5)]
flower.append(sphere('HairFlowerHeart', YELLOW, (0.42, 2.08, 0.145), (0.05, 0.05, 0.05)))
group('Acc2', flower, root)
crown = [cylinder('CrownBand', GOLD, (0, 2.2, 0), 0.43, 0.46, 0.085, seg=48)]
for i in range(5):
    a = i * 1.256
    crown.append(cone('CrownPoint', GOLD, (math.sin(a) * 0.4, 2.32, math.cos(a) * 0.4), 0.07, 0.2))
    crown.append(sphere('CrownGem', GEM, (math.sin(a) * 0.445, 2.2, math.cos(a) * 0.445), (0.028, 0.028, 0.028), seg=12))
group('Acc3', crown, root)
group('Acc4', [torus('PoolFloat', FLOAT, (0, 0.77, 0), 0.34, 0.07)], root)
phones = [torus('PhoneBand', BAND, (0, 1.87, -0.02), 0.49, 0.035, (math.pi / 2, 0, 0), arc='half')]
for s in (-1, 1):
    phones.append(sphere(f'PhoneCup{s}', PHONE, (s * 0.49, 1.89, -0.025), (0.085, 0.17, 0.13)))
group('Acc5', phones, root)
pack = [box('Pack', PACK, (0, 0.98, -0.3), (0.25, 0.31, 0.14), bevel=0.3),
        box('PackFlap', PACK, (0, 1.08, -0.37), (0.24, 0.12, 0.02), (0.15, 0, 0), bevel=0.3)]
for s in (-1, 1):
    pack.append(box(f'PackStrap{s}', PACK, (s * 0.12, 1.02, -0.19), (0.045, 0.32, 0.02), bevel=0.3))
group('Acc6', pack, root)

for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data.uv_layers and obj.data.materials and any(
            m.name in ('Shirt', 'Shoe', 'Glove', 'Denim', 'Backpack') for m in obj.data.materials):
        kit.world_uvs(obj, 0.18)
    elif obj.type == 'MESH' and any(m.name in ('Shirt', 'Shoe', 'Glove', 'Denim', 'Backpack') for m in obj.data.materials):
        obj.data.uv_layers.new(name='UVMap')
        kit.world_uvs(obj, 0.18)

kit.export('alien')

# Preview: default look, then a second outfit.
def show(*names):
    for obj in bpy.data.objects:
        if obj.parent == root or obj.parent in [o for o in bpy.data.objects if o.parent == root]:
            pass
    options = [f'Hair{i}' for i in range(1, 8)] + ['Beard1', 'Beard2'] + [f'Acc{i}' for i in range(1, 7)] + \
              ['Collar', 'Placket', 'Stripes', 'Dots', 'Overalls', 'Aloha', 'Freckles', 'MouthFrown', 'MouthGrin'] + \
              [f'Glove{i}' for i in (0, 1)] + [f'Hand{i}' for i in (0, 1)] + [f'Brow{i}' for i in (0, 1)]
    for name in options:
        obj = bpy.data.objects.get(name)
        if obj:
            hidden = name not in names
            obj.hide_render = hidden
            for child in obj.children_recursive:
                child.hide_render = hidden


show('Aloha', 'Glove0', 'Glove1')
kit.preview('alien', [('front', (1.2, -4.6, 1.7), 50), ('side', (-4.2, -2.4, 1.6), 50)], target=(0, 0, 1.2))
show('Overalls', 'Collar', 'Hair5', 'Acc1', 'Beard1', 'Hand0', 'Hand1', 'Brow0', 'Brow1', 'MouthGrin', 'Freckles')
smile.hide_render = True
bpy.context.scene.render.filepath = os.path.join(kit.RENDERS, 'alien-outfit.png')
bpy.ops.render.render(write_still=True)
print('RENDERED outfit')
