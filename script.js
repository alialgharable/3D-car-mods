import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/environments/RoomEnvironment.js";

const container = document.getElementById("viewer");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.01,
  1000
);
camera.position.set(4.5, 2.2, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 1.5;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(0, 0.45, 0);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.5);
scene.add(hemiLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(6, 8, 6);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 30;
mainLight.shadow.camera.left = -10;
mainLight.shadow.camera.right = 10;
mainLight.shadow.camera.top = 10;
mainLight.shadow.camera.bottom = -10;
mainLight.shadow.bias = -0.0001;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xbcd7ff, 0.6);
fillLight.position.set(-5, 4, -3);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xffffff, 5, 30, 2);
rimLight.position.set(0, 5, -6);
scene.add(rimLight);

const loader = new GLTFLoader();

let carModel = null;
let garageModel = null;
let garageBox = null;
let colorableMaterials = [];
let originalColors = new Map();
let currentView = "exterior";
let interiorMarker = null;
let interiorTarget = new THREE.Vector3();

const exteriorCameraPosition = new THREE.Vector3(4.5, 2.2, 7);

const exteriorSettings = {
  minDistance: 1.5,
  maxDistance: 6,
  enablePan: false,
  enableZoom: true,
  maxPolarAngle: Math.PI / 2.05
};

function updateViewButtons() {
  const exteriorBtn = document.getElementById("exteriorViewBtn");
  const interiorBtn = document.getElementById("interiorViewBtn");

  if (exteriorBtn) {
    exteriorBtn.classList.toggle("active", currentView === "exterior");
  }

  if (interiorBtn) {
    interiorBtn.classList.toggle("active", currentView === "interior");
  }
}

function setCarColor(colorHex) {
  colorableMaterials.forEach((material) => {
    material.color.set(colorHex);
    material.needsUpdate = true;
  });
}

function resetCarColor() {
  colorableMaterials.forEach((material) => {
    const original = originalColors.get(material);
    if (original) {
      material.color.copy(original);
      material.needsUpdate = true;
    }
  });
}

function clampCameraInsideGarage() {
  if (currentView !== "exterior") return;

  // tighter manual limits so camera stays inside visible garage walls
  const minX = -3.2;
  const maxX = 3.2;
  const minY = 0.6;
  const maxY = 3.8;
  const minZ = -3.8;
  const maxZ = 3.8;

  camera.position.x = THREE.MathUtils.clamp(camera.position.x, minX, maxX);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, minY, maxY);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, minZ, maxZ);
}

function switchToExteriorView() {
  if (!carModel) return;

  currentView = "exterior";

  camera.fov = 60;
  camera.updateProjectionMatrix();

  controls.enabled = true;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = exteriorSettings.minDistance;
  controls.maxDistance = exteriorSettings.maxDistance;
  controls.maxPolarAngle = exteriorSettings.maxPolarAngle;
  controls.minPolarAngle = 0;

  camera.position.copy(exteriorCameraPosition);
  controls.target.set(0, 0.45, 0);
  controls.update();
  clampCameraInsideGarage();

  updateViewButtons();
}

function switchToInteriorView() {
  if (!carModel) return;

  currentView = "interior";

  const box = new THREE.Box3().setFromObject(carModel);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  const seatX = center.x + size.x * 0.20;
  const seatY = center.y + size.y * 0.17;
  const seatZ = center.z + size.z * -0.019;

  const targetX = center.x + size.x * 0.15;
  const targetY = seatY;
  const targetZ = seatZ;

  camera.fov = 75;
  camera.updateProjectionMatrix();

  camera.position.set(seatX, seatY, seatZ);

  controls.enabled = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = 0.01;
  controls.maxDistance = 0.01;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.minPolarAngle = Math.PI * 0.15;

  controls.target.set(targetX, targetY, targetZ);
  controls.update();

  updateViewButtons();
}

loader.load(
  "./models/garage.glb",
  (gltf) => {
    garageModel = gltf.scene;

    garageModel.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          material.envMapIntensity = 0.8;
        });
      }
    });

    const garageBoxRaw = new THREE.Box3().setFromObject(garageModel);
    const garageSize = new THREE.Vector3();
    const garageCenter = new THREE.Vector3();

    garageBoxRaw.getSize(garageSize);
    garageBoxRaw.getCenter(garageCenter);

    garageModel.position.sub(garageCenter);
    garageModel.position.y += garageSize.y / 2 - 0.17;

    const desiredGarageWidth = 8;
    const garageScale = desiredGarageWidth / garageSize.x;
    garageModel.scale.setScalar(garageScale);

    scene.add(garageModel);

    garageBox = new THREE.Box3().setFromObject(garageModel);
  },
  undefined,
  (error) => {
    console.error("Error loading garage:", error);
  }
);

loader.load(
  "./models/car.glb",
  (gltf) => {
    carModel = gltf.scene;

    carModel.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((material) => {
        if (!material) return;

        material.envMapIntensity = 1.0;

        if (!material.color) return;

        const materialName = (material.name || "").toLowerCase();
        const meshName = (child.name || "").toLowerCase();

        const excluded =
          materialName.includes("glass") ||
          materialName.includes("window") ||
          materialName.includes("chrome") ||
          materialName.includes("rim") ||
          materialName.includes("tire") ||
          materialName.includes("rubber") ||
          materialName.includes("light") ||
          materialName.includes("interior") ||
          materialName.includes("seat") ||
          materialName.includes("dashboard") ||
          materialName.includes("steering") ||
          meshName.includes("glass") ||
          meshName.includes("window") ||
          meshName.includes("rim") ||
          meshName.includes("tire") ||
          meshName.includes("wheel") ||
          meshName.includes("interior") ||
          meshName.includes("seat") ||
          meshName.includes("dashboard") ||
          meshName.includes("steering");

        if (!excluded) {
          colorableMaterials.push(material);

          if (!originalColors.has(material)) {
            originalColors.set(material, material.color.clone());
          }
        }
      });
    });

    const box = new THREE.Box3().setFromObject(carModel);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    carModel.position.sub(center);
    carModel.position.y += size.y / 2;

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    carModel.scale.setScalar(scale);

    scene.add(carModel);

    controls.target.set(0, 0.45, 0);

    exteriorCameraPosition.set(4.5, 2.2, 5.8);
    camera.position.copy(exteriorCameraPosition);
    camera.lookAt(controls.target);

    interiorMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    interiorMarker.visible = false;
    scene.add(interiorMarker);

    if (garageModel) {
      garageBox = new THREE.Box3().setFromObject(garageModel);
    }

    clampCameraInsideGarage();
    updateViewButtons();
  },
  undefined,
  (error) => {
    console.error("Error loading model:", error);

    const fallbackGeo = new THREE.BoxGeometry(2.5, 0.8, 5);
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      metalness: 0.7,
      roughness: 0.25
    });
    const fallback = new THREE.Mesh(fallbackGeo, fallbackMat);
    fallback.position.y = 0.8;
    fallback.castShadow = true;
    fallback.receiveShadow = true;
    scene.add(fallback);
  }
);

document.querySelectorAll(".color-btn").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("reset-btn")) {
      resetCarColor();
      return;
    }

    const color = button.dataset.color;
    if (color) {
      setCarColor(color);
    }
  });
});

const exteriorBtn = document.getElementById("exteriorViewBtn");
const interiorBtn = document.getElementById("interiorViewBtn");

if (exteriorBtn) {
  exteriorBtn.addEventListener("click", switchToExteriorView);
}

if (interiorBtn) {
  interiorBtn.addEventListener("click", switchToInteriorView);
}

window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  clampCameraInsideGarage();
  renderer.render(scene, camera);
}

animate();