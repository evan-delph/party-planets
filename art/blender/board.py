"""Board scenery: island terrain, roads and props around a board layout.

  node scripts/test-loader.cjs scripts/export-boards.ts          # layouts → art/boards/*.json
  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/board.py -- crown

Writes public/models/board-<id>.glb (+ art/renders/board-<id>-*.png).
Board space: three.js x/z from the layout; Blender (x, -z, height).
Tiles, characters and effects stay code-driven; this file builds everything
else: a heightfield island that rises around the roads, stone roads along
every route, scanned-material terrain, and instanced props kept clear of play.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(__file__))
import kit  # noqa: E402

BOARD = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'crown'
LAYOUT = json.load(open(os.path.join(kit.ROOT, 'art', 'boards', BOARD + '.json')))
random.seed(7)
kit.reset()

PATH_Y = 0.6  # road surface; code tiles sit on top at 0.81


def B(x, z, y=0.0):
    return Vector((x, -z, y))


# ── Theme recipes ───────────────────────────────────────────────────────────
THEMES = {
    'crown': dict(
        land=('Grass', ('sparse_grass', '#2d6e25', '#b2e366', 0.9)), beach=('Sand', 'coast_sand_01'), rock=('Rock', 'coast_land_rocks_01'),
        road=('Road', 'large_sandstone_blocks'), branch=('Boardwalk', 'brown_planks_05'),
        hills=1.5, island=7.5, sea_level=0.0, seabed=-1.6, water='#2bb6c4', props='tropical'),
}
TH = THEMES.get(BOARD, THEMES['crown'])

# ── Layout geometry helpers ─────────────────────────────────────────────────
segments = []
for road in LAYOUT['roads']:
    pts = road['points']
    for a, b in zip(pts, pts[1:]):
        segments.append((a, b))
spaces = LAYOUT['spaces']
radius = LAYOUT['radius']


def seg_dist(px, pz, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz + 1e-9)))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


def path_dist(x, z):
    return min(seg_dist(x, z, a, b) for a, b in segments)


def smoothstep(e0, e1, v):
    t = max(0.0, min(1.0, (v - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def fbm(x, z, scale, octaves=4):
    return noise.fractal(Vector((x * scale, z * scale, 0.37)), 0.5, 2.0, octaves, noise_basis='PERLIN_ORIGINAL')


landmark = LAYOUT['landmark']
districts = LAYOUT['districts']
lagoons = LAYOUT['water']


def in_lagoon(x, z, pad=0.0):
    for w in lagoons:
        c, s = math.cos(-w['angle']), math.sin(-w['angle'])
        dx, dz = x - w['x'], z - w['z']
        rx, rz = dx * c - dz * s, dx * s + dz * c
        if (rx / (w['rx'] + pad)) ** 2 + (rz / (w['rz'] + pad)) ** 2 < 1:
            return True
    return False


def lagoon_depth(x, z):
    best = 0.0
    for w in lagoons:
        c, s = math.cos(-w['angle']), math.sin(-w['angle'])
        dx, dz = x - w['x'], z - w['z']
        rx, rz = dx * c - dz * s, dx * s + dz * c
        e = (rx / (w['rx'] + 1.2)) ** 2 + (rz / (w['rz'] + 1.2)) ** 2
        best = max(best, 1 - min(1.0, e))
    return best


def height(x, z):
    d = path_dist(x, z)
    dl = math.hypot(x - landmark[0], z - landmark[1])
    dd = min([math.hypot(x - q['x'], z - q['z']) for q in districts] + [99])
    # Signed distance to the coast: land hugs the roads and bulges around
    # districts and the landmark; positive inland, negative out to sea.
    shore = TH['island'] + fbm(x, z, 0.09) * 3.2
    cd = max(shore - d, 9 - dd, 12 - dl)
    hills = max(0.0, fbm(x + 40, z - 15, 0.07, 5)) * TH['hills'] * smoothstep(2.2, 8, d)
    inland = PATH_Y - 0.05 + hills * smoothstep(2.0, 5.0, cd)
    # Volcano: a steep cone with a lava crater near the landmark.
    if BOARD == 'crown':
        cone = max(0.0, 1 - dl / 11.0)
        crater = max(0.0, 1 - dl / 2.6)
        inland += 8.5 * cone ** 1.6 * smoothstep(1.6, 4.0, d) - 2.2 * crater ** 2
    if cd >= 2.5:
        h = inland
    elif cd >= 0:
        # Sandy beach shelf sloping gently to the waterline.
        h = 0.06 + (inland - 0.06) * smoothstep(0, 2.5, cd)
    else:
        h = 0.06 + (TH['seabed'] - 0.06) * smoothstep(0, 5.5, -cd)
    # Roads stay flat and dry.
    h = h + (PATH_Y - 0.02 - h) * (1 - smoothstep(1.2, 2.3, d))
    # Lagoons: carved basins (only away from the roads).
    deep = lagoon_depth(x, z) * smoothstep(1.6, 3.0, d)
    h -= deep * 1.6
    return h


# ── Terrain heightfield ─────────────────────────────────────────────────────
size = radius * 2.5
step = 0.65
n = int(size / step)
mesh = bpy.data.meshes.new('Terrain')
bm = bmesh.new()
grid = []
for i in range(n + 1):
    row = []
    for j in range(n + 1):
        x = -size / 2 + j * step
        z = -size / 2 + i * step
        row.append(bm.verts.new(B(x, z, height(x, z))))
    grid.append(row)
for i in range(n):
    for j in range(n):
        bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# An open sheet has no "outside": make every face point up.
for f in bm.faces:
    if f.normal.z < 0:
        f.normal_flip()
# Drop deep seabed faces the camera never sees.
far = [f for f in bm.faces if all(v.co.z < TH['seabed'] + 0.05 for v in f.verts)
       and f.calc_center_median().length > radius * 1.15]
bmesh.ops.delete(bm, geom=far, context='FACES')
bm.to_mesh(mesh)
bm.free()
terrain = bpy.data.objects.new('Terrain', mesh)
bpy.context.scene.collection.objects.link(terrain)
for p in mesh.polygons:
    p.use_smooth = True
mats = {}
layer_assets = {}
for key in ('land', 'beach', 'rock'):
    name, asset = TH[key]
    if isinstance(asset, tuple):  # (scan, dark, light, gamma) → recolored set
        asset = kit.recolor(asset[0], asset[1], asset[2], asset[3], tag=BOARD)
    layer_assets[key] = asset
    mats[key] = kit.scanned(name, asset, metal=0.0)
# Splat terrain: per-vertex weights (R sand, G grass, B rock) blended per pixel
# in three.js (game/TerrainMaterial.ts). Noise breaks up every boundary.
terrain.data.materials.append(kit.flat('Terrain', TH.get('terrain_fallback', '#6fae4f'), rough=0.9))
splat = mesh.color_attributes.new('Splat', 'FLOAT_COLOR', 'POINT')
mesh.color_attributes.active_color = splat
for v in mesh.vertices:
    x, z = v.co.x, -v.co.y
    wobble = fbm(x, z, 0.35, 3) * 0.12
    sand = 1 - smoothstep(0.34, 0.52, v.co.z + wobble)
    rock = max(smoothstep(0.86, 0.66, v.normal.z + wobble * 0.5), smoothstep(2.3, 3.0, v.co.z + wobble * 4))
    grass = max(0.0, 1 - sand - rock)
    total = sand + grass + rock or 1
    splat.data[v.index].color = (sand / total, grass / total, rock / total, 1.0)
# Export the three layers' maps for the shader (1K WebP).
tex_dir = os.path.join(kit.ROOT, 'public', 'textures', 'terrain', BOARD)
os.makedirs(tex_dir, exist_ok=True)
for key, layer in (('beach', 'sand'), ('land', 'grass'), ('rock', 'rock')):
    asset = layer_assets[key]
    for kind, out in (('Diffuse', 'color'), ('nor_gl', 'normal'), ('arm', 'arm')):
        for res in ('1k', '2k', '4k'):
            src = os.path.join(kit.SOURCE, asset, f'{asset}_{kind}_{res}.jpg')
            if os.path.exists(src):
                break
        img = bpy.data.images.load(src)
        if img.size[0] > 1024:
            img.scale(1024, 1024)
        img.filepath_raw = os.path.join(tex_dir, f'{layer}-{out}.webp')
        img.file_format = 'WEBP'
        bpy.context.scene.render.image_settings.quality = 82
        img.save()
        bpy.data.images.remove(img)
# Lava pool in the volcano's crater (emissive; three.js adds flicker).
if BOARD == 'crown':
    lx, lz = landmark
    top = height(lx, lz)
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=2.1, fill_type='NGON', location=B(lx, lz, top + 0.35))
    lava = bpy.context.active_object
    lava.name = 'LavaPool'
    lava.data.materials.append(kit.flat('Lava', '#ff6a1a', rough=0.4, emit=4.0))
kit.world_uvs(terrain, 3.0)

# Sea plane (three.js swaps in an animated water shader by material name).
bpy.ops.mesh.primitive_plane_add(size=size * 2.2, location=(0, 0, TH['sea_level']))
sea = bpy.context.active_object
sea.name = 'Sea'
sea.data.materials.append(kit.flat('Water', TH['water'], rough=0.08, alpha=0.82))

# ── Roads: smooth stone ribbons; gimmick branches use boardwalk planks ──────
def catmull(points, per=6):
    out = []
    pts = [points[0]] + points + [points[-1]]
    for k in range(1, len(pts) - 2):
        p0, p1, p2, p3 = [Vector((q[0], q[1])) for q in pts[k - 1:k + 3]]
        for s in range(per):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(Vector(points[-1]))
    return out


def ribbon(name, points, width, y, mat, uv_len=2.2):
    curve = catmull(points)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    left, right, dist = [], [], 0.0
    for k, p in enumerate(curve):
        a = curve[max(0, k - 1)]
        b = curve[min(len(curve) - 1, k + 1)]
        t = (b - a).normalized()
        nrm = Vector((-t.y, t.x))
        if k:
            dist += (p - curve[k - 1]).length
        left.append((bm.verts.new(B(*(p + nrm * width / 2), y)), dist))
        right.append((bm.verts.new(B(*(p - nrm * width / 2), y)), dist))
    for k in range(len(curve) - 1):
        f = bm.faces.new((left[k][0], right[k][0], right[k + 1][0], left[k + 1][0]))
        for loop, (u, v) in zip(f.loops, ((0, left[k][1]), (1, right[k][1]), (1, right[k + 1][1]), (0, left[k + 1][1]))):
            loop[uv_layer].uv = (u, v / uv_len)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


road_mat = kit.scanned(TH['road'][0], TH['road'][1], metal=0.0)
branch_mat = kit.scanned(TH['branch'][0], TH['branch'][1], metal=0.0)
curb = kit.flat('Curb', '#8f8068', rough=0.9)
roads = []
for road in LAYOUT['roads']:
    pts = [tuple(q) for q in road['points']]
    roads.append(ribbon('Curb', pts, 2.35, PATH_Y - 0.005, curb))
    roads.append(ribbon('Road', pts, 1.95, PATH_Y + 0.012, branch_mat if road['branch'] else road_mat))
road_mesh = kit.join(roads, 'Roads')

# ── Props ───────────────────────────────────────────────────────────────────
props = bpy.data.collections.new('Props')
bpy.context.scene.collection.children.link(props)
occupied = []  # (x, z, r) footprints already used


start = spaces[0]


def clear(x, z, r):
    if path_dist(x, z) < r + 1.4:
        return False
    # Keep the UFO landing site open.
    if math.hypot(x - start['x'], z - start['z']) < 9:
        return False
    if in_lagoon(x, z, 0.6):
        return False
    if height(x, z) < PATH_Y - 0.2:
        return False
    return all(math.hypot(x - ox, z - oz) > r + orr for ox, oz, orr in occupied)


def model_palm():
    bark = kit.scanned('PalmBark', 'palm_bark', metal=0.0)
    leaf = kit.flat('PalmLeaf', '#3f8f3a', rough=0.6)
    leaf_dark = kit.flat('PalmLeafDark', '#2f6f2e', rough=0.6)
    nut = kit.flat('Coconut', '#6b4a2b', rough=0.7)
    parts = []
    # Curved, tapering trunk built from rings.
    pts, radii = [], []
    for k in range(9):
        t = k / 8
        pts.append(Vector((0.55 * t * t, 0, 4.2 * t)))
        radii.append(0.2 - 0.07 * t)
    m = bpy.data.meshes.new('Trunk')
    m.from_pydata(pts, [(k, k + 1) for k in range(8)], [])
    trunk = bpy.data.objects.new('Trunk', m)
    bpy.context.scene.collection.objects.link(trunk)
    trunk.modifiers.new('Skin', 'SKIN')
    for k, r in enumerate(radii):
        trunk.data.skin_vertices[0].data[k].radius = (r, r)
    trunk.data.skin_vertices[0].data[0].use_root = True
    sub = trunk.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 1
    trunk.data.materials.append(bark)
    kit.apply_all(trunk)
    for poly in trunk.data.polygons:
        poly.use_smooth = True
    trunk.data.uv_layers.new(name='UVMap')
    kit.world_uvs(trunk, 0.8)
    parts.append(trunk)
    top = pts[-1]
    # Fronds: an arched rib carrying pairs of drooping leaflets.
    for f in range(9):
        ang = f * math.tau / 9 + random.uniform(-0.15, 0.15)
        lift = random.uniform(-0.25, 0.35)
        bm = bmesh.new()
        dirv = Vector((math.cos(ang), math.sin(ang), 0))
        side = Vector((-math.sin(ang), math.cos(ang), 0))

        def rib(t):
            return top + dirv * (2.8 * t) + Vector((0, 0, (0.9 + lift) * t - 2.0 * t * t))

        steps = 14
        for s in range(steps + 1):
            t = s / steps
            c = rib(t)
            if s < steps:
                c2 = rib((s + 1) / steps)
                for sgn in (-1, 1):
                    # Leaflet: a thin blade angled out and down from the rib.
                    length = 0.85 * math.sin(math.pi * min(1.0, 0.15 + t)) + 0.15
                    tip = c + side * sgn * length + dirv * 0.25 + Vector((0, 0, -0.35 * length))
                    w = (c2 - c) * 0.45
                    v = [bm.verts.new(c), bm.verts.new(c + w), bm.verts.new(tip + w * 0.3), bm.verts.new(tip)]
                    bm.faces.new(v)
        me = bpy.data.meshes.new('Frond')
        bm.to_mesh(me)
        bm.free()
        frond = bpy.data.objects.new('Frond', me)
        bpy.context.scene.collection.objects.link(frond)
        frond.data.materials.append(leaf if f % 2 else leaf_dark)
        for poly in frond.data.polygons:
            poly.use_smooth = True
        parts.append(frond)
    for k in range(3):
        a = k * math.tau / 3
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.17, location=top + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, -0.25)))
        o = bpy.context.active_object
        o.data.materials.append(nut)
        parts.append(o)
    palm = kit.join(parts, 'Palm')
    return palm


def model_rock(seed):
    rock_mat = mats['rock']
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    rock = bpy.context.active_object
    rock.name = f'Rock{seed}'
    for v in rock.data.vertices:
        d = noise.fractal(v.co * 1.4 + Vector((seed, seed * 2, 0)), 0.5, 2.0, 4)
        v.co *= 1 + 0.35 * d
        v.co.z *= 0.62
    rock.data.materials.append(rock_mat)
    for p in rock.data.polygons:
        p.use_smooth = True
    kit.world_uvs(rock, 1.5)
    return rock


def model_bush():
    leaf = kit.flat('Bush', '#4f9a45', rough=0.75)
    flower = kit.flat('Hibiscus', '#ff5f7a', rough=0.5)
    parts = []
    for k in range(5):
        a = k * 1.3
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.45 + (k % 2) * 0.15, location=(math.cos(a) * 0.4, math.sin(a) * 0.4, 0.35 + (k % 3) * 0.1))
        o = bpy.context.active_object
        o.data.materials.append(leaf)
        parts.append(o)
    for k in range(4):
        a = k * 1.7 + 0.4
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.09, location=(math.cos(a) * 0.62, math.sin(a) * 0.62, 0.6))
        o = bpy.context.active_object
        o.data.materials.append(flower)
        parts.append(o)
    bush = kit.join(parts, 'Bush')
    for p in bush.data.polygons:
        p.use_smooth = True
    return bush


# glTF GPU instancing only applies to copies parented to one Empty, so each
# prototype gets a holder; three.js then draws every copy in one call.
holders = {}


def instance(proto, x, z, scale=1.0, rot=None, sink=0.05):
    holder = holders.get(proto.name)
    if holder is None:
        holder = holders[proto.name] = bpy.data.objects.new(proto.name + 'Set', None)
        props.objects.link(holder)
    obj = bpy.data.objects.new(proto.name + 'I', proto.data)
    props.objects.link(obj)
    obj.parent = holder
    obj.location = B(x, z, height(x, z) - sink)
    obj.rotation_euler = (0, 0, random.uniform(0, math.tau) if rot is None else rot)
    obj.scale = (scale,) * 3
    return obj


protos = bpy.data.collections.new('Prototypes')
bpy.context.scene.collection.children.link(protos)


def stash(obj):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    protos.objects.link(obj)
    return obj


palm = stash(model_palm())
rocks = [stash(model_rock(s)) for s in range(3)]
bush = stash(model_bush())

# Landmark first so scatter keeps clear of it.
occupied.append((landmark[0], landmark[1], 9.0))
for q in districts:
    occupied.append((q['x'], q['z'], 2.5))

# Buildings beside special spaces, set back from the road and facing it.
wood = kit.scanned('Wood', 'brown_planks_05', metal=0.0)
roof = kit.scanned('RoofTiles', 'clay_roof_tiles_02', metal=0.0)
cloth_a = kit.flat('CanopyA', '#f25265', rough=0.85)
cloth_b = kit.flat('CanopyB', '#fff4dc', rough=0.85)
gold = kit.flat('GoldTrim', '#f2c14e', rough=0.3, metal=1.0)
stone = kit.scanned('Stone', TH['road'][1], metal=0.0)
buildings = []


def beside(space, back=3.4, r=2.2):
    """Find a clear spot next to a space, preferring the outside of the board."""
    sx, sz = space['x'], space['z']
    base = math.atan2(sz, sx)
    for k in range(24):
        a = base + (k % 2 * 2 - 1) * (k // 2) * 0.35
        for dist in (back, back + 1.2, back + 2.4):
            x, z = sx + math.cos(a) * dist, sz + math.sin(a) * dist
            if clear(x, z, r):
                return x, z, math.atan2(sx - x, sz - z)
    return None


def stall(x, z, face):
    parts = []
    for dx in (-0.9, 0.9):
        for dz in (-0.6, 0.6):
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.06, depth=1.8, location=(dx, dz, 0.9))
            parts.append(bpy.context.active_object)
            parts[-1].data.materials.append(wood)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.35, 0.55))
    counter = bpy.context.active_object
    counter.scale = (1.9, 0.5, 0.9)
    counter.data.materials.append(wood)
    parts.append(counter)
    for k in range(6):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.8 + k * 0.32, 0, 1.95 - abs(k - 2.5) * 0.02))
        stripe = bpy.context.active_object
        stripe.scale = (0.32, 1.5, 0.06)
        stripe.rotation_euler = (0.18, 0, 0)
        stripe.data.materials.append(cloth_a if k % 2 else cloth_b)
        parts.append(stripe)
    for o in parts:
        kit.world_uvs(o, 0.8) if o.data.materials[0] in (wood,) else None
    obj = kit.join(parts, 'Stall')
    obj.location = B(x, z, height(x, z))
    obj.rotation_euler = (0, 0, face)
    return obj


def hut(x, z, face, scale=1.0):
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.75))
    body = bpy.context.active_object
    body.scale = (2.0, 1.6, 1.5)
    body.data.materials.append(wood)
    kit.world_uvs(body, 1.0)
    parts.append(body)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.9, radius2=0.05, depth=1.4, location=(0, 0, 2.15))
    rf = bpy.context.active_object
    rf.rotation_euler = (0, 0, math.pi / 4)
    rf.scale = (1.15, 0.95, 1)
    rf.data.materials.append(roof)
    kit.world_uvs(rf, 1.2)
    parts.append(rf)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.81, 0.55))
    door = bpy.context.active_object
    door.scale = (0.5, 0.04, 0.9)
    door.data.materials.append(kit.flat('Door', '#4b2f22', rough=0.8))
    parts.append(door)
    obj = kit.join(parts, 'Hut')
    obj.location = B(x, z, height(x, z))
    obj.rotation_euler = (0, 0, face)
    obj.scale = (scale,) * 3
    return obj


def bank(x, z, face):
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.9))
    body = bpy.context.active_object
    body.scale = (2.2, 1.8, 1.8)
    body.data.materials.append(stone)
    kit.world_uvs(body, 1.2)
    parts.append(body)
    for dx in (-0.8, -0.27, 0.27, 0.8):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=1.7, location=(dx, -1.0, 0.85))
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(cloth_b)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.75, radius2=0.0, depth=0.8, location=(0, 0, 2.2))
    tri = bpy.context.active_object
    tri.rotation_euler = (0, 0, math.pi / 4)
    tri.scale = (1.0, 0.8, 1)
    tri.data.materials.append(gold)
    parts.append(tri)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.35, depth=0.08, location=(0, -1.02, 2.0), rotation=(math.pi / 2, 0, 0))
    coin = bpy.context.active_object
    coin.data.materials.append(gold)
    parts.append(coin)
    obj = kit.join(parts, 'Bank')
    obj.location = B(x, z, height(x, z))
    obj.rotation_euler = (0, 0, face)
    return obj


for space in spaces:
    kind = space['type']
    if kind not in ('shop', 'bank', 'lottery'):
        continue
    spot = beside(space)
    if not spot:
        continue
    x, z, face = spot
    blender_face = -face  # three Y-rotation → Blender Z-rotation
    if kind == 'shop':
        buildings.append(stall(x, z, blender_face))
    elif kind == 'bank':
        buildings.append(bank(x, z, blender_face))
    else:
        b = stall(x, z, blender_face)
        b.name = 'Lottery'
        buildings.append(b)
    occupied.append((x, z, 2.4))

# A few village huts around each district.
for q in districts:
    for k in range(2):
        a = random.uniform(0, math.tau)
        x, z = q['x'] + math.cos(a) * 4.5, q['z'] + math.sin(a) * 4.5
        if clear(x, z, 2.0):
            buildings.append(hut(x, z, -math.atan2(q['x'] - x, q['z'] - z), random.uniform(0.85, 1.1)))
            occupied.append((x, z, 2.2))

# Scatter vegetation and rocks.
placed = bushes = boulders = 0
for k in range(2600):
    x = random.uniform(-radius * 1.1, radius * 1.1)
    z = random.uniform(-radius * 1.1, radius * 1.1)
    h = height(x, z)
    if h < PATH_Y - 0.15 or h > 3.0:
        continue
    roll = random.random()
    # Palm canopies spread ~3 units: keep them well off the roads.
    if roll < 0.42 and clear(x, z, 2.9) and placed < 110:
        instance(palm, x, z, random.uniform(0.8, 1.15), sink=0.1)
        occupied.append((x, z, 1.4))
        placed += 1
    elif roll < 0.62 and clear(x, z, 0.8) and bushes < 140:
        instance(bush, x, z, random.uniform(0.7, 1.1))
        occupied.append((x, z, 0.8))
        bushes += 1
    elif roll < 0.7 and clear(x, z, 1.0) and boulders < 45:
        instance(random.choice(rocks), x, z, random.uniform(0.45, 1.2), sink=0.25)
        occupied.append((x, z, 1.0))
        boulders += 1
# Shoreline boulders.
for k in range(500):
    a = random.uniform(0, math.tau)
    r = random.uniform(radius * 0.4, radius * 1.15)
    x, z = math.cos(a) * r, math.sin(a) * r
    h = height(x, z)
    if -0.6 < h < 0.1 and path_dist(x, z) > 3 and not in_lagoon(x, z) and random.random() < 0.35:
        instance(random.choice(rocks), x, z, random.uniform(0.35, 0.8), sink=0.35)

# Hide prototypes from export.
bpy.context.scene.collection.children.unlink(protos)

for obj in list(bpy.context.scene.collection.all_objects):
    obj.select_set(True)
# 1K textures keep each board download to a few MB.
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
os.makedirs(kit.MODELS, exist_ok=True)
path = os.path.join(kit.MODELS, f'board-{BOARD}.glb')
bpy.ops.export_scene.gltf(
    filepath=path,
    export_format='GLB',
    export_apply=True,
    export_image_format='WEBP',
    export_image_quality=80,
    export_vertex_color='ACTIVE',
    export_gpu_instances=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)
print('EXPORTED', path, os.path.getsize(path), 'bytes')

# Overview render.
kit.preview(f'board-{BOARD}', [('overview', (0, -radius * 1.55, radius * 1.25), 32)], target=(0, 0, 0), size=1100, ground=False)
