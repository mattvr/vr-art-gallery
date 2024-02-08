import * as THREE from "three";
import { WebGLRenderer, WebXRController } from "three";
import { BoxLineGeometry } from "three/examples/jsm/geometries/BoxLineGeometry.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { initPaintings, paintings, PaintingSpec } from "./paintings";
import * as regularFontJSON from "../public/assets/fonts/helvetiker_regular.typeface.json"
import * as boldFontJSON from "../public/assets/fonts/helvetiker_bold.typeface.json";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { init as audioInit, listener, mouthPopSound } from "./audio";
import { preload } from "./preload";

const CUSTOM_FRAMERATE = -1; // e.g. -1 (unset), 72, 80, 90
const DEPTH_MAP_SCALE = 0.01;
const DEPTH_MAP_RES = 100;
const DEPTH_MAP_MIN_DIMS = 2.5;
const NORMAL_MAP_SCALE = 0.2;
const START_PAINTING_HEIGHT = 1.5; // average human eye level (meters)

type Controller = {
  gamepad?: Gamepad;
  space?: THREE.XRTargetRaySpace;
  hand?: any;
  handSpace?: THREE.XRHandSpace
  grip?: THREE.XRGripSpace;
};

type Painting = PaintingSpec & {
  scene: THREE.Scene;
  sceneItem: THREE.Object3D;
  bottomRight: THREE.Vector3;
};

let renderer: THREE.WebGLRenderer;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let body: THREE.Object3D;

const controller1 = {} as Controller;
const controller2 = {} as Controller;

let room: THREE.LineSegments;

let count = 0;
const radius = 0.08;
let normal = new THREE.Vector3();
const relativeVelocity = new THREE.Vector3();

const clock = new THREE.Clock();

const paintingCenterXYZ = [0, 0, 0];
let paintingIndex = -1;
const paintingCache: Record<string, Painting> = {};

let toggleDistance = 0;
const getActivePainting = () => {
  const paintingName = paintings[paintingIndex].name;
  return paintingCache[paintingName];
};

const scaleDims = (dims: [number, number], res: [number, number]) => {
  const ratio = ([a, b]) => a / b;

  const abRatio = ratio(dims) / ratio(res);

  // now scale dimsAspectRatio to resAspectRatio
  const newDims = [...dims];
  if (abRatio > 1) {
    newDims[0] = newDims[0] / abRatio;
  } else {
    newDims[1] = newDims[1] * abRatio;
  }

  return newDims;
};

let gripPressed = [false, false];
let triggerPressed = [false, false];
let directionPressedNESW = [false, false, false, false];
let pinching = [false, false];
function handleController(controller: Controller) {
  // move camera (left stick)
  if (
    controller.gamepad && controller.gamepad?.axes[2] !== 0 &&
    controller === controller1
  ) {
    paintingCenterXYZ[0] += controller.gamepad.axes[2] * alpha;
    posDirty = true;

    // move relative
    // const joystickLeft = new THREE.Vector3(
    //   controller.gamepad.axes[2] * alpha,
    //   0,
    //   0,
    // );
    // joystickLeft.applyQuaternion(body.quaternion);
    // body.position.add(joystickLeft);

    // move absolute
    // body.position.x += controller.gamepad.axes[2] * alpha;
  }
  if (
    controller.gamepad && controller.gamepad?.axes[3] !== 0 &&
    controller === controller1
  ) {
    paintingCenterXYZ[1] -= controller.gamepad.axes[3] * alpha;
    posDirty = true;

    // move relative
    // const joystickFwd = new THREE.Vector3(
    //   0,
    //   0,
    //   controller.gamepad.axes[3] * alpha,
    // );
    // joystickFwd.applyQuaternion(body.quaternion);
    // body.position.add(joystickFwd);

    // move absolute
    // body.position.z += controller.gamepad.axes[3] * alpha;
  }

  // RIGHT STICK: Next painting
  if (
    controller.gamepad &&
    !directionPressedNESW[3] &&
    controller.gamepad?.axes[2] > TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[3] = true;
    changePainting("next");
  } else if (
    controller.gamepad &&
    directionPressedNESW[3] &&
    controller.gamepad?.axes[2] < TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[3] = false;
  }

  // RIGHT HAND: Next painting
  if (
    controller === controller2 &&
    controller.handSpace && isPinching(controller) && !pinching[1]) {
    changePainting("next");
    pinching[1] = true;
  }
  else if (!isPinching(controller) && controller === controller2) {
    pinching[1] = false;
  }

  // RIGHT STICK: Previous painting
  if (
    controller.gamepad &&
    !directionPressedNESW[1] &&
    controller.gamepad?.axes[2] < -TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[1] = true;
    changePainting("prev");
  } else if (
    controller.gamepad &&
    directionPressedNESW[1] &&
    controller.gamepad?.axes[2] >= -TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[1] = false;
  }

  // RIGHT STICK: Painting up res
  if (
    controller.gamepad &&
    !directionPressedNESW[0] &&
    controller.gamepad?.axes[3] > TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[0] = true;
  } else if (
    controller.gamepad &&
    directionPressedNESW[0] &&
    controller.gamepad?.axes[3] >= TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[0] = false;
  }

  // RIGHT STICK: Painting down res
  if (
    controller.gamepad &&
    !directionPressedNESW[2] &&
    controller.gamepad?.axes[3] < -TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[2] = true;
  } else if (
    controller.gamepad &&
    directionPressedNESW[2] &&
    controller.gamepad?.axes[3] >= -TURN_ACTIVATION_THRESHOLD &&
    controller === controller2
  ) {
    directionPressedNESW[2] = false;
  }

  // move painting Z based on right controller trigger value
  if (
    controller.gamepad &&
    controller.gamepad?.buttons[0].pressed &&
    controller === controller2 &&
    triggerPressed[1] === false
  ) {
    if (toggleDistance === 0) {
      toggleDistance = 1;
    } else if (toggleDistance === 1) {
      toggleDistance = 2;
    } else if (toggleDistance === 2) {
      toggleDistance = 3;
    } else if (toggleDistance === 3) {
      toggleDistance = 0;
    }

    // get current Z position of camera
    const paintingZ = toggleDistance === 2 ? -2.5 : -1.5;
    const cameraZ = camera.position.z;
    if (toggleDistance > 0) {
      paintingCenterXYZ[2] = cameraZ - paintingZ;
    } else {
      paintingCenterXYZ[2] = 0;
    }
    triggerPressed[1] = true;
    posDirty = true;
  } else if (
    controller.gamepad &&
    (controller.gamepad?.buttons[0].pressed === false) &&
    controller === controller2
  ) {
    triggerPressed[1] = false;
  }

  // LEFT HAND: Move painting Z based on left controller pinching
  if (
    controller === controller1 &&
    controller.handSpace && isPinching(controller) && !pinching[0]) {
    if (toggleDistance === 0) {
      toggleDistance = 1;
    } else if (toggleDistance === 1) {
      toggleDistance = 2;
    } else if (toggleDistance === 2) {
      toggleDistance = 3;
    } else if (toggleDistance === 3) {
      toggleDistance = 0;
    }

    // get current Z position of camera
    const paintingZ = toggleDistance === 2 ? -2.5 : -1.5;
    const cameraZ = camera.position.z;
    if (toggleDistance > 0) {
      paintingCenterXYZ[2] = cameraZ - paintingZ;
    } else {
      paintingCenterXYZ[2] = 0;
    }
    pinching[0] = true;
    posDirty = true;
  }
  else if (!isPinching(controller) && controller === controller1) {
    pinching[0] = false;
  }


  // change on R grip
  if (
    !gripPressed[0] &&
    controller.gamepad &&
    controller.gamepad?.buttons[1]?.pressed &&
    controller === controller2
  ) {
    // changePainting(true);
    mouthPopSound.play();
    gripPressed[0] = true;
    posDirty = true;
  } else if (
    controller.gamepad &&
    !controller.gamepad?.buttons[1]?.pressed &&
    controller === controller2
  ) {
    gripPressed[0] = false;
  }

  // change on L trigger
  if (
    !gripPressed[1] &&
    controller.gamepad &&
    controller.gamepad?.buttons[1]?.pressed &&
    controller === controller1
  ) {
    // changePainting();
    mouthPopSound.play();
    gripPressed[1] = true;
    posDirty = true;
  } else if (
    controller.gamepad &&
    !controller.gamepad?.buttons[1]?.pressed &&
    controller === controller1
  ) {
    gripPressed[1] = false;
  }

  // if (controller == controller2) {
  //   // move light to controller
  //   if (controller.gamepad?.buttons[1]?.pressed) {
  //     const pos = controller.space.getWorldPosition(
  //       controller.space.position,
  //     );
  //     light?.position.set(pos.x, pos.y, pos.z);
  //   }
  // }
}

// let light: THREE.Light | null = null;
let directionLight: THREE.AmbientLight | null = null;
let posDirty = false;
const handleScene = () => {
  if (!posDirty) {
    return;
  }
  const painting = getActivePainting();
  if (painting) {
    painting?.sceneItem?.position.set(
      (painting.pos[0] || 0) + paintingCenterXYZ[0],
      (painting.pos[1] || 0) + paintingCenterXYZ[1],
      (painting.pos[2] || 0) + paintingCenterXYZ[2],
    );
    const plaquePos = getPlaquePos(paintingCenterXYZ, painting);
    plaque?.position.set(
      plaquePos[0] + paintingCenterXYZ[0],
      plaquePos[1] + paintingCenterXYZ[1],
      plaquePos[2] + paintingCenterXYZ[2],
    );
  }
  // console.log("painting", painting.object?.position);
};

const boldFont = new FontLoader().parse(boldFontJSON);
const regularFont = new FontLoader().parse(regularFontJSON);

let plaque: THREE.Group = null;
let plaqueHeaderTextMesh: THREE.Mesh = null;
let plaqueTextMesh: THREE.Mesh = null;
type xyz = [number, number, number];

const getPlaquePos = (pos: xyz, painting: Painting) => {
  const { dims: _dims, res } = painting;
  const dims = scaleDims(_dims, res);
  return [0, START_PAINTING_HEIGHT - (dims[1] / 2) - 0.1, -2.85];
};

function updatePlaque(scene: THREE.Scene, pos: xyz, painting: Painting) {
  if (plaque) {
    plaqueHeaderTextMesh.geometry = new TextGeometry(painting.name, {
      font: boldFont,
      size: 0.01,
      height: 0.001,
    });
    plaqueTextMesh.geometry = new TextGeometry(
      `${painting.artist}, ${painting.year}`,
      {
        font: regularFont,
        size: 0.01,
        height: 0.001,
      },
    );
    if (painting.name.includes("\n")) {
      plaqueTextMesh.position.set(-0.11, -0.011, 0);
    } else {
      plaqueTextMesh.position.set(-0.11, 0, 0);
    }

    plaque.position.set(...getPlaquePos(pos, painting));

    return;
  }

  // show three.js museum plaque (black text on white rectangle)
  plaque = new THREE.Group();
  plaque.position.set(0, 0, -2.9);
  plaque.rotation.set(0, 0, 0);
  plaque.scale.set(1, 1, 1);
  plaque.name = "plaque";

  const plaqueHeaderText = new TextGeometry(painting.name, {
    font: boldFont,
    size: 0.01,
    height: 0.001,
  });

  const plaqueHeaderTextMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
  });

  plaqueHeaderTextMesh = new THREE.Mesh(
    plaqueHeaderText,
    plaqueHeaderTextMaterial,
  );

  plaqueHeaderTextMesh.position.set(-0.11, 0.025, 0);

  const plaqueText = new TextGeometry(`${painting.artist}, ${painting.year}`, {
    font: regularFont,
    size: 0.01,
    height: 0.001,
  });

  const plaqueTextMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
  });

  plaqueTextMesh = new THREE.Mesh(plaqueText, plaqueTextMaterial);
  plaqueTextMesh.position.set(-0.11, 0, 0);
  if (painting.name.includes("\n")) {
    plaqueTextMesh.position.set(-0.11, -0.025, 0.011);
  }

  const plaqueBox = new THREE.BoxGeometry(0.25, 0.125, 0.01);
  const plaqueBoxMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
  });
  const plaqueBoxMesh = new THREE.Mesh(plaqueBox, plaqueBoxMaterial);
  plaqueBoxMesh.position.set(0, 0, -0.02);

  const plaqueOuterBox = new THREE.BoxGeometry(0.27, 0.145, 0.005);
  const plaqueOuterBoxMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
  });

  const plaqueOuterBoxMesh = new THREE.Mesh(
    plaqueOuterBox,
    plaqueOuterBoxMaterial,
  );
  plaqueOuterBoxMesh.position.set(0, 0, -0.025);

  plaque.add(plaqueHeaderTextMesh);
  plaque.add(plaqueTextMesh);
  plaque.add(plaqueBoxMesh);
  plaque.add(plaqueOuterBoxMesh);

  plaque.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);

  plaque.position.set(...getPlaquePos(pos, painting));
  scene.add(plaque);

  return null;
}

function changePainting(type: "prev" | "next" | "upres" | "downres" = "next") {
  let painting = paintings[paintingIndex];

  if (painting) {
    const name = paintings[paintingIndex].name;
    const { sceneItem } = paintingCache[name];

    scene.remove(sceneItem);
  }

  if (type === "next") {
    paintingIndex = (paintingIndex + 1) % paintings.length;
  }
  if (type === "prev") {
    paintingIndex = (paintingIndex - 1 + paintings.length) % paintings.length;
  }

  const newSceneItem = paintings[paintingIndex]
    ? paintingCache[paintings[paintingIndex].name]?.sceneItem
    : null;

  if (!newSceneItem) {
    renderPainting(scene, paintings[paintingIndex]);
  } else {
    scene.add(newSceneItem);
  }

  painting = paintingCache[paintings[paintingIndex].name];
  updatePlaque(
    scene,
    painting?.sceneItem?.position.toArray() as xyz,
    painting,
  );
}

function renderPainting(scene: THREE.Scene, painting: Painting) {
  // go from painting(0, 0).png, painting(0, 1).png, ...painting(n, m).png
  // to n*m meshes that appear as a single painting

  const { slice, res, dims: _dims, offset: _offset } = painting;
  const offset = _offset || [0, 0];
  const dims = _dims || [1, 1];

  const newDims = scaleDims(dims, res);
  let bottomRight = [0, 0];

  const group = new THREE.Group();

  if (!slice || (slice.num_x === 1 && slice.num_y === 1)) {
    const texture = new THREE.TextureLoader().load(
      painting.url.replace("{SLICE}", ""),
    );
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });

    console.log(
      "adding painting with texture",
      painting.url.replace("{SLICE}", ""),
      texture,
    );

    if (
      painting.depth_map_url &&
      (newDims[0] > DEPTH_MAP_MIN_DIMS || newDims[1] > DEPTH_MAP_MIN_DIMS)
    ) {
      const depthTexture = new THREE.TextureLoader().load(
        painting.depth_map_url.replace("{SLICE}", ""),
      );
      material.displacementMap = depthTexture;
      material.displacementScale = DEPTH_MAP_SCALE;
      material.displacementBias = DEPTH_MAP_SCALE / 2;
    }

    if (painting.normal_map_url) {
      const normalTexture = new THREE.TextureLoader().load(
        painting.normal_map_url.replace("{SLICE}", ""),
      );
      material.normalMap = normalTexture;
      material.normalScale = new THREE.Vector2(
        NORMAL_MAP_SCALE,
        NORMAL_MAP_SCALE,
      );
      material.roughness = 0;
    }

    const geometry = new THREE.PlaneGeometry(
      newDims[0],
      newDims[1],
      painting.depth_map_url ? DEPTH_MAP_RES : 1,
      painting.depth_map_url ? DEPTH_MAP_RES : 1,
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      offset[0],
      offset[1],
      0,
    );
    mesh.castShadow = true;
    group.add(mesh);
    bottomRight = [offset[0] + newDims[0], offset[1] + newDims[1]];
  } else {
    const totalXOffset = -newDims[0] / 2;
    const totalYOffset = -newDims[1] / 2;

    for (let x = 0; x < slice.num_x; x++) {
      const xOffsetPx = slice.full_cell_width * x;

      for (let y = 0; y < slice.num_y; y++) {
        const yOffsetPx = slice.full_cell_height * y;

        const sliceUrl = painting.url.replace("{SLICE}", `(${x},${y})`);

        const sliceWidth = x === slice.num_x - 1
          ? slice.last_x_width
          : slice.full_cell_width;
        const sliceHeight = y === slice.num_y - 1
          ? slice.last_y_height
          : slice.full_cell_height;
        const sliceWidthPctOfFull = sliceWidth / res[0];
        const sliceHeightPctOfFull = sliceHeight / res[1];
        const sliceDims = [
          sliceWidthPctOfFull * newDims[0],
          sliceHeightPctOfFull * newDims[1],
        ];

        const texture = new THREE.TextureLoader().load(sliceUrl);
        const geometry = new THREE.PlaneGeometry(
          sliceDims[0],
          sliceDims[1],
          painting.depth_map_url ? DEPTH_MAP_RES : 1,
          painting.depth_map_url ? DEPTH_MAP_RES : 1,
        );
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });

        if (painting.normal_map_url) {
          const url = painting.normal_map_url.replace("{SLICE}", `(${x},${y})`);
          const normalMap = new THREE.TextureLoader().load(url);
          material.normalMap = normalMap;
          material.normalScale = new THREE.Vector2(
            NORMAL_MAP_SCALE,
            NORMAL_MAP_SCALE,
          );
          material.roughness = 0;
        }

        if (
          painting.depth_map_url &&
          (newDims[0] > DEPTH_MAP_MIN_DIMS || newDims[1] > DEPTH_MAP_MIN_DIMS)
        ) {
          const url = painting.depth_map_url.replace(
            "{SLICE}",
            `(${x},${y})`,
          );
          console.log("url", url);
          const displaceMap = new THREE.TextureLoader().load(url);
          material.displacementMap = displaceMap;
          material.displacementScale = DEPTH_MAP_SCALE;
          material.displacementBias = DEPTH_MAP_SCALE / 2;
        }

        const mesh = new THREE.Mesh(geometry, material);

        const xCenter = (sliceWidthPctOfFull / 2) * newDims[0];
        const yCenter = (sliceHeightPctOfFull / 2) * newDims[1];

        const xOffset = (xOffsetPx / res[0]) * newDims[0];
        const yOffset = (yOffsetPx / res[1]) * newDims[1];

        mesh.position.x = xCenter + xOffset + totalXOffset;
        mesh.position.y = yCenter + yOffset + totalYOffset;

        // y order needs to be inverted
        mesh.position.y *= -1;

        mesh.castShadow = true;

        scene.add(mesh);
        group.add(mesh);
      }
    }
  }

  // (for debugging) add a small sphere in the center of the painting
  // const sphereGeometry = new THREE.SphereGeometry(0.01, 32, 32);
  // const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  // const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  // sphere.position.set(0, 0, 0);
  // group.add(sphere);

  // const newPos = [0, newDims[1] / 2, -2.9];
  const newPos = [0, START_PAINTING_HEIGHT, -2.9];
  painting.pos = newPos;
  group.position.set(
    newPos[0],
    newPos[1],
    newPos[2],
  );

  // group.position.set(
  //   painting.pos[0] || 0,
  //   painting.pos[1] || 0,
  //   painting.pos[2] || 0,
  // );

  scene.add(group);

  paintingCache[painting.name] = {
    sceneItem: group,
    ...painting,
  };
}

function handleKeyboard(scene: THREE.Scene) {
  if (keysPressed["w"] === "down" || keysPressed["w"] === "pressed") {
    // move painting up
    const painting = getActivePainting();
    paintingCenterXYZ[1] += alpha;
    posDirty = true;
    // const joystickFwd = new THREE.Vector3(
    //   0,
    //   0,
    //   -alpha,
    // );
    // joystickFwd.applyQuaternion(body.quaternion);
    // body.position.add(joystickFwd);
  }

  if (keysPressed["s"] === "down" || keysPressed["s"] === "pressed") {
    // move painting down
    const painting = getActivePainting();
    paintingCenterXYZ[1] -= alpha;
    posDirty = true;
    // const joystickFwd = new THREE.Vector3(
    //   0,
    //   0,
    //   alpha,
    // );
    // joystickFwd.applyQuaternion(body.quaternion);
    // body.position.add(joystickFwd);
  }

  if (keysPressed["a"] === "down" || keysPressed["a"] === "pressed") {
    // move painting left
    paintingCenterXYZ[0] -= alpha;
    posDirty = true;

    // const joystickLeft = new THREE.Vector3(
    //   -alpha,
    //   0,
    //   0,
    // );
    // joystickLeft.applyQuaternion(body.quaternion);
    // body.position.add(joystickLeft);
  }

  if (keysPressed["d"] === "down" || keysPressed["d"] === "pressed") {
    // move painting right
    paintingCenterXYZ[0] += alpha;
    posDirty = true;
    // const joystickLeft = new THREE.Vector3(
    //   alpha,
    //   0,
    //   0,
    // );
    // joystickLeft.applyQuaternion(body.quaternion);
    // body.position.add(joystickLeft);
  }

  if (keysPressed["q"] === "down") {
    body.rotation.y += Math.PI / 180 * TURN_AMOUNT_DEGREES;
  }

  if (keysPressed["e"] === "down") {
    body.rotation.y -= Math.PI / 180 * TURN_AMOUNT_DEGREES;
  }

  if (keysPressed["g"] === "down") {
    mouthPopSound.play();
  }

  // if (keysPressed["ArrowUp"] === "pressed") {
  //   // move backward
  //   const fwd = new THREE.Vector3(0, 0, -alpha * 2);
  //   fwd.applyQuaternion(body.quaternion);
  //   body.position.add(fwd);

  //   // const up = new THREE.Vector3(0, 0.2, 0);
  //   // up.applyQuaternion(body.quaternion);
  //   // body.position.add(up);
  // }

  // if (keysPressed["ArrowDown"] === "pressed") {
  //   // move backward
  //   const fwd = new THREE.Vector3(0, 0, alpha * 2);
  //   fwd.applyQuaternion(body.quaternion);
  //   body.position.add(fwd);

  //   // const down = new THREE.Vector3(0, -0.2, 0);
  //   // down.applyQuaternion(body.quaternion);
  //   // body.position.add(down);
  // }

  if (keysPressed["ArrowRight"] === "down") {
    // next painting
    changePainting("next");
  }

  if (keysPressed["ArrowLeft"] === "down") {
    // prev painting
    changePainting("prev");
  }

  if (keysPressed["ArrowUp"] === "down") {
    changePainting("upres");
  }

  if (keysPressed["ArrowDown"] === "down") {
    changePainting("downres");
  }

  // if (keysPressed[" "] === "down") {
  //   changePainting();
  //   posDirty = true;
  // }

  for (const key in keysPressed) {
    if (keysPressed[key] === "down") {
      keysPressed[key] = "pressed";
    }
  }
}

init().then(animate);

let loadedPaintings = 0;

async function init() {
  await initPaintings();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x505050);

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    50,
  );
  camera.near = 0.001;
  camera.position.set(0, 1.6, 3);
  camera.add(listener);

  audioInit();

  room = new THREE.LineSegments(
    new BoxLineGeometry(6, 6, 6, 10, 10, 10),
    new THREE.LineBasicMaterial({ color: 0x808080 }),
  );
  room.geometry.translate(0, 3, 0);

  const floorTexture = new THREE.TextureLoader().load(
    "./assets/textures/wood-floor.png",
  );
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(4, 4);

  const floorNormalMap = new THREE.TextureLoader().load(
    "./assets/textures/wood-floor@normal.png",
  );
  floorNormalMap.wrapS = THREE.RepeatWrapping;
  floorNormalMap.wrapT = THREE.RepeatWrapping;
  floorNormalMap.repeat.set(4, 4);

  // flooring is a circle with a radius of 3 on the ground
  const flooring = new THREE.Mesh(
    new THREE.CircleGeometry(6, 32),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      normalMap: floorNormalMap,
      side: THREE.DoubleSide,
      // light gray
      // color: 0xa0a0a0,
    }),
  );
  flooring.rotation.x = Math.PI / 2;
  flooring.position.y = 0.01;
  scene.add(flooring);

  // sky: ./assets/models/skysphere.glb
  const gltfLoader = new GLTFLoader();
  gltfLoader.loadAsync("./assets/models/skysphere2.gltf").then((gltf) => {
    const sky = gltf.scene;
    sky.scale.setScalar(1);
    sky.castShadow = false;
    sky.receiveShadow = false;
    // find material on children
    sky.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshBasicMaterial({
          map: child.material.map,
          side: THREE.DoubleSide,
          // light gray
          color: 0xffffff,
          // color: 0xffffff,
        });
      }
    });
    scene.add(sky);
  });

  // addPainting(scene, paintings[0]);
  // renderPainting(scene, paintings[0]);
  changePainting();

  // scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

  const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
  ambientLight.intensity = 4;
  ambientLight.castShadow = true;
  scene.add(ambientLight);

  directionLight = new THREE.DirectionalLight(0xffffff);
  directionLight.intensity = 0.1;
  directionLight.position.set(1, 1, 1).normalize();
  directionLight.castShadow = true;
  scene.add(directionLight);

  // light = new THREE.PointLight(0xffffff, 1, 10);
  // light.position.set(0, 2, 0);
  // light.castShadow = false
  // scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true }) as WebGLRenderer;
  renderer.setPixelRatio(window.devicePixelRatio * 2);
  renderer.setSize(window.innerWidth, window.innerHeight);
  // renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.xr.enabled = true;

  document.body.appendChild(renderer.domElement);

  document.body.appendChild(VRButton.createButton(renderer));

  body = new THREE.Object3D();
  body.position.set(0, 0, 0);

  const head = new THREE.Object3D();
  head.add(camera);
  body.add(head);
  scene.add(body);

  preload();

  // controllers

  function onSelectStart() {
    this.userData.isSelecting = true;
  }

  function onSelectEnd() {
    this.userData.isSelecting = false;
  }

  function checkInteraction(button, inputSource, frame, renderer) {
    let tip = frame.getPose(inputSource.hand.get("index-finger-tip"), renderer.referenceSpace);
    let distance = calculateDistance(tip.transform.position, button.position);
    if (distance < button.radius) {
      if (!button.pressed) {
        button.pressed = true;
        button.onpress();
      }
    } else {
      if (button.pressed) {
        button.pressed = false;
        button.onrelease();
      }
    }
  }

  const controller1Space = renderer.xr.getController(0);
  if (controller1Space) {
    controller1Space.addEventListener("selectstart", onSelectStart);
    controller1Space.addEventListener("selectend", onSelectEnd);
    controller1Space.addEventListener("connected", function (event) {
      const gamepad = event?.data?.gamepad as Gamepad;
      if (!gamepad) return;
      controller1.gamepad = gamepad;
      this.add(buildController(event.data));
    });
    controller1Space.addEventListener("disconnected", function () {
      this.remove(this.children[0]);
    });
    controller1.space = controller1Space;
    head.add(controller1Space);

    console.log("all available buttons", controller1Space?.gamepad?.buttons);
  }

  const controller2Space = renderer.xr.getController(1);
  if (controller2Space) {
    controller2Space.addEventListener("selectstart", onSelectStart);
    controller2Space.addEventListener("selectend", onSelectEnd);
    controller2Space.addEventListener("connected", function (event) {
      const gamepad = event?.data?.gamepad as Gamepad;
      if (!gamepad) return;
      controller2.gamepad = gamepad;
      this.add(buildController(event.data));
    });
    controller2Space.addEventListener("disconnected", function () {
      this.remove(this.children[0]);
    });
    controller2.space = controller2Space;
    head.add(controller2Space);
  }

  const hand1Space = renderer.xr.getHand(0);
  if (hand1Space) {
    hand1Space.addEventListener("connected", function (event) {
      const gamepad = event?.data?.gamepad as Gamepad;
      if (!gamepad) return;
      controller1.gamepad = gamepad;
      this.add(buildHand(event.data));
    });
    hand1Space.addEventListener("disconnected", function () {
      this.remove(this.children[0]);
    });
    controller1.handSpace = hand1Space;
    head.add(hand1Space);
  }

  const hand2Space = renderer.xr.getHand(1);
  if (hand2Space) {
    hand2Space.addEventListener("connected", function (event) {
      const gamepad = event?.data?.gamepad as Gamepad;
      if (!gamepad) return;
      controller2.gamepad = gamepad;
      this.add(buildHand(event.data));
    });
    hand2Space.addEventListener("disconnected", function () {
      this.remove(this.children[0]);
    });
    controller2.handSpace = hand2Space;
    head.add(hand2Space);
  }


  const controllerModelFactory = new XRControllerModelFactory();

  const controllerGrip1 = renderer.xr.getControllerGrip(0) as THREE.XRGripSpace;
  controllerGrip1.add(
    controllerModelFactory.createControllerModel(controllerGrip1),
  );
  controller1.grip = controllerGrip1;
  head.add(controllerGrip1);

  const controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(
    controllerModelFactory.createControllerModel(controllerGrip2),
  );
  controller2.grip = controllerGrip2;
  head.add(controllerGrip2);

  //

  window.addEventListener("resize", onWindowResize);
}

function buildController(data) {
  let geometry, material;

  switch (data.targetRayMode) {
    case "tracked-pointer":
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3),
      );

      material = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      });

      return new THREE.Line(geometry, material);

    case "gaze":
      geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
      material = new THREE.MeshBasicMaterial({
        opacity: 0.5,
        transparent: true,
      });
      return new THREE.Mesh(geometry, material);
  }
}

function buildHand(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3),
  );

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Line(geometry, material);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

const alpha = 0.01;
const TURN_ACTIVATION_THRESHOLD = 0.25;
const TURN_AMOUNT_DEGREES = 30;
let isTurning = false;

type KeyPressDict = {
  [key: string]: "down" | "pressed" | "up";
};
const keysPressed: KeyPressDict = {};
document.addEventListener("keydown", (e) => {
  keysPressed[e.key] = "down";
});
document.addEventListener("keyup", (e) => {
  keysPressed[e.key] = "up";
});

function animate() {
  renderer.setAnimationLoop(render);
  console.log("[loaded] started animation loop");
}

let framerateSet = false;
function render() {
  handleController(controller1);
  handleController(controller2);
  handleKeyboard(scene);
  handleScene();

  if (!framerateSet && CUSTOM_FRAMERATE > 0 && renderer.xr.getSession()) {
    renderer.xr.getSession().updateTargetFrameRate(CUSTOM_FRAMERATE);
    framerateSet = true;
  }

  renderer.render(scene, camera);
}

const isPinching = (controller: Controller) => {
  // check if has hand set
  if (!controller.handSpace) {
    return false;
  }

  const indexFingerPos = controller.handSpace.joints?.["index-finger-tip"]?.position
  const thumbPos = controller.handSpace.joints?.["thumb-tip"]?.position

  if (!indexFingerPos || !thumbPos) {
    return false;
  }

  const distance = calculateDistance(indexFingerPos, thumbPos);
  return distance < 0.015;
}

const calculateDistance = (pos1, pos2) => {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
}


// control turning
// body.rotation.y += (controller.gamepad.axes[2] > 0 ? -1 : 1) * Math.PI /
//   180 * TURN_AMOUNT_DEGREES;
// isTurning = true;
