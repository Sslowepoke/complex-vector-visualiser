import * as THREE from "three";
import { GUI } from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const colors = {
    background: 0xfdf6e3,
    background_dim: 0xefebd4,
    grey: 0xa6b0a0,
    red: 0xf85552,
    yellow: 0xdfa000,
    green: 0x8da101,
    blue: 0x3a94c5,
    purple: 0xdf69ba,
    fg: 0x5c6a72,
    bg_red: 0xf85552,
    bg_yellow: 0xfaedcd,
    bg_green: 0xf0f1d2,
    bg_blue: 0xe9f0e9,
    bg_purple: 0xfae8e2,
    statusline: 0x93b259
};

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.set(4, 4, 4);
camera.up.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(colors.background);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));

/* ---------------- AXES ---------------- */

const axes = new THREE.AxesHelper(3);
scene.add(axes);

function makeLabel(text, color) {

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 140);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({ map: texture });

    const sprite = new THREE.Sprite(material);

    sprite.scale.set(0.5, 0.5, 0.5);

    return sprite;

}

const labelX = makeLabel("Ex", colors.red);
labelX.position.set(3.2, 0, 0);
scene.add(labelX);

const labelY = makeLabel("Ey", colors.green);
labelY.position.set(0, 3.2, 0);
scene.add(labelY);

const labelZ = makeLabel("Ez", colors.blue);
labelZ.position.set(0, 0, 3.2);
scene.add(labelZ);

/* ---------------- GRIDS ---------------- */
// 
const gridXYBack = new THREE.GridHelper(4, 10, colors.grey, colors.grey);
gridXYBack.position.set(0, -2, 0);
scene.add(gridXYBack);

const gridXZBack = new THREE.GridHelper(4, 10, colors.grey, colors.grey);
gridXZBack.position.set(0, 0, -2);
gridXZBack.rotateX(Math.PI / 2);
scene.add(gridXZBack);

const gridYZBack = new THREE.GridHelper(4, 10, colors.grey, colors.grey);
gridYZBack.position.set(-2, 0, 0);
gridYZBack.rotateZ(Math.PI / 2);
scene.add(gridYZBack);

const params = {

    Ex: "1+0j",
    Ey: "0+1j",
    Ez: "1+0j",

    omega: 2,

    showAxes: true,

    showPolarPlane: false,

    showProjection: false,
    projectionPlane: "xOy",

    cameraPreset: "default"

};

/* ---------------- COMPLEX PARSER ---------------- */

function parseComplex(s) {

    s = s.replace(/\s/g, "");

    const m = s.match(/^([+-]?\d*\.?\d*)([+-]\d*\.?\d*)j$/);

    if (m) {

        const re = parseFloat(m[1] || 0);
        const im = parseFloat(m[2] || 0);

        return { re, im };

    }

    const real = parseFloat(s);

    if (!isNaN(real)) return { re: real, im: 0 };

    return { re: 0, im: 0 };

}

/* ---------------- FIELD ---------------- */

function computeField(t) {

    const w = params.omega;

    const Ex = parseComplex(params.Ex);
    const Ey = parseComplex(params.Ey);
    const Ez = parseComplex(params.Ez);

    const x =
        Ex.re * Math.cos(w * t) -
        Ex.im * Math.sin(w * t);

    const y =
        Ey.re * Math.cos(w * t) -
        Ey.im * Math.sin(w * t);

    const z =
        Ez.re * Math.cos(w * t) -
        Ez.im * Math.sin(w * t);

    return new THREE.Vector3(x, y, z);

}

/* ---------------- MAIN VECTOR ---------------- */

const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1,
    colors.green
);

scene.add(arrow);

function updateArrow(v) {

    const len = v.length();

    if (len < 1e-6) return;

    arrow.setDirection(v.clone().normalize());
    arrow.setLength(len);

}

/* ---------------- POLARIZATION PATH ---------------- */

let pathLine;

function rebuildPath() {

    if (pathLine) scene.remove(pathLine);

    const points = [];
    const samples = 400;

    const T = 2 * Math.PI / params.omega;

    let maxR = 0;

    for (let i = 0; i <= samples; i++) {

        const t = i / samples * T;

        const p = computeField(t);

        maxR = Math.max(maxR, p.length());

        points.push(p);

    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({ color: colors.fg });

    pathLine = new THREE.Line(geometry, material);

    scene.add(pathLine);

    rebuildPolarPlane(points, maxR);

}

/* ---------------- POLARIZATION PLANE ---------------- */

let polarPlane;

function rebuildPolarPlane(points, scale) {

    if (polarPlane) scene.remove(polarPlane);

    if (!params.showPolarPlane) return;

    const v1 = points[50];
    const v2 = points[150];

    const normal = v1.clone().cross(v2).normalize();

    const geom = new THREE.PlaneGeometry(scale * 3, scale * 3);

    const mat = new THREE.MeshBasicMaterial({
        color: colors.bg_green,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });

    polarPlane = new THREE.Mesh(geom, mat);

    const q = new THREE.Quaternion();

    q.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal
    );

    polarPlane.setRotationFromQuaternion(q);

    scene.add(polarPlane);

}

/* ---------------- PROJECTION ---------------- */

const projectionArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1,
    colors.red
);

scene.add(projectionArrow);

const projectionPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({
        color: colors.bg_red,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    })
);

scene.add(projectionPlane);

const connectorLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
    ]),
    new THREE.LineBasicMaterial({
        color: colors.grey,
        transparent: true,
        opacity: 0.5
    })
);

scene.add(connectorLine);

function updateProjection(v) {

    if (!params.showProjection) {

        projectionArrow.visible = false;
        projectionPlane.visible = false;
        connectorLine.visible = false;

        return;

    }

    projectionArrow.visible = true;
    projectionPlane.visible = true;
    connectorLine.visible = true;

    let p = v.clone();

    let planeColor, arrowColor;
    if (params.projectionPlane === "xOy") {
        p.z = 0;
        projectionPlane.rotation.set(0, 0, 0);
        planeColor = colors.bg_blue;
        arrowColor = colors.blue;
    }
    if (params.projectionPlane === "xOz") {
        p.y = 0;
        projectionPlane.rotation.set(Math.PI / 2, 0, 0);
        planeColor = colors.bg_purple;
        arrowColor = colors.purple;
    }
    if (params.projectionPlane === "yOz") {
        p.x = 0;
        projectionPlane.rotation.set(0, Math.PI / 2, 0);
        planeColor = colors.bg_yellow;
        arrowColor = colors.yellow;
    }

    projectionPlane.material.color.set(planeColor);
    projectionArrow.setColor(arrowColor);

    const len = p.length();

    if (len > 1e-6) {

        projectionArrow.setDirection(p.clone().normalize());
        projectionArrow.setLength(len);

    }

    const positions = new Float32Array([
        v.x, v.y, v.z,
        p.x, p.y, p.z
    ]);

    connectorLine.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

}

/* ---------------- CAMERA PRESETS ---------------- */

function updateCamera() {

    if (params.cameraPreset === "xOy") {

        camera.position.set(0, 0, 6);
        camera.up.set(0, 0, 1);

    }

    else if (params.cameraPreset === "yOz") {

        camera.position.set(6, 0, 0);
        camera.up.set(0, 0, 1);

    }

    else if (params.cameraPreset === "xOz") {

        camera.position.set(0, 6, 0);
        camera.up.set(0, 0, 1);

    }

    else {

        camera.position.set(4, 4, 4);
        camera.up.set(0, 0, 1);

    }

    controls.update();

}

/* ---------------- GUI ---------------- */

const gui = new GUI();

gui.add(params, "Ex").onFinishChange(rebuildPath);
gui.add(params, "Ey").onFinishChange(rebuildPath);
gui.add(params, "Ez").onFinishChange(rebuildPath);

gui.add(params, "omega", 0, 10).onFinishChange(rebuildPath);

gui.add(params, "showAxes").onChange(v => {

    axes.visible = v;
    labelX.visible = v;
    labelY.visible = v;
    labelZ.visible = v;

});

gui.add(params, "showPolarPlane").onChange(rebuildPath);

gui.add(params, "showProjection");

gui.add(params, "projectionPlane", ["xOy", "xOz", "yOz"]);

gui.add(params, "cameraPreset", ["default", "xOy", "yOz", "xOz"])
    .onChange(updateCamera);

/* ---------------- START ---------------- */

rebuildPath();

const clock = new THREE.Clock();

function animate() {

    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    const E = computeField(t);

    updateArrow(E);
    updateProjection(E);

    renderer.render(scene, camera);

}

animate();

window.addEventListener("resize", () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

});
