"""Run by Blender only: trusted renderer, untrusted JSON scene data (no eval/exec)."""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
manifest = json.loads(Path(args[0]).read_text())
out = Path(args[1])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
# Cycles works on CPU in headless deployments and avoids an OpenGL display requirement.
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = manifest['width']
scene.render.resolution_y = manifest['height']
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.fps = manifest['fps']
scene.view_settings.view_transform = 'AgX' if bpy.app.version >= (4, 0, 0) else 'Filmic'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65, .72, .85, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
width, height = manifest['width'], manifest['height']

def matrix(values):
    # Three.js stores matrices column-major; mathutils accepts row-major.
    return Matrix([[values[col * 4 + row] for col in range(4)] for row in range(4)])

def rgb(hex_value):
    value = str(hex_value).lstrip('#')
    if len(value) == 3:
        value = ''.join(char * 2 for char in value)
    if len(value) != 6:
        value = '64748b'
    # THREE.Color.getHexString uses sRGB; Blender shader colors are linear.
    result = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in result)

def area(name, position, energy, size, color):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = energy
    light.shape = 'DISK'
    light.size = size
    light.color = color
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((width / 2, -height / 2, 0)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

# Pixel coordinates are scene units; area light energy scales with area.
area('Key softbox', (width * .15, height * .35, 850), 12 * width * height, width * .7, (1, .93, .85))
area('Cool fill', (width * 1.1, -height * .55, 600), 4 * width * height, width * .6, (.65, .78, 1))
area('Rim', (width * .8, -height * .1, -450), 8 * width * height, width * .4, (.6, .8, 1))
cam = bpy.data.cameras.new('Camera')
camera = bpy.data.objects.new('Camera', cam)
scene.collection.objects.link(camera)
scene.camera = camera
cam.clip_start = .1
cam.clip_end = 20000
cam.sensor_fit = 'HORIZONTAL'

for segment in manifest['segments']:
    objects = []
    for number, geometry in enumerate(segment['geometry']):
        kind = geometry['kind']
        if kind == 'text':
            data = bpy.data.curves.new('Label', 'FONT')
            data.body = geometry.get('text', '')
            data.align_x = 'CENTER'
            data.align_y = 'CENTER'
            data.size = .7
            data.extrude = 0
        elif kind == 'line':
            data = bpy.data.curves.new('Connection', 'CURVE')
            data.dimensions = '3D'
            data.bevel_depth = .8
            data.bevel_resolution = 3
            vertices = geometry['vertices']
            if len(vertices) >= 2:
                spline = data.splines.new('POLY')
                spline.points.add(len(vertices) - 1)
                for point, value in zip(spline.points, vertices):
                    point.co = (*value, 1)
        else:
            vertices, indices = geometry['vertices'], geometry['indices']
            faces = [indices[i:i + 3] for i in range(0, len(indices) - 2, 3)]
            data = bpy.data.meshes.new('Mesh')
            data.from_pydata(vertices, [], faces)
            data.update()
            for polygon in data.polygons:
                polygon.use_smooth = len(vertices) > 30
        obj = bpy.data.objects.new('Node-' + str(number), data)
        scene.collection.objects.link(obj)
        material = bpy.data.materials.new('Material-' + str(number))
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = max(.05, min(1, geometry.get('roughness', .5)))
        shader.inputs['Metallic'].default_value = max(0, min(1, geometry.get('metalness', .08)))
        obj.data.materials.append(material)
        if kind == 'mesh' and len(geometry['vertices']) <= 30:
            bevel = obj.modifiers.new('Soft edges', 'BEVEL')
            bevel.width = 2
            bevel.segments = 3
            bevel.limit_method = 'ANGLE'
            if hasattr(data, 'use_auto_smooth'):
                data.use_auto_smooth = True
            obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        objects.append((obj, shader, geometry))
    for number, sample in enumerate(segment['samples']):
        settings = sample['camera']
        camera.matrix_world = matrix(settings['matrix'])
        cam.type = 'PERSP' if settings['perspective'] else 'ORTHO'
        cam.ortho_scale = width
        # Three.js fov is vertical; Blender horizontal angle uses aspect conversion.
        cam.angle = 2 * math.atan(math.tan(math.radians(settings['fov']) / 2) * width / height)
        for (obj, shader, geometry), state in zip(objects, sample['nodes']):
            obj.matrix_world = matrix(state['matrix'])
            obj.hide_render = not state['visible']
            color = rgb(geometry.get('color', state['color']))
            shader.inputs['Base Color'].default_value = (*color, 1)
            shader.inputs['Alpha'].default_value = max(0, min(1, state.get('opacity', 1)))
            emission = shader.inputs.get('Emission Color') or shader.inputs.get('Emission')
            emission.default_value = (*rgb(state.get('emission', '000000')), 1)
            strength = shader.inputs.get('Emission Strength')
            if strength:
                strength.default_value = 1.4
            if geometry['kind'] == 'text':
                location, rotation, scale = obj.matrix_world.decompose()
                obj.rotation_euler = camera.rotation_euler
                # Sprite dimensions contain its width/height; normalize glyph width.
                obj.scale = (1, 1, 1)
                bpy.context.view_layer.update()
                text_width = max(.001, obj.dimensions.x)
                text_height = max(.001, obj.dimensions.y)
                factor = min(scale.x * geometry.get('widthRatio', .5) / text_width,
                             scale.y * geometry.get('heightRatio', .42) / text_height)
                # Three.js sprites use depthTest=false. Place labels on a near-camera
                # plane while preserving their screen projection and size.
                point = camera.matrix_world.inverted() @ location
                ratio = 1
                if settings['perspective']:
                    ratio = 20 / max(.1, -point.z)
                    point.x *= ratio
                    point.y *= ratio
                point.z = -20
                obj.location = camera.matrix_world @ point
                obj.scale = (factor * ratio, factor * ratio, factor * ratio)
                emission.default_value = (*color, 1)
                if strength:
                    strength.default_value = 1
        scene.render.filepath = str(out / ('frame-%06d.png' % (segment['start'] + number)))
        try:
            bpy.ops.render.render(write_still=True)
        except RuntimeError as failure:
            # Some Linux distribution builds omit OpenImageDenoise.
            if 'denois' not in str(failure).lower():
                raise
            scene.cycles.use_denoising = False
            scene.cycles.samples = 96
            bpy.ops.render.render(write_still=True)
        print('SKETCHYDRAW_FRAME %d' % (segment['start'] + number), flush=True)
    for obj, shader, geometry in objects:
        data = obj.data
        material = obj.data.materials[0]
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.materials.remove(material)
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        else:
            bpy.data.curves.remove(data)
