#!/usr/bin/env python3
"""Build original ROOT operations and construction models into a fresh staging root.

Usage: python build_operations_assets.py --output-root PATH

Writes GLB runtime assets, editable glTF/bin sources, and a small manifest beneath
PATH/asset-pack. It never writes into the checked-out runtime pack.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HELPERS = Path(__file__).resolve().parent / "base"
sys.path.insert(0, str(HELPERS))
from gltf_builder import GltfAssetDocument, MeshBuilder  # noqa: E402
from operations_cooling import air_handler, central_chiller, enclosed_pump  # noqa: E402


MODELS: list[tuple[str, str, tuple[float, float, float], str]] = []


def box(mesh: MeshBuilder, size, center, material, bevel=0.0):
    if bevel:
        mesh.add_beveled_box(*size, bevel=bevel, center=center, material=material)
    else:
        mesh.add_box(*size, center=center, material=material)


def cylinder(mesh: MeshBuilder, radius, depth, center, material, segments=16):
    mesh.add_cylinder(radius, depth, segments=segments, center=center, axis="z", material=material)


def node_box(doc, parent, name, size, center, material, bevel=0.0, extras=None):
    mesh = MeshBuilder(name + "_mesh")
    box(mesh, size, center, material, bevel)
    return doc.add_node(name, mesh_builder=mesh, parent_idx=parent, extras=extras)


def add_led(doc, parent, name, position, material):
    mesh = MeshBuilder(name + "_mesh")
    cylinder(mesh, 0.009, 0.006, (0, 0, 0), material, 10)
    return doc.add_node(name, mesh_builder=mesh, translation=position, parent_idx=parent,
                        extras={"controllableLed": True, "ledRole": name.removeprefix("led_")})


def add_lod_and_collider(doc, root, name, dims, collider=None):
    lod1 = doc.add_node("LOD1", parent_idx=root, extras={"lodLevel": 1})
    low = MeshBuilder(name + "_LOD1_mesh")
    box(low, dims, (0, dims[1] / 2, 0), "mat_powder_coat_dark", min(0.02, min(dims) / 8))
    doc.add_node(name + "_distance_shell", mesh_builder=low, parent_idx=lod1)
    proxy = MeshBuilder("collider_" + name + "_mesh")
    box(proxy, collider or dims, (0, dims[1] / 2, 0), "mat_collider")
    doc.add_node("collider_" + name, mesh_builder=proxy, parent_idx=root,
                 extras={"collisionProxy": True, "triangleBudget": 12})


def asset(name, category, dims, detail, *, collider=None, extras=None):
    doc = GltfAssetDocument(name, {
        "category": category,
        "dimensionsM": list(dims),
        "units": "m",
        "axis": {"up": "+Y", "front": "+Z"},
        **(extras or {}),
    })
    root = doc.add_node(name, extras={
        "assetType": "operations",
        "units": "m",
        "dimensionsM": list(dims),
        "front": "+Z",
    })
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})
    detail(doc, lod0, dims)
    add_lod_and_collider(doc, root, name, dims, collider)
    MODELS.append((name, category, dims, "asset-pack/assets/operations/" + name + ".glb"))
    return doc


def pump_heat_exchanger():
    name, dims = "pump_heat_exchanger_skid", (1.25, 1.52, 0.94)

    def detail(doc, lod, d):
        w, h, dep = d
        base = MeshBuilder("pump_skid_frame_mesh")
        box(base, (w, 0.12, dep), (0, 0.06, 0), "mat_arch_steel", 0.012)
        for x in (-0.51, 0.51):
            for z in (-0.34, 0.34):
                box(base, (0.055, 0.10, 0.055), (x, 0.17, z), "mat_brushed_metal", 0.006)
        # Motor feet and a bolted instrument mast give every component a physical support.
        for x in (0.18, 0.42):
            box(base, (0.055, 0.19, 0.30), (x, 0.215, -0.08), "mat_arch_steel", 0.006)
        box(base, (0.035, 0.95, 0.035), (0.50, 0.62, -0.16), "mat_brushed_metal")
        box(base, (0.24, 0.035, 0.34), (0.40, 1.02, -0.005), "mat_brushed_metal")
        box(base, (0.34, 0.24, 0.14), (0.30, 1.08, 0.13), "mat_powder_coat_medium", 0.01)
        doc.add_node("pump_skid_frame", mesh_builder=base, parent_idx=lod)

        # Tall plate exchanger at left: casing, exposed corrugated plate pack, headers.
        hx = MeshBuilder("heat_exchanger_mesh")
        box(hx, (0.38, 1.16, 0.54), (-0.30, 0.79, -0.055), "mat_arch_steel", 0.018)
        box(hx, (0.30, 0.92, 0.025), (-0.30, 0.82, 0.225), "mat_heatsink_metal", 0.008)
        for i in range(11):
            x = -0.435 + i * 0.027
            box(hx, (0.009, 0.82, 0.012), (x, 0.82, 0.244), "mat_brushed_metal")
        for y in (0.45, 1.12):
            cylinder(hx, 0.048, 0.04, (-0.30, y, 0.285), "mat_brushed_metal", 14)
            cylinder(hx, 0.018, 0.043, (-0.30, y, 0.307), "mat_copper_heatpipe", 12)
        doc.add_node("heat_exchanger_plate_pack", mesh_builder=hx, parent_idx=lod,
                     extras={"serviceable": True, "fluidPorts": 2})

        # Right-side centrifugal pump, volute, motor and visible cooling ribs.
        pump = MeshBuilder("circulation_pump_mesh")
        box(pump, (0.40, 0.33, 0.37), (0.30, 0.44, -0.08), "mat_powder_coat_medium", 0.035)
        cylinder(pump, 0.145, 0.19, (0.30, 0.72, 0.005), "mat_arch_steel", 24)
        cylinder(pump, 0.085, 0.095, (0.30, 0.72, 0.115), "mat_brushed_metal", 18)
        for i in range(7):
            y = 0.38 + i * 0.043
            box(pump, (0.29, 0.012, 0.31), (0.30, y, -0.31), "mat_heatsink_metal")
        doc.add_node("pump_motor_and_volute", mesh_builder=pump, parent_idx=lod)

        rotor = doc.add_node("pump_rotor_pivot", translation=(0.30, 0.72, 0.17), parent_idx=lod,
                             extras={"animated": True, "rotationAxis": "z"})
        fan = MeshBuilder("pump_fan_rotor_mesh")
        fan.add_fan_rotor(0.10, 0.045, blade_count=7, material_hub="mat_brushed_metal",
                          material_blades="mat_plastic_abs")
        doc.add_node("pump_fan_01", mesh_builder=fan, parent_idx=rotor,
                     extras={"animated": True, "rotationAxis": "z"})

        pipes = MeshBuilder("pump_service_pipework_mesh")
        # Independent risers end in the two external CHW ports. The lower exchanger
        # connection feeds the pump side; no disconnected tube ends or hanging valves.
        pipes.add_tube([(-0.30, 1.12, 0.307), (-0.30, 1.18, 0.34), (-0.30, 1.42, 0.34)],
                       radius=0.022, radial_segments=12, material="mat_copper_heatpipe")
        pipes.add_tube([(-0.30, 0.45, 0.307), (-0.30, 0.27, 0.34), (0.075, 0.27, 0.34),
                        (0.075, 0.72, 0.005), (0.16, 0.72, 0.005)], radius=0.018,
                       radial_segments=12, material="mat_brushed_metal")
        pipes.add_tube([(0.44, 0.72, 0.005), (0.58, 0.72, 0.005), (0.58, 1.42, 0.005)],
                       radius=0.022, radial_segments=12, material="mat_copper_heatpipe")
        for x, z in ((-0.30, 0.34), (0.58, 0.005)):
            pipes.add_cylinder(0.042, 0.035, segments=16, center=(x, 1.42, z), axis="y",
                               material="mat_brushed_metal")
        doc.add_node("pump_and_hx_pipework", mesh_builder=pipes, parent_idx=lod)

        # Separate small black readout face for canvas replacement by the app.
        face = MeshBuilder("pump_telemetry_display_mesh")
        box(face, (0.25, 0.11, 0.012), (0.30, 1.08, 0.205), "mat_plastic_abs", 0.008)
        face.add_plane(0.22, 0.075, center=(0.30, 1.08, 0.213), facing="+z",
                       material="mat_led_activity")
        doc.add_node("pump_telemetry_display", mesh_builder=face, parent_idx=lod,
                     extras={"dynamicSurface": "facility_status_display", "replaceable": True})
        for name, x, y, mat in (("led_pump_run", 0.42, 0.98, "mat_led_power"),
                                ("led_pump_fault", 0.46, 0.98, "mat_led_fault"),
                                ("led_hx_flow", -0.44, 1.31, "mat_led_activity")):
            add_led(doc, lod, name, (x, y, 0.225), mat)
        for i in range(6):
            x = -0.36 + (i % 3) * 0.06
            y = 0.34 + (i // 3) * 0.06
            base.add_knurled_screw((x, y, 0.438), radius=0.008, depth=0.006)
        return

    return asset(name, "plant_cooling", dims, detail,
                 extras={"dynamicNodes": ["pump_fan_01", "led_pump_run", "led_pump_fault", "led_hx_flow"]})


def environment_sensor():
    name, dims = "environment_sensor_wall", (0.20, 0.28, 0.10)

    def detail(doc, lod, d):
        shell = MeshBuilder("environment_sensor_body_mesh")
        box(shell, (0.19, 0.25, 0.065), (0, 0.135, 0), "mat_powder_coat_medium", 0.025)
        box(shell, (0.145, 0.10, 0.012), (0, 0.182, 0.039), "mat_plastic_abs", 0.008)
        shell.add_plane(0.125, 0.075, center=(0, 0.182, 0.046), facing="+z", material="mat_led_activity")
        # Slotted intake allows the silhouette to read as a sensor rather than a blank wall box.
        for i in range(5):
            box(shell, (0.115, 0.006, 0.004), (0, 0.075 + i * 0.014, 0.035), "mat_vent_grille")
        for x in (-0.067, 0.067):
            cylinder(shell, 0.005, 0.004, (x, 0.235, 0.039), "mat_brushed_metal", 8)
        doc.add_node("environment_sensor_enclosure", mesh_builder=shell, parent_idx=lod,
                     extras={"mounting": "wall", "sensing": ["temperature", "humidity", "water_leak"]})
        for i, (name, x, material) in enumerate((
            ("led_sensor_temperature", -0.045, "mat_led_power"),
            ("led_sensor_humidity", 0.0, "mat_led_activity"),
            ("led_sensor_water_leak", 0.045, "mat_led_fault"),
        )):
            add_led(doc, lod, name, (x, 0.045, 0.04), material)
        # Backplate has two mounting holes; wall side faces -Z.
        plate = MeshBuilder("sensor_wall_backplate_mesh")
        box(plate, (0.18, 0.26, 0.009), (0, 0.135, -0.035), "mat_brushed_metal", 0.008)
        for y in (0.045, 0.225):
            cylinder(plate, 0.008, 0.008, (0, y, -0.042), "mat_plastic_latch", 10)
        doc.add_node("sensor_wall_backplate", mesh_builder=plate, parent_idx=lod)

    return asset(name, "environment_monitoring", dims, detail,
                 collider=(0.21, 0.29, 0.09), extras={"wallMount": True})


def maintenance_robot():
    name, dims = "maintenance_robot", (0.48, 0.61, 0.53)

    def detail(doc, lod, d):
        chassis = MeshBuilder("maintenance_rover_chassis_mesh")
        box(chassis, (0.38, 0.19, 0.43), (0, 0.18, 0), "mat_powder_coat_dark", 0.045)
        box(chassis, (0.32, 0.035, 0.32), (0, 0.295, 0), "mat_arch_steel", 0.015)
        # Front equipment bay, bumpers, service grille and top battery hatch.
        box(chassis, (0.25, 0.08, 0.04), (0, 0.17, 0.235), "mat_powder_coat_medium", 0.012)
        box(chassis, (0.19, 0.025, 0.008), (0, 0.17, 0.258), "mat_vent_grille")
        box(chassis, (0.34, 0.035, 0.42), (0, 0.31, -0.005), "mat_brushed_metal", 0.012)
        for x in (-0.18, 0.18):
            box(chassis, (0.04, 0.055, 0.44), (x, 0.12, 0), "mat_brushed_metal", 0.012)
        doc.add_node("robot_rover_chassis", mesh_builder=chassis, parent_idx=lod,
                     extras={"robotClass": "inspection_rover", "nonHumanoid": True})
        for side, x in (("left", -0.20), ("right", 0.20)):
            for index, z in enumerate((-0.135, 0.135), 1):
                pivot = doc.add_node(f"robot_wheel_{side}_{index:02d}", translation=(x, 0.115, z),
                                     parent_idx=lod, extras={"animated": True, "rotationAxis": "x"})
                wheel = MeshBuilder(f"robot_wheel_{side}_{index:02d}_mesh")
                wheel.add_cylinder(0.078, 0.048, segments=16, center=(0, 0, 0), axis="x",
                                   material="mat_rubber_epdm")
                cylinder(wheel, 0.035, 0.052, (0, 0, 0), "mat_brushed_metal", 12)
                doc.add_node(f"robot_wheel_{side}_{index:02d}_tire", mesh_builder=wheel, parent_idx=pivot)
        mast = MeshBuilder("robot_sensor_mast_mesh")
        box(mast, (0.045, 0.15, 0.045), (0, 0.405, -0.06), "mat_brushed_metal", 0.008)
        box(mast, (0.18, 0.09, 0.13), (0, 0.515, -0.06), "mat_powder_coat_medium", 0.025)
        # Distinct twin optical windows, one lidar puck and tiny front range sensors.
        box(mast, (0.048, 0.032, 0.008), (-0.043, 0.52, 0.01), "mat_glass_tinted", 0.005)
        box(mast, (0.048, 0.032, 0.008), (0.043, 0.52, 0.01), "mat_glass_tinted", 0.005)
        cylinder(mast, 0.029, 0.025, (0, 0.57, -0.06), "mat_brushed_metal", 16)
        for x in (-0.105, 0.105):
            cylinder(mast, 0.012, 0.008, (x, 0.20, 0.24), "mat_plastic_abs", 12)
        doc.add_node("robot_lidar_camera_mast", mesh_builder=mast, parent_idx=lod)
        for name, x, material in (("led_robot_charge", -0.13, "mat_led_power"),
                                  ("led_robot_fault", -0.09, "mat_led_fault"),
                                  ("led_robot_task", 0.13, "mat_led_activity")):
            add_led(doc, lod, name, (x, 0.355, 0.19), material)
        antenna = MeshBuilder("robot_antenna_mesh")
        antenna.add_tube([(0, 0, 0), (0, 0.075, 0), (0.025, 0.10, 0)], radius=0.004,
                         radial_segments=6, material="mat_brushed_metal")
        doc.add_node("robot_wireless_antenna", mesh_builder=antenna, translation=(0.12, 0.37, -0.12), parent_idx=lod)

    return asset(name, "maintenance_robot", dims, detail,
                 collider=(0.49, 0.58, 0.53), extras={"dynamicNodes": ["robot_wheel_left_01", "robot_wheel_left_02", "robot_wheel_right_01", "robot_wheel_right_02"]})


def robot_dock():
    name, dims = "maintenance_robot_dock", (0.70, 0.67, 0.75)

    def detail(doc, lod, d):
        shell = MeshBuilder("robot_dock_body_mesh")
        box(shell, (0.68, 0.11, 0.72), (0, 0.055, 0), "mat_arch_steel", 0.02)
        box(shell, (0.63, 0.43, 0.13), (0, 0.32, -0.25), "mat_powder_coat_dark", 0.025)
        box(shell, (0.54, 0.32, 0.075), (0, 0.27, 0.06), "mat_powder_coat_medium", 0.022)
        # Open-front charging recess with guide horns and metal contacts.
        for x in (-0.25, 0.25):
            box(shell, (0.055, 0.38, 0.12), (x, 0.32, 0.12), "mat_brushed_metal", 0.014)
            cylinder(shell, 0.018, 0.025, (x * 0.52, 0.23, 0.158), "mat_gold_contacts", 10)
        box(shell, (0.42, 0.045, 0.12), (0, 0.49, 0.13), "mat_arch_steel", 0.01)
        doc.add_node("robot_dock_charging_bay", mesh_builder=shell, parent_idx=lod)
        face = MeshBuilder("robot_dock_display_mesh")
        box(face, (0.20, 0.10, 0.012), (0, 0.55, -0.175), "mat_plastic_abs", 0.008)
        face.add_plane(0.17, 0.072, center=(0, 0.55, -0.167), facing="+z", material="mat_led_activity")
        doc.add_node("robot_dock_display", mesh_builder=face, parent_idx=lod,
                     extras={"dynamicSurface": "maintenance_dock_status", "replaceable": True})
        for i, (name, material) in enumerate((("led_dock_charge", "mat_led_power"), ("led_dock_fault", "mat_led_fault"))):
            add_led(doc, lod, name, (-0.07 + i * 0.14, 0.56, -0.154), material)

    return asset(name, "maintenance_robot", dims, detail, extras={"robotBay": True})


def tool_cart():
    name, dims = "maintenance_tool_cart", (0.72, 0.98, 0.52)

    def detail(doc, lod, d):
        frame = MeshBuilder("tool_cart_frame_mesh")
        box(frame, (0.68, 0.055, 0.46), (0, 0.16, 0), "mat_arch_steel", 0.012)
        box(frame, (0.68, 0.045, 0.46), (0, 0.51, 0), "mat_arch_steel", 0.01)
        box(frame, (0.68, 0.06, 0.46), (0, 0.84, 0), "mat_powder_coat_medium", 0.012)
        for x in (-0.30, 0.30):
            for z in (-0.19, 0.19):
                box(frame, (0.035, 0.72, 0.035), (x, 0.50, z), "mat_brushed_metal")
        doc.add_node("tool_cart_frame_and_shelves", mesh_builder=frame, parent_idx=lod)
        drawers = MeshBuilder("tool_cart_drawers_mesh")
        for i, y in enumerate((0.29, 0.45, 0.62)):
            box(drawers, (0.57, 0.115, 0.035), (0, y, 0.221), "mat_powder_coat_dark", 0.008)
            box(drawers, (0.13, 0.018, 0.022), (0, y + 0.015, 0.246), "mat_brushed_metal", 0.006)
            for x in (-0.23, 0.23):
                cylinder(drawers, 0.006, 0.005, (x, y, 0.245), "mat_brushed_metal", 8)
        doc.add_node("tool_cart_drawers", mesh_builder=drawers, parent_idx=lod,
                     extras={"serviceDrawers": 3})
        for side, x in (("left", -0.29), ("right", 0.29)):
            for index, z in enumerate((-0.17, 0.17), 1):
                pivot = doc.add_node(f"cart_wheel_{side}_{index:02d}", translation=(x, 0.09, z),
                                     parent_idx=lod, extras={"animated": True, "rotationAxis": "x"})
                wheel = MeshBuilder(f"cart_wheel_{side}_{index:02d}_mesh")
                wheel.add_cylinder(0.065, 0.038, segments=12, center=(0, 0, 0), axis="x", material="mat_rubber_epdm")
                doc.add_node(f"cart_wheel_{side}_{index:02d}_tire", mesh_builder=wheel, parent_idx=pivot)
        handle = MeshBuilder("tool_cart_push_handle_mesh")
        handle.add_tube([(-0.25, 0, 0), (-0.25, 0.12, 0), (0.25, 0.12, 0), (0.25, 0, 0)],
                        radius=0.012, radial_segments=8, material="mat_brushed_metal")
        doc.add_node("tool_cart_push_handle", mesh_builder=handle, translation=(0, 0.83, -0.19), parent_idx=lod)
        for name, x, material in (("led_cart_inventory", -0.22, "mat_led_activity"), ("led_cart_lock", 0.22, "mat_led_power")):
            add_led(doc, lod, name, (x, 0.775, 0.245), material)

    return asset(name, "maintenance_robot", dims, detail, collider=(0.74, 0.93, 0.50))


def site_barrier():
    name, dims = "site_barrier_segment", (1.70, 1.08, 0.20)

    def detail(doc, lod, d):
        metal = MeshBuilder("site_barrier_frame_mesh")
        box(metal, (1.50, 0.045, 0.07), (0, 0.22, 0), "mat_arch_steel", 0.012)
        box(metal, (1.50, 0.045, 0.07), (0, 0.97, 0), "mat_arch_steel", 0.012)
        for x in (-0.70, -0.36, 0, 0.36, 0.70):
            box(metal, (0.035, 0.75, 0.065), (x, 0.595, 0), "mat_arch_steel", 0.009)
        for x in (-0.70, 0.70):
            box(metal, (0.06, 0.99, 0.13), (x, 0.53, 0), "mat_arch_steel", 0.01)
            box(metal, (0.28, 0.035, 0.18), (x, 0.0175, 0), "mat_arch_steel", 0.008)
        doc.add_node("barrier_guard_frame", mesh_builder=metal, parent_idx=lod)
        rail = MeshBuilder("barrier_warning_panels_mesh")
        box(rail, (1.32, 0.22, 0.018), (0, 0.58, 0.041), "mat_led_fault", 0.006)
        # High-contrast diagonal black warning bands as raised matte panels.
        for i in range(7):
            x = -0.57 + i * 0.19
            band = MeshBuilder(f"barrier_stripe_{i:02d}_mesh")
            band.add_quad((x - 0.065, 0.48, 0.052), (x + 0.025, 0.48, 0.052),
                          (x + 0.11, 0.68, 0.052), (x + 0.02, 0.68, 0.052),
                          (0, 0, 1), "mat_powder_coat_dark")
            doc.add_node(f"barrier_stripe_{i:02d}", mesh_builder=band, parent_idx=lod)
        doc.add_node("barrier_warning_panel", mesh_builder=rail, parent_idx=lod)
        for i, x in enumerate((-0.68, 0.68)):
            add_led(doc, lod, f"led_barrier_beacon_{i + 1:02d}", (x, 1.035, 0),
                    "mat_led_fault" if i == 0 else "mat_led_activity")

    return asset(name, "construction", dims, detail, collider=(1.64, 1.10, 0.15),
                 extras={"modularLengthM": 1.62, "warningStateNode": "barrier_warning_panel"})


def site_board():
    name, dims = "site_information_board", (0.76, 1.42, 0.28)

    def detail(doc, lod, d):
        stand = MeshBuilder("site_board_stand_mesh")
        box(stand, (0.70, 0.08, 0.26), (0, 0.04, 0), "mat_arch_steel", 0.012)
        for x in (-0.26, 0.26):
            box(stand, (0.045, 0.72, 0.05), (x, 0.43, -0.045), "mat_arch_steel", 0.009)
            box(stand, (0.14, 0.025, 0.18), (x, 0.09, 0), "mat_brushed_metal", 0.006)
        doc.add_node("site_board_supports", mesh_builder=stand, parent_idx=lod)
        panel = MeshBuilder("site_board_panel_mesh")
        box(panel, (0.70, 0.71, 0.055), (0, 1.04, 0), "mat_powder_coat_dark", 0.018)
        box(panel, (0.60, 0.59, 0.016), (0, 1.04, 0.037), "mat_arch_floor", 0.009)
        panel.add_plane(0.53, 0.51, center=(0, 1.04, 0.047), facing="+z", material="mat_label_model")
        for y in (0.76, 1.32):
            for x in (-0.28, 0.28):
                cylinder(panel, 0.007, 0.005, (x, y, 0.048), "mat_brushed_metal", 8)
        doc.add_node("site_project_display", mesh_builder=panel, parent_idx=lod,
                     extras={"dynamicSurface": "construction_project_status", "replaceable": True})
        for name, x, material in (("led_site_safety", -0.22, "mat_led_power"),
                                  ("led_site_progress", 0.22, "mat_led_activity")):
            add_led(doc, lod, name, (x, 0.70, 0.035), material)

    return asset(name, "construction", dims, detail, extras={"dynamicSurface": "construction_project_status"})


def material_pallet():
    name, dims = "construction_material_pallet", (1.00, 0.88, 0.84)

    def detail(doc, lod, d):
        wood = MeshBuilder("pallet_timber_mesh")
        for y in (0.055, 0.125):
            for x in (-0.42, 0, 0.42):
                box(wood, (0.15, 0.055, 0.78), (x, y, 0), "mat_label_inventory", 0.007)
        for x in (-0.34, 0, 0.34):
            box(wood, (0.15, 0.10, 0.76), (x, 0.05, 0), "mat_label_inventory", 0.006)
        doc.add_node("pallet_timber_deck", mesh_builder=wood, parent_idx=lod,
                     extras={"forkEntry": "+X/-X", "reusable": True})
        cargo = MeshBuilder("pallet_material_crates_mesh")
        for row in range(2):
            for col in range(2):
                x = (col - 0.5) * 0.40
                y = 0.26 + row * 0.29
                box(cargo, (0.36, 0.22, 0.34), (x, y, 0), "mat_powder_coat_medium", 0.012)
                box(cargo, (0.30, 0.012, 0.02), (x, y + 0.035, 0.174), "mat_arch_steel")
                box(cargo, (0.012, 0.12, 0.01), (x, y, 0.178), "mat_brushed_metal")
        doc.add_node("pallet_stacked_material_cases", mesh_builder=cargo, parent_idx=lod,
                     extras={"materialCases": 4})
        strap = MeshBuilder("pallet_shipping_straps_mesh")
        for x in (-0.20, 0.20):
            box(strap, (0.022, 0.61, 0.77), (x, 0.47, 0), "mat_arch_steel")
        doc.add_node("pallet_shipping_straps", mesh_builder=strap, parent_idx=lod)
        for i, x in enumerate((-0.38, 0.38)):
            add_led(doc, lod, f"led_pallet_inventory_{i + 1:02d}", (x, 0.16, 0.41), "mat_led_activity")

    return asset(name, "construction", dims, detail, collider=(1.02, 0.90, 0.84),
                 extras={"forkEntry": "+X/-X", "loadState": "stacked"})


def build(output_root: Path):
    if output_root.exists() and any(output_root.iterdir()):
        raise FileExistsError(f"Output root must be empty: {output_root}")
    assets = output_root / "asset-pack" / "assets" / "operations"
    sources = output_root / "asset-pack" / "source" / "operations"
    docs = output_root / "asset-pack" / "docs"
    assets.mkdir(parents=True, exist_ok=True)
    sources.mkdir(parents=True, exist_ok=True)
    docs.mkdir(parents=True, exist_ok=True)
    builders = [lambda: air_handler(asset, box, cylinder, add_led),
                lambda: central_chiller(asset, box, cylinder, add_led),
                lambda: enclosed_pump(asset, box, cylinder, add_led),
                pump_heat_exchanger, environment_sensor, maintenance_robot,
                robot_dock, tool_cart, site_barrier, site_board, material_pallet]
    entries = []
    for build_asset in builders:
        doc = build_asset()
        name = doc.asset_name
        glb = assets / f"{name}.glb"
        source = sources / f"{name}.gltf"
        glb_metadata = doc.export_glb(str(glb), texture_rel_prefix="../../textures")
        doc.export_gltf(str(source), texture_rel_prefix="../../textures")
        meta = next(item for item in MODELS if item[0] == name)
        entries.append({
            "name": name,
            "category": meta[1],
            "dimensionsM": list(meta[2]),
            "up": "+Y",
            "front": "+Z",
            "glb": f"assets/operations/{name}.glb",
            "source": f"source/operations/{name}.gltf",
            "buffer": f"source/operations/{name}.bin",
            "bytes": glb.stat().st_size,
            "meshCount": glb_metadata.get("meshes"),
            "nodeCount": glb_metadata.get("nodes"),
        })
    manifest = {
        "package": "ROOT operations and construction assets",
        "format": "glTF 2.0",
        "units": "m",
        "axis": {"up": "+Y", "front": "+Z"},
        "generatedBy": "tools/asset-generator/build_operations_assets.py",
        "assets": entries,
    }
    (docs / "operations_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, required=True,
                        help="fresh private staging directory; runtime pack is never written")
    args = parser.parse_args()
    build(args.output_root.resolve())
    print(f"Built {len(MODELS)} operations assets in {args.output_root.resolve()}")


if __name__ == "__main__":
    main()
