"""Shared helpers for Party Planets Blender asset scripts.

Import from a script run by Blender:
    sys.path.insert(0, os.path.dirname(__file__)); import kit
Conventions: Blender Z-up, front faces -Y (becomes +Z toward the camera in
three.js). Scale is in board units (an alien is about 2 units tall).
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCE = os.path.join(ROOT, 'art', 'source', 'polyhaven')
MODELS = os.path.join(ROOT, 'public', 'models')
RENDERS = os.path.join(ROOT, 'art', 'renders')


def reset(fps=24):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = fps
    return scene


def linear(hex_color):
    h = hex_color.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


_cache = {}


def _image(path, non_color):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def scanned(name, asset, res='1k', tint=None, rough_bias=0.0, metal=None):
    """PBR material from a Poly Haven set: diffuse, GL normal, ARM (AO/rough/metal).

    The glTF exporter turns Separate Color G/B of the ARM map into a packed
    metallic-roughness texture. `metal` overrides the scanned metalness.
    """
    key = (name, asset, res, tint, rough_bias, metal)
    if key in _cache:
        return _cache[key]
    base = os.path.join(SOURCE, asset, f'{asset}_{{}}_{res}.jpg')
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    diff = nt.nodes.new('ShaderNodeTexImage')
    diff.image = _image(base.format('Diffuse'), False)
    nt.links.new(diff.outputs['Color'], bsdf.inputs['Base Color'])
    if tint:
        # Tints are applied in three.js by material name (exporter-safe).
        m['tint'] = tint
    arm = nt.nodes.new('ShaderNodeTexImage')
    arm.image = _image(base.format('arm'), True)
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(arm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    if metal is None:
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    else:
        bsdf.inputs['Metallic'].default_value = metal
    nor = nt.nodes.new('ShaderNodeTexImage')
    nor.image = _image(base.format('nor_gl'), True)
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(nor.outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    _cache[key] = m
    return m


def flat(name, color, rough=0.5, metal=0.0, emit=0.0, alpha=1.0):
    if name in _cache:
        return _cache[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = linear(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = linear(color)
        bsdf.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except AttributeError:
            m.blend_method = 'BLEND'
    _cache[name] = m
    return m


def world_uvs(obj, scale=1.0):
    """Box-project UVs at a fixed world density so tiling textures match across props."""
    bpy.context.view_layer.update()
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    mw = obj.matrix_world
    for face in bm.faces:
        n = (mw.to_3x3() @ face.normal).normalized()
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in face.loops:
            p = mw @ loop.vert.co
            u, v = [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax]
            loop[uv].uv = (u / scale, v / scale)
    bm.to_mesh(me)
    bm.free()


def smooth(obj, angle=40):
    for p in obj.data.polygons:
        p.use_smooth = True
    try:
        mod = obj.modifiers.new('Smooth', 'SMOOTH_BY_ANGLE')
        mod['Input_1'] = math.radians(angle)
    except Exception:
        pass


def lathe(name, profile, steps=96, close_top=True):
    """Spin a (radius, height) profile around Z into a solid of revolution."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(steps):
        a_ring, b_ring = rings[i], rings[(i + 1) % steps]
        for j in range(len(profile) - 1):
            bm.faces.new((a_ring[j], b_ring[j], b_ring[j + 1], a_ring[j + 1]))
    if profile[0][0] > 1e-4:
        bm.faces.new([ring[0] for ring in reversed(rings)])
    if close_top and profile[-1][0] > 1e-4:
        bm.faces.new([ring[-1] for ring in rings])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add(op, name, mat, **kw):
    getattr(bpy.ops.mesh, op)(**kw)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def strut(name, a, b, radius, mat, vertices=16):
    """Cylinder spanning two points (legs, pipes, rails)."""
    a, b = Vector(a), Vector(b)
    axis = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=axis.length, location=(a + b) / 2)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(axis.normalized())
    obj.data.materials.append(mat)
    return obj


def parent(obj, to):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = to
    obj.matrix_world = world


def apply_all(obj):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def join(objects, name):
    for o in objects:
        apply_all(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = objects[0].data.name = name
    return objects[0]


def export(name, animations=False):
    os.makedirs(MODELS, exist_ok=True)
    path = os.path.join(MODELS, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_apply=True,
        export_animations=animations,
        export_image_format='WEBP',
        export_image_quality=82,
        export_yup=True,
    )
    print('EXPORTED', path, os.path.getsize(path), 'bytes')
    return path


def preview(name, shots, target=(0, 0, 1), size=900, sky='#a9c9e6'):
    """Render EEVEE previews: shots = [(label, (x, y, z), lens)]."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new('PreviewWorld')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = linear(sky)
    bg.inputs['Strength'].default_value = 0.8
    sun = bpy.data.objects.new('PreviewSun', bpy.data.lights.new('PreviewSun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(48), math.radians(12), math.radians(-38))
    scene.collection.objects.link(sun)
    fill = bpy.data.objects.new('PreviewFill', bpy.data.lights.new('PreviewFill', 'AREA'))
    fill.data.energy = 600
    fill.data.size = 6
    fill.location = (6, -7, 5)
    fill.rotation_euler = (math.radians(60), 0, math.radians(40))
    scene.collection.objects.link(fill)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.data.materials.append(flat('PreviewGround', '#7f8f84', rough=0.95))
    cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = size
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    os.makedirs(RENDERS, exist_ok=True)
    for label, loc, lens in shots:
        cam.location = loc
        cam.data.lens = lens
        cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(RENDERS, f'{name}-{label}.png')
        bpy.ops.render.render(write_still=True)
        print('RENDERED', scene.render.filepath)
