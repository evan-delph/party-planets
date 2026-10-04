"""The crew's landing saucer (public/models/ufo.glb).

  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/ufo.py

Matches game/Ufo.ts proportions so seats, the ramp hinge and the code-driven
rim lights still line up: hull rim radius 2.8 at height 1.5, dome base 1.76,
door facing -Y (three.js +Z). The node named "Ramp" is hinged at its origin and
stands upright when closed; three.js rotates it about X to open it.
Material names LampGreen / LampAmber / LampBlue / Glass are driven in code.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
import kit  # noqa: E402

kit.reset()

# Sleek painted alloy for the hull; scanned plate only on trim and ramp.
HULL = kit.flat('HullPaint', '#dfe6ee', rough=0.28, metal=0.55)
BELLY = kit.flat('BellyPaint', '#8796a6', rough=0.36, metal=0.65)
TRIM = kit.scanned('TrimPlate', 'blue_metal_plate', metal=0.8)
DARK = kit.flat('Interior', '#14232c', rough=0.75)
GLASS = kit.flat('Glass', '#9fe6f0', rough=0.05, metal=0.0, alpha=0.32)
GREEN = kit.flat('LampGreen', '#7dffb0', rough=0.3, emit=3.0)
AMBER = kit.flat('LampAmber', '#ffc561', rough=0.3, emit=2.5)
BLUE = kit.flat('LampBlue', '#4fb3ff', rough=0.2, emit=2.5)
RUBBER = kit.flat('Rubber', '#20262c', rough=0.9)

parts = {'hull': [], 'glass': []}


def keep(obj, group='hull', uv=0.9):
    if obj.data.materials and obj.data.materials[0].name == 'TrimPlate':
        kit.world_uvs(obj, uv)
    parts[group].append(obj)
    return obj


# ── Hull: belly, rim band, upper deck (solids of revolution) ───────────────
belly = kit.lathe('Belly', [(0.0, 0.86), (1.05, 0.86), (1.36, 0.9), (1.9, 1.02), (2.45, 1.22), (2.72, 1.38), (2.8, 1.46)])
belly.data.materials.append(BELLY)
kit.smooth(belly)
keep(belly)
rim = kit.lathe('Rim', [(2.8, 1.44), (2.86, 1.5), (2.8, 1.56)], close_top=False)
rim.data.materials.append(TRIM)
kit.smooth(rim, 80)
keep(rim)
deck = kit.lathe('Deck', [(2.8, 1.54), (2.6, 1.66), (2.2, 1.82), (1.8, 1.92), (1.66, 1.93), (1.62, 1.76), (0.0, 1.76)])
deck.data.materials.append(HULL)
kit.smooth(deck)
keep(deck)
# Panel seams: thin dark rings pressed into the deck and belly.
for r, z, minor in ((2.35, 1.79, 0.018), (1.98, 1.89, 0.016), (2.1, 1.08, 0.02), (1.55, 0.93, 0.018)):
    seam = kit.add('primitive_torus_add', 'Seam', TRIM, major_radius=r, minor_radius=minor, major_segments=96, minor_segments=6, location=(0, 0, z))
    keep(seam)
# Radial panel seams on the upper deck.
for i in range(20):
    a = i * math.pi / 10
    r0, r1 = 1.72, 2.72
    seam = kit.strut('RadialSeam', (math.cos(a) * r0, math.sin(a) * r0, 1.925), (math.cos(a) * r1, math.sin(a) * r1, 1.6), 0.012, TRIM, vertices=6)
    keep(seam)
# Engine core: recessed dark well with a grille, glowing ring added in code.
well = kit.lathe('EngineWell', [(1.1, 0.86), (0.95, 0.74), (0.0, 0.74)], close_top=False)
well.data.materials.append(DARK)
keep(well)
for i in range(12):
    a = i * math.pi / 6
    fin = kit.add('primitive_cube_add', 'Fin', TRIM, size=1, location=(math.cos(a) * 0.55, math.sin(a) * 0.55, 0.77))
    fin.scale = (0.9, 0.05, 0.06)
    fin.rotation_euler = (0, 0, a)
    keep(fin)

# ── Dome: glass bubble, frame ribs, antenna beacon ─────────────────────────
dome = kit.add('primitive_uv_sphere_add', 'Dome', GLASS, segments=48, ring_count=24, radius=1.58, location=(0, 0, 1.76))
dome.scale.z = 0.78
import bmesh  # noqa: E402
bm = bmesh.new()
bm.from_mesh(dome.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
bm.to_mesh(dome.data)
bm.free()
kit.smooth(dome, 80)
keep(dome, 'glass')
frame = kit.add('primitive_torus_add', 'DomeFrame', TRIM, major_radius=1.6, minor_radius=0.06, major_segments=64, minor_segments=8, location=(0, 0, 1.78))
keep(frame)
for i in range(6):
    rib = kit.add('primitive_torus_add', 'Rib', HULL, major_radius=1.585, minor_radius=0.022, major_segments=48, minor_segments=6, location=(0, 0, 1.76))
    rib.rotation_euler = (math.pi / 2, 0, i * math.pi / 6)
    rib.scale = (1, 0.78, 1)
    bm = bmesh.new()
    bm.from_mesh(rib.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < 0.0], context='VERTS')
    bm.to_mesh(rib.data)
    bm.free()
    keep(rib)
cap = kit.add('primitive_cylinder_add', 'DomeCap', TRIM, vertices=24, radius=0.24, depth=0.08, location=(0, 0, 2.98))
keep(cap)
stalk = kit.add('primitive_cylinder_add', 'Antenna', HULL, vertices=12, radius=0.03, depth=0.5, location=(0, 0, 3.25))
keep(stalk)
beacon = kit.add('primitive_uv_sphere_add', 'Beacon', AMBER, segments=16, ring_count=8, radius=0.11, location=(0, 0, 3.52))
keep(beacon)

# ── Portholes around the belly ─────────────────────────────────────────────
for i in range(8):
    a = (i + 0.5) * math.pi / 4
    x, y = math.cos(a) * 2.47, math.sin(a) * 2.47
    rim_ring = kit.add('primitive_torus_add', 'PortRim', TRIM, major_radius=0.17, minor_radius=0.04, major_segments=24, minor_segments=8, location=(x, y, 1.24))
    rim_ring.rotation_euler = (math.pi / 2, 0, a + math.pi / 2)
    keep(rim_ring)
    pane = kit.add('primitive_cylinder_add', 'PortGlass', BLUE, vertices=24, radius=0.16, depth=0.04, location=(x * 1.004, y * 1.004, 1.24))
    pane.rotation_euler = (math.pi / 2, 0, a + math.pi / 2)
    keep(pane)

# ── Landing gear: three hydraulic legs with pads ───────────────────────────
for i in range(3):
    a = i * 2 * math.pi / 3 + math.pi
    # three.js leg position (sin a, cos a) * 1.64 → Blender (x, -z)
    x, y = math.sin(a) * 1.64, -math.cos(a) * 1.64
    out = (x * 1.22, y * 1.22)
    housing = kit.add('primitive_cylinder_add', 'LegHousing', TRIM, vertices=16, radius=0.18, depth=0.32, location=(x, y, 0.98))
    keep(housing)
    # Telescoping strut: thick sleeve from the hull, thin piston to the foot.
    mid = (x + (out[0] - x) * 0.55, y + (out[1] - y) * 0.55, 0.5)
    keep(kit.strut('Sleeve', (x, y, 0.95), mid, 0.1, TRIM, 12))
    keep(kit.strut('Piston', mid, (out[0], out[1], 0.14), 0.062, HULL, 12))
    keep(kit.add('primitive_uv_sphere_add', 'Knee', TRIM, segments=12, ring_count=8, radius=0.11, location=mid))
    pad = kit.add('primitive_cylinder_add', 'Pad', TRIM, vertices=24, radius=0.36, depth=0.09, location=(out[0], out[1], 0.06))
    keep(pad)
    tread = kit.add('primitive_cylinder_add', 'PadRubber', RUBBER, vertices=24, radius=0.33, depth=0.04, location=(out[0], out[1], 0.01))
    keep(tread)

# ── Airlock: housing, open doorway, light strips ──────────────────────────
housing = kit.add('primitive_cube_add', 'Airlock', HULL, size=1, location=(0, -2.28, 1.12))
housing.scale = (1.55, 0.6, 0.82)
bev = housing.modifiers.new('Bevel', 'BEVEL')
bev.width = 0.06
bev.segments = 3
keep(housing)
door = kit.add('primitive_cube_add', 'Doorway', DARK, size=1, location=(0, -2.585, 1.04))
door.scale = (1.27, 0.04, 1.32 * 0.62)
keep(door)
for side in (-1, 1):
    jamb = kit.add('primitive_cube_add', 'Jamb', TRIM, size=1, location=(side * 0.7, -2.6, 1.04))
    jamb.scale = (0.12, 0.08, 0.9)
    keep(jamb)
    strip = kit.add('primitive_cube_add', 'DoorLight', GREEN, size=1, location=(side * 0.6, -2.63, 1.04))
    strip.scale = (0.035, 0.03, 0.78)
    keep(strip)
lintel = kit.add('primitive_cube_add', 'Lintel', TRIM, size=1, location=(0, -2.6, 1.5))
lintel.scale = (1.5, 0.1, 0.12)
keep(lintel)

# ── Ramp: hinged at the door sill; closed = upright ─────────────────────────
ramp = bpy.data.objects.new('Ramp', None)
bpy.context.scene.collection.objects.link(ramp)
ramp.location = (0, -2.52, 0.37)
ramp_parts = []
slab = kit.add('primitive_cube_add', 'RampSlab', TRIM, size=1, location=(0, -2.52, 0.37 + 0.7))
slab.scale = (1.28, 0.11, 1.4)
kit.world_uvs(slab, 0.9)
ramp_parts.append(slab)
for i in range(6):
    step = kit.add('primitive_cube_add', 'Tread', HULL, size=1, location=(0, -2.59, 0.37 + 0.16 + i * 0.21))
    step.scale = (1.02, 0.035, 0.035)
    ramp_parts.append(step)
for side in (-1, 1):
    rail = kit.add('primitive_cube_add', 'RampLight', AMBER, size=1, location=(side * 0.59, -2.6, 0.37 + 0.7))
    rail.scale = (0.035, 0.035, 1.26)
    ramp_parts.append(rail)
ramp_mesh = kit.join(ramp_parts, 'RampMesh')
kit.parent(ramp_mesh, ramp)

# ── Merge by material group for few draw calls, then export ─────────────────
ufo = bpy.data.objects.new('Ufo', None)
bpy.context.scene.collection.objects.link(ufo)
hull_mesh = kit.join(parts['hull'], 'HullMesh')
glass_mesh = kit.join(parts['glass'], 'GlassMesh')
for obj in (hull_mesh, glass_mesh, ramp):
    kit.parent(obj, ufo)
for obj in (hull_mesh, ramp_mesh):
    for p in obj.data.polygons:
        pass
kit.export('ufo')

# Preview with the ramp open, as on landing.
ramp.rotation_euler.x = -(math.pi / 2 + 0.23)
kit.preview('ufo', [('front', (5.5, -9.5, 4.2), 50), ('top', (-8, -6, 8.5), 45)], target=(0, 0, 1.3))
