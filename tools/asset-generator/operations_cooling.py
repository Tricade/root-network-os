"""Original room air handler and upgraded central chiller geometry.

Both consume the existing local PBR materials. The air handler contains only a
water coil and air movers; refrigeration compressors belong to the central plant.
"""
from gltf_builder import MeshBuilder


def air_handler(asset, box, cylinder, add_led):
    def detail(doc, lod, dims):
        shell = MeshBuilder("air_handler_casing_mesh")
        box(shell, (1.70, 0.86, 0.44), (0, 1.02, 0), "mat_powder_coat_medium", 0.025)
        # Closed service spine and two replaceable fan/filter cassettes. A real
        # plenum sits below this module in the room assembly, connected to the floor.
        for x in (-0.425, 0.425):
            box(shell, (0.80, 0.70, 0.025), (x, 1.00, 0.232), "mat_powder_coat_dark", 0.012)
            cylinder(shell, 0.233, 0.016, (x, 1.00, 0.25), "mat_brushed_metal", 36)
            cylinder(shell, 0.211, 0.02, (x, 1.00, 0.264), "mat_plastic_abs", 36)
            for z in (-0.22, 0.18):
                box(shell, (0.024, 0.83, 0.025), (x + 0.39, 1.02, z), "mat_brushed_metal")
            # Fine fixed guards in front of the independent rotating fan.
            for i in range(11):
                y = 0.79 + i * 0.042
                half = max(0, 0.214**2 - (y - 1.0)**2)**0.5
                if half > 0.015:
                    box(shell, (half * 2, 0.007, 0.009), (x, y, 0.32), "mat_brushed_metal")
        doc.add_node("air_handler_closed_casing_and_guards", mesh_builder=shell, parent_idx=lod)
        for i, x in enumerate((-0.425, 0.425)):
            fan = MeshBuilder("room_air_fan_mesh_" + str(i))
            fan.add_fan_rotor(0.195, 0.021, blade_count=7,
                             material_hub="mat_brushed_metal", material_blades="mat_heatsink_metal")
            doc.add_node("room_air_fan_" + str(i + 1), mesh_builder=fan,
                         translation=(x, 1.0, 0.285), parent_idx=lod,
                         extras={"animated": True, "rotationAxis": "z"})
        ports = MeshBuilder("air_handler_water_ports_mesh")
        for x, z in ((-0.32, 0.09), (0.32, -0.10)):
            ports.add_cylinder(0.065, 0.055, segments=20, center=(x, 1.46, z), axis="y",
                               material="mat_brushed_metal")
        doc.add_node("air_handler_chw_in_out", mesh_builder=ports, parent_idx=lod,
                     extras={"supply": [-0.32, 1.48, 0.09], "return": [0.32, 1.48, -0.10]})
        for i, x in enumerate((-0.72, -0.66)):
            add_led(doc, lod, "led_air_handler_" + str(i), (x, 1.385, 0.23), "mat_led_power")
    return asset("room_air_handler", "room_air_distribution", (1.70, 1.49, 0.65), detail,
                 extras={"function": "chilled-water coil and fans; no refrigeration compressor"})


def central_chiller(asset, box, cylinder, add_led):
    def detail(doc, lod, dims):
        body = MeshBuilder("central_chiller_cabinet_mesh")
        box(body, (1.0, 0.10, 0.86), (0, 0.05, 0), "mat_arch_steel", 0.015)
        box(body, (0.96, 1.96, 0.82), (0, 1.08, 0), "mat_powder_coat_medium", 0.022)
        # Separate sealed service panels, deliberate seams, recessed air grilles.
        for x in (-0.235, 0.235):
            box(body, (0.45, 1.48, 0.025), (x, 0.85, 0.43), "mat_powder_coat_dark", 0.009)
            box(body, (0.38, 0.64, 0.014), (x, 1.15, 0.45), "mat_plastic_abs", 0.008)
            for j in range(18):
                box(body, (0.35, 0.012, 0.014), (x, 0.86 + j * 0.032, 0.465), "mat_heatsink_metal")
            box(body, (0.025, 0.18, 0.025), (x + 0.16, 0.65, 0.46), "mat_brushed_metal", 0.006)
            for y in (0.20, 1.50):
                for sx in (-0.18, 0.18):
                    body.add_knurled_screw((x + sx, y, 0.451), radius=0.008, depth=0.008)
        box(body, (0.92, 0.35, 0.025), (0, 1.82, 0.43), "mat_powder_coat_dark", 0.01)
        # A removable crown encloses the manifold; fittings connect to room headers.
        box(body, (1.0, 0.035, 0.87), (0, 2.0825, 0), "mat_arch_steel", 0.008)
        doc.add_node("central_chiller_enclosed_panels", mesh_builder=body, parent_idx=lod)
        for i, x in enumerate((-0.13, 0, 0.13)):
            add_led(doc, lod, "led_chiller_" + str(i), (x, 1.66, 0.452),
                    "mat_led_power" if i == 0 else "mat_led_activity")
    return asset("central_chiller_module", "plant_cooling", (1.0, 2.10, 0.96), detail,
                 extras={"function": "central enclosed refrigeration module", "upgradeFromLevel": 2})


def enclosed_pump(asset, box, cylinder, add_led):
    def detail(doc, lod, dims):
        cabinet = MeshBuilder("enclosed_pump_casing_mesh")
        box(cabinet, (1.30, 0.10, 0.96), (0, 0.05, 0), "mat_arch_steel", 0.018)
        box(cabinet, (1.26, 1.40, 0.87), (0, 0.80, 0), "mat_powder_coat_medium", 0.028)
        for x in (-0.31, 0.31):
            box(cabinet, (0.595, 1.22, 0.026), (x, 0.79, 0.45), "mat_powder_coat_dark", 0.012)
            box(cabinet, (0.025, 0.20, 0.032), (x + 0.23, 0.85, 0.48), "mat_brushed_metal", 0.006)
            for i in range(10):
                box(cabinet, (0.47, 0.014, 0.018), (x, 0.29 + i * 0.043, 0.475), "mat_heatsink_metal")
        box(cabinet, (0.27, 0.12, 0.02), (0.30, 1.08, 0.476), "mat_plastic_abs", 0.008)
        for x, z in ((-0.30, 0.34), (0.58, 0.005)):
            cabinet.add_cylinder(0.048, 0.08, segments=20, center=(x, 1.54, z), axis="y",
                                  material="mat_brushed_metal")
        doc.add_node("closed_pump_service_cabinet", mesh_builder=cabinet, parent_idx=lod)
        for name, x, y, mat in (("led_pump_run", .22, .94, "mat_led_power"),
                               ("led_pump_fault", .38, .94, "mat_led_fault"),
                               ("led_hx_flow", -.31, 1.08, "mat_led_activity")):
            add_led(doc, lod, name, (x, y, .482), mat)
    return asset("enclosed_pump_skid", "plant_cooling", (1.30, 1.58, 0.98), detail,
                 extras={"function": "enclosed pump and plate heat exchanger", "upgradeFromLevel": 2})
