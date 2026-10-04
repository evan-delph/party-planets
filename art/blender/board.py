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
# surface: 'sea' (island in water), 'lava' (island in a lava sea),
# 'clouds' (floating island over a cloud sea), 'ground' (open moon plain).
THEMES = {
    'crown': dict(
        land=('Grass', ('sparse_grass', '#2d6e25', '#b2e366', 0.9)), beach=('Sand', 'coast_sand_01'), rock=('Rock', 'coast_land_rocks_01'),
        road=('Road', 'large_sandstone_blocks'), branch=('Boardwalk', 'brown_planks_05'),
        hills=1.5, island=7.5, sea_level=0.0, seabed=-1.6, water='#2bb6c4', surface='sea', shelf=2.5,
        landmark='volcano', props='tropical', canopy=('#f25265', '#fff4dc'), fallback='#6fae4f'),
    'crater': dict(
        land=('Regolith', ('moon_dusted_02', '#5b6274', '#d3d8e3', 1.0)), beach=('Maria', ('moon_dusted_02', '#262a35', '#727a8e', 1.0)), rock=('MoonRock', 'moon_meteor_01'),
        road=('Road', 'concrete_panels'), branch=('Catwalk', 'metal_plate'),
        hills=1.1, island=11.0, sea_level=-0.2, seabed=-2.0, water='#24365e', surface='ground', shelf=3.0,
        landmark='impact', props='lunar', canopy=('#8a7cff', '#e9ecff'), fallback='#9aa1b0'),
    'fissure': dict(
        land=('Ash', ('rocky_terrain_02', '#2a2226', '#8a756d', 1.0)), beach=('Basalt', ('dark_rock', '#121014', '#4d4247', 1.0)), rock=('Obsidian', 'dark_rock'),
        road=('Road', 'volcanic_rock_tiles'), branch=('Bridge', 'metal_plate'),
        hills=1.8, island=7.0, sea_level=-0.15, seabed=-2.2, water='#ff5a14', surface='lava', shelf=1.2,
        landmark='volcano', props='volcanic', canopy=('#ff7a2e', '#2b2328'), fallback='#4a3f42'),
    'coral': dict(
        land=('Reef', ('coral_ground_02', '#6cb7a6', '#d6f6e6', 1.4)), beach=('Shell', ('coast_sand_01', '#d8b9cb', '#fff5f8', 1.0)), rock=('CoralStone', 'coral_stone_wall'),
        road=('Road', 'white_sandstone_bricks'), branch=('Cloudway', 'brown_planks_05'),
        hills=1.3, island=7.0, sea_level=-2.6, seabed=-10.0, water='#f3f0ff', surface='clouds', shelf=1.0,
        landmark='anemone', props='reef', canopy=('#ff8fc8', '#e8fbff'), fallback='#7fcfba'),
}
TH = THEMES.get(BOARD, THEMES['crown'])
random.seed(sum(map(ord, BOARD)))

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


# Impact craters for the moon, kept off the roads.
craters = []
if TH['surface'] == 'ground':
    rnd = random.Random(11)
    for k in range(400):
        x, z = rnd.uniform(-radius * 1.3, radius * 1.3), rnd.uniform(-radius * 1.3, radius * 1.3)
        r = rnd.uniform(1.6, 4.5)
        if path_dist(x, z) > r + 2.4 and all(math.hypot(x - cx, z - cz) > r + cr for cx, cz, cr in craters):
            craters.append((x, z, r))
        if len(craters) > 34:
            break


def crater_shape(x, z):
    h = 0.0
    for cx, cz, r in craters:
        t = math.hypot(x - cx, z - cz) / r
        if t < 1.6:
            # Bowl inside, raised rim around the edge.
            h += -0.55 * r * 0.35 * max(0.0, 1 - t * t) + 0.22 * r * 0.35 * math.exp(-((t - 1.0) / 0.22) ** 2)
    return h


def height(x, z):
    d = path_dist(x, z)
    dl = math.hypot(x - landmark[0], z - landmark[1])
    dd = min([math.hypot(x - q['x'], z - q['z']) for q in districts] + [99])
    # Signed distance to the coast: land hugs the roads and bulges around
    # districts and the landmark; positive inland, negative out to sea.
    shore = TH['island'] + fbm(x, z, 0.09) * 3.2
    cd = max(shore - d, 9 - dd, 12 - dl)
    if TH['surface'] == 'ground':
        cd = radius * 1.35 - math.hypot(x, z) + fbm(x, z, 0.05) * 4
    hills = max(0.0, fbm(x + 40, z - 15, 0.07, 5)) * TH['hills'] * smoothstep(2.2, 8, d)
    inland = PATH_Y - 0.05 + hills * smoothstep(2.0, 5.0, cd)
    if TH['landmark'] == 'volcano':
        # A steep cone with a lava crater at the landmark.
        tall = 8.5 if BOARD == 'crown' else 11.0
        cone = max(0.0, 1 - dl / (11.0 if BOARD == 'crown' else 13.0))
        crater = max(0.0, 1 - dl / 2.6)
        inland += tall * cone ** 1.6 * smoothstep(1.6, 4.0, d) - 2.2 * crater ** 2
    elif TH['landmark'] == 'impact':
        inland += crater_shape(x, z) * smoothstep(1.4, 2.6, d)
        basin = dl / 8.5
        inland += (-1.1 * max(0.0, 1 - basin * basin) + 0.9 * math.exp(-((basin - 1.0) / 0.18) ** 2)) * smoothstep(1.4, 3.0, d)
    shelf = TH['shelf']
    if cd >= shelf:
        h = inland
    elif cd >= 0:
        # Beach (or ash/cliff-top) shelf sloping to the waterline.
        h = TH['sea_level'] + 0.06 + (inland - TH['sea_level'] - 0.06) * smoothstep(0, shelf, cd)
    else:
        drop = 2.0 if TH['surface'] == 'clouds' else 5.5
        h = TH['sea_level'] + 0.06 + (TH['seabed'] - TH['sea_level'] - 0.06) * smoothstep(0, drop, -cd)
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
terrain.data.materials.append(kit.flat('Terrain', TH['fallback'], rough=0.9))
splat = mesh.color_attributes.new('Splat', 'FLOAT_COLOR', 'POINT')
mesh.color_attributes.active_color = splat
for v in mesh.vertices:
    x, z = v.co.x, -v.co.y
    wobble = fbm(x, z, 0.35, 3) * 0.12
    sand = 1 - smoothstep(TH['sea_level'] + 0.34, TH['sea_level'] + 0.52, v.co.z + wobble)
    if TH['surface'] == 'ground':
        # Dark maria fill crater bowls and the impact basin floor.
        sand = 1 - smoothstep(PATH_Y - 0.55, PATH_Y - 0.2, v.co.z + wobble)
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
if TH['landmark'] == 'volcano':
    lx, lz = landmark
    top = height(lx, lz)
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=2.1, fill_type='NGON', location=B(lx, lz, top + 0.35))
    lava = bpy.context.active_object
    lava.name = 'LavaPool'
    lava.data.materials.append(kit.flat('Lava', '#ff6a1a', rough=0.4, emit=4.0))
kit.world_uvs(terrain, 3.0)

# Sea plane: water, glowing lava or a soft cloud layer (three.js animates it
# by material name). The open moon plain has none.
if TH['surface'] != 'ground':
    bpy.ops.mesh.primitive_plane_add(size=size * 2.2, location=(0, 0, TH['sea_level']))
    sea = bpy.context.active_object
    sea.name = 'Sea'
    if TH['surface'] == 'lava':
        sea.data.materials.append(kit.flat('LavaSea', TH['water'], rough=0.5, emit=2.4))
    elif TH['surface'] == 'clouds':
        sea.data.materials.append(kit.flat('CloudSea', TH['water'], rough=1.0, alpha=0.92))
    else:
        sea.data.materials.append(kit.flat('Water', TH['water'], rough=0.08, alpha=0.82))
# Crater pools on the moon are frozen ice; elsewhere lagoons share the sea.
if TH['surface'] == 'ground':
    for w in lagoons:
        bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1, fill_type='NGON', location=B(w['x'], w['z'], PATH_Y - 0.55))
        ice = bpy.context.active_object
        ice.name = 'IcePool'
        ice.scale = (w['rx'] + 0.6, w['rz'] + 0.6, 1)
        ice.rotation_euler = (0, 0, w['angle'])
        ice.data.materials.append(kit.flat('Ice', TH['water'], rough=0.05, metal=0.2))

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


def join_parts(parts, name):
    obj = kit.join(parts, name)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def skin_branches(name, edges, points, radii, mat, subdiv=1):
    """Organic branching shape (coral, dead trees, kelp) from a stick skeleton."""
    m = bpy.data.meshes.new(name)
    m.from_pydata(points, edges, [])
    obj = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new('Skin', 'SKIN')
    for k, r in enumerate(radii):
        obj.data.skin_vertices[0].data[k].radius = (r, r)
    obj.data.skin_vertices[0].data[0].use_root = True
    sub = obj.modifiers.new('Sub', 'SUBSURF')
    sub.levels = subdiv
    obj.data.materials.append(mat)
    kit.apply_all(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def branch_tree(name, mat, height_, spread, depth, seed, base_r=0.18):
    """Recursive branching skeleton (coral fronds, charred trees)."""
    rnd = random.Random(seed)
    pts, edges, radii = [Vector((0, 0, 0))], [], [base_r]

    def grow(parent, direction, length, r, level):
        tip = pts[parent] + direction * length
        pts.append(tip)
        radii.append(r)
        idx = len(pts) - 1
        edges.append((parent, idx))
        if level < depth:
            for k in range(2 if level else 3):
                a = rnd.uniform(0, math.tau)
                d = (direction + Vector((math.cos(a), math.sin(a), 0)) * spread).normalized()
                grow(idx, d, length * rnd.uniform(0.6, 0.8), r * 0.68, level + 1)

    grow(0, Vector((0, 0, 1)), height_ * 0.45, base_r * 0.8, 0)
    return skin_branches(name, edges, pts, radii, mat)


def model_crystal(color, emit):
    mat = kit.flat('Crystal', color, rough=0.08, metal=0.1, emit=emit)
    parts = []
    for k in range(5):
        a = k * 1.3
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.22, radius2=0.0, depth=1.0 + (k % 3) * 0.5,
                                        location=(math.cos(a) * 0.25, math.sin(a) * 0.25, 0.4 + (k % 3) * 0.2))
        c = bpy.context.active_object
        c.rotation_euler = (math.cos(a) * 0.4, math.sin(a) * 0.4, a)
        c.data.materials.append(mat)
        parts.append(c)
    return kit.join(parts, 'Crystals')


def model_spire():
    mat = kit.flat('ObsidianGlass', '#1a1520', rough=0.12, metal=0.3)
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.7, radius2=0.05, depth=4.2, location=(0, 0, 2.1))
    s = bpy.context.active_object
    s.name = 'Spire'
    for v in s.data.vertices:
        v.co.x += noise.noise(v.co * 2.1) * 0.18
        v.co.y += noise.noise(v.co * 2.3 + Vector((5, 0, 0))) * 0.18
    s.data.materials.append(mat)
    return s


def model_basalt():
    rock_mat = mats['rock']
    parts = []
    for k in range(7):
        a = k * 2.4
        r = 0.0 if k == 0 else 0.62
        h = 1.6 - k * 0.12 + (k % 2) * 0.3
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.34, depth=h, location=(math.cos(a) * r, math.sin(a) * r, h / 2))
        c = bpy.context.active_object
        c.data.materials.append(rock_mat)
        kit.world_uvs(c, 1.0)
        parts.append(c)
    return kit.join(parts, 'Basalt')


def model_vent():
    metal = kit.scanned('VentMetal', 'metal_plate', metal=0.7)
    glow = kit.flat('VentGlow', '#ff7a2e', rough=0.3, emit=4.0)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.38, depth=2.4, location=(0, 0, 1.2))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(metal)
    kit.world_uvs(parts[-1], 0.8)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.07, location=(0, 0, 2.4))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(glow)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.06, location=(0, 0, 0.9))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(metal)
    return kit.join(parts, 'Vent')


def model_mast():
    metal = kit.scanned('MastMetal', 'metal_plate', metal=0.8)
    beacon = kit.flat('MastBeacon', '#ff4d4d', rough=0.3, emit=5.0)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.07, depth=4.5, location=(0, 0, 2.25))
    parts.append(bpy.context.active_object)
    for k in range(3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.5 + k * 1.1))
        bar = bpy.context.active_object
        bar.scale = (1.1 - k * 0.25, 0.05, 0.05)
        bar.rotation_euler = (0, 0, k * 0.9)
        parts.append(bar)
    for o in parts:
        o.data.materials.append(metal)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.13, location=(0, 0, 4.55))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(beacon)
    return kit.join(parts, 'Mast')


def model_dish():
    metal = kit.flat('DishWhite', '#e8edf3', rough=0.35, metal=0.3)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.12, depth=1.8, location=(0, 0, 0.9))
    parts.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.4, location=(0, 0, 2.0))
    bowl = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(bowl.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -0.55], context='VERTS')
    bm.to_mesh(bowl.data)
    bm.free()
    bowl.location = (0, 0, 2.6)
    bowl.rotation_euler = (math.radians(130), 0, 0)
    parts.append(bowl)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.05, depth=1.2, location=(0, -0.5, 2.6))
    parts.append(bpy.context.active_object)
    for o in parts:
        o.data.materials.append(metal)
    return kit.join(parts, 'Dish')


def model_shell(color, name='Shell'):
    mat = kit.flat(name + 'Mat', color, rough=0.35)
    lip = kit.flat('ShellLip', '#fff3f6', rough=0.3)
    parts = []
    for k in range(9):
        t = k / 8
        a = t * math.tau * 1.6
        r = 0.75 * (1 - t) + 0.08
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=r,
                                              location=(math.cos(a) * (1 - t) * 0.5, math.sin(a) * (1 - t) * 0.5, 0.5 + t * 1.6))
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(mat if k else lip)
    return join_parts(parts, name)


def model_kelp():
    mat = kit.flat('Kelp', '#3fa58a', rough=0.6)
    pts = [Vector((math.sin(k * 0.9) * 0.25, math.cos(k * 0.7) * 0.15, k * 0.55)) for k in range(10)]
    return skin_branches('Kelp', [(k, k + 1) for k in range(9)], pts, [0.12 - k * 0.008 for k in range(10)], mat)


def model_windmill():
    wood_m = kit.scanned('MillWood', 'brown_planks_05', metal=0.0)
    sail = kit.flat('MillSail', '#fff5f8', rough=0.8)
    parts = []
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=1.0, radius2=0.6, depth=4.0, location=(0, 0, 2.0))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(wood_m)
    kit.world_uvs(parts[-1], 0.8)
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 1.3, -0.75, 3.9 + math.sin(a) * 1.3))
        blade = bpy.context.active_object
        blade.scale = (2.4, 0.04, 0.5)
        blade.rotation_euler = (0, -a, 0)
        blade.data.materials.append(sail)
        parts.append(blade)
    return kit.join(parts, 'Windmill')


def model_dome():
    shell = kit.scanned('DomePanel', 'metal_plate', metal=0.6)
    glass = kit.flat('DomeWindow', '#9fe6ff', rough=0.1, emit=1.2)
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=1.7, location=(0, 0, 0))
    dome = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context='VERTS')
    bm.to_mesh(dome.data)
    bm.free()
    dome.data.materials.append(shell)
    kit.world_uvs(dome, 0.9)
    parts.append(dome)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.55, minor_radius=0.08, location=(0, 0, 0.75))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(glass)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.55, 0.5))
    door = bpy.context.active_object
    door.scale = (0.7, 0.5, 1.0)
    door.data.materials.append(shell)
    parts.append(door)
    return join_parts(parts, 'Dome')


def model_anemone():
    body = kit.flat('AnemoneBody', '#c86fd6', rough=0.4)
    tip = kit.flat('AnemoneTip', '#ffd1f0', rough=0.3, emit=1.6)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=2.2, depth=1.6, location=(0, 0, 0.8))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(body)
    for k in range(18):
        a = k * math.tau / 18
        r0 = 1.4 + (k % 3) * 0.3
        pts = [Vector((math.cos(a) * r0, math.sin(a) * r0, 1.4))]
        for s in range(1, 6):
            pts.append(pts[0] + Vector((math.cos(a) * s * 0.35, math.sin(a) * s * 0.35, s * 0.8 - (s * s) * 0.05)))
        t = skin_branches('Tentacle', [(s, s + 1) for s in range(5)], pts, [0.32, 0.28, 0.24, 0.2, 0.16, 0.13], body)
        parts.append(t)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.2, location=pts[-1])
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(tip)
    return join_parts(parts, 'Anemone')


def model_lighthouse():
    white = kit.flat('LighthouseWhite', '#f6f3ec', rough=0.6)
    red = kit.flat('LighthouseRed', '#d8404a', rough=0.6)
    lamp = kit.flat('LighthouseLamp', '#fff3b0', rough=0.2, emit=6.0)
    parts = []
    for k in range(5):
        bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=1.1 - k * 0.12, radius2=1.0 - (k + 1) * 0.12, depth=1.4, location=(0, 0, 0.7 + k * 1.4))
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(red if k % 2 else white)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.55, depth=0.9, location=(0, 0, 7.45))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(lamp)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.75, radius2=0.0, depth=0.8, location=(0, 0, 8.3))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(red)
    return join_parts(parts, 'Lighthouse')


# ── Theme prop sets ─────────────────────────────────────────────────────────
rocks = [stash(model_rock(s)) for s in range(3)]
# (prototype, clearance, max count, scale range, sink)
flora = []
if TH['props'] == 'tropical':
    flora = [(stash(model_palm()), 2.9, 110, (0.8, 1.15), 0.1), (stash(model_bush()), 0.8, 140, (0.7, 1.1), 0.05)]
elif TH['props'] == 'lunar':
    flora = [(stash(model_crystal('#7cf3ff', 1.4)), 1.0, 40, (0.6, 1.3), 0.1)]
elif TH['props'] == 'volcanic':
    dead = kit.flat('Charred', '#231c1e', rough=0.9)
    flora = [(stash(model_spire()), 1.5, 28, (0.6, 1.4), 0.2),
             (stash(model_basalt()), 1.2, 30, (0.7, 1.3), 0.15),
             (stash(branch_tree('DeadTree', dead, 3.2, 0.7, 2, 3, 0.16)), 1.6, 34, (0.8, 1.2), 0.05),
             (stash(model_crystal('#ff8a3d', 2.2)), 1.0, 26, (0.5, 1.0), 0.1)]
elif TH['props'] == 'reef':
    coral_colors = ['#ff8fb8', '#b48cff', '#6fd3e6', '#ffb35c']
    corals = [stash(branch_tree(f'Coral{k}', kit.flat(f'Coral{k}', c, rough=0.45), 2.6, 0.9, 2, 10 + k, 0.2))
              for k, c in enumerate(coral_colors)]
    flora = [(c, 1.3, 26, (0.7, 1.3), 0.05) for c in corals]
    flora += [(stash(model_shell('#f7c6dd')), 1.2, 18, (0.6, 1.1), 0.1), (stash(model_kelp()), 0.8, 36, (0.8, 1.4), 0.05)]

# Landmark first so scatter keeps clear of it.
occupied.append((landmark[0], landmark[1], 9.0))
for q in districts:
    occupied.append((q['x'], q['z'], 2.5))

# Buildings beside special spaces, set back from the road and facing it.
wood = kit.scanned('Wood', 'brown_planks_05', metal=0.0)
roof = kit.scanned('RoofTiles', 'clay_roof_tiles_02', metal=0.0)
cloth_a = kit.flat('CanopyA', TH['canopy'][0], rough=0.85)
cloth_b = kit.flat('CanopyB', TH['canopy'][1], rough=0.85)
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


def place_obj(obj, x, z, face, scale=1.0):
    obj.location = B(x, z, height(x, z))
    obj.rotation_euler = (0, 0, face)
    obj.scale = (scale,) * 3
    return obj


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
    kit.world_uvs(counter, 0.8)
    parts.append(counter)
    for k in range(6):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.8 + k * 0.32, 0, 1.95 - abs(k - 2.5) * 0.02))
        stripe = bpy.context.active_object
        stripe.scale = (0.32, 1.5, 0.06)
        stripe.rotation_euler = (0.18, 0, 0)
        stripe.data.materials.append(cloth_a if k % 2 else cloth_b)
        parts.append(stripe)
    return place_obj(kit.join(parts, 'Stall'), x, z, face)


def hut(x, z, face, scale=1.0):
    if TH['props'] == 'lunar':
        return place_obj(model_dome(), x, z, face, scale)
    if TH['props'] == 'reef':
        return place_obj(model_shell('#ffd9e8', 'ShellHouse'), x, z, face, scale * 1.6)
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.75))
    body = bpy.context.active_object
    body.scale = (2.0, 1.6, 1.5)
    body.data.materials.append(stone if TH['props'] == 'volcanic' else wood)
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
    return place_obj(kit.join(parts, 'Hut'), x, z, face, scale)


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
    return place_obj(kit.join(parts, 'Bank'), x, z, face)


for space in spaces:
    kind = space['type']
    if kind not in ('shop', 'bank', 'lottery'):
        continue
    spot = beside(space)
    if not spot:
        continue
    x, z, face = spot
    blender_face = -face  # three Y-rotation → Blender Z-rotation
    if kind == 'bank':
        buildings.append(bank(x, z, blender_face))
    else:
        b = stall(x, z, blender_face)
        b.name = 'Lottery' if kind == 'lottery' else 'Shop'
        buildings.append(b)
    occupied.append((x, z, 2.4))

# District landmarks and village buildings.
for q in districts:
    kind = q['kind']
    special = {'lighthouse': model_lighthouse, 'observatory': model_dome, 'windmill': model_windmill,
               'vents': model_vent, 'heart': model_anemone}.get(kind)
    if special and (kind == 'heart' or clear(q['x'], q['z'], 1.5)):
        obj = special()
        place_obj(obj, q['x'], q['z'], random.uniform(0, math.tau), 2.2 if kind == 'observatory' else 1.0)
        buildings.append(obj)
    for k in range(2):
        a = random.uniform(0, math.tau)
        x, z = q['x'] + math.cos(a) * 4.5, q['z'] + math.sin(a) * 4.5
        if clear(x, z, 2.0):
            buildings.append(hut(x, z, -math.atan2(q['x'] - x, q['z'] - z), random.uniform(0.85, 1.1)))
            occupied.append((x, z, 2.2))
# Theme set-pieces: moon masts and a dish; volcano vents; harbor-side huts.
if TH['props'] == 'lunar':
    mast, dish = stash(model_mast()), stash(model_dish())
    for k in range(10):
        q = random.choice(districts)
        a = random.uniform(0, math.tau)
        x, z = q['x'] + math.cos(a) * 6, q['z'] + math.sin(a) * 6
        if clear(x, z, 1.0):
            instance(dish if k % 4 == 0 else mast, x, z, random.uniform(0.9, 1.2), sink=0.0)
            occupied.append((x, z, 1.2))
if TH['props'] == 'volcanic':
    vent = stash(model_vent())
    for k in range(14):
        x, z = random.uniform(-radius, radius), random.uniform(-radius, radius)
        if clear(x, z, 1.2):
            instance(vent, x, z, random.uniform(0.8, 1.2), sink=0.1)
            occupied.append((x, z, 1.2))

# Scatter flora and rocks.
counts = [0] * len(flora)
boulders = 0
for k in range(3000):
    x = random.uniform(-radius * 1.15, radius * 1.15)
    z = random.uniform(-radius * 1.15, radius * 1.15)
    h = height(x, z)
    if h < PATH_Y - 0.15 or h > 3.0:
        continue
    roll = random.random()
    if flora and roll < 0.7:
        i = random.randrange(len(flora))
        proto, clearance, limit, (lo, hi), sink = flora[i]
        if counts[i] < limit and clear(x, z, clearance):
            instance(proto, x, z, random.uniform(lo, hi), sink=sink)
            occupied.append((x, z, max(0.8, clearance * 0.5)))
            counts[i] += 1
    elif roll < 0.82 and boulders < (90 if TH['props'] == 'lunar' else 45) and clear(x, z, 1.0):
        instance(random.choice(rocks), x, z, random.uniform(0.45, 1.2), sink=0.25)
        occupied.append((x, z, 1.0))
        boulders += 1
# Shoreline boulders (or floating islets under a sky island).
for k in range(500):
    a = random.uniform(0, math.tau)
    r = random.uniform(radius * 0.4, radius * 1.15)
    x, z = math.cos(a) * r, math.sin(a) * r
    h = height(x, z)
    near_shore = TH['sea_level'] - 0.6 < h < TH['sea_level'] + 0.1
    if near_shore and path_dist(x, z) > 3 and not in_lagoon(x, z) and random.random() < 0.35:
        islet = instance(random.choice(rocks), x, z, random.uniform(0.35, 0.8), sink=0.35)
        if TH['surface'] == 'clouds':
            islet.location.z = TH['sea_level'] + random.uniform(1.0, 3.5)
            islet.scale = (random.uniform(0.6, 1.4),) * 3


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