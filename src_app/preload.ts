import * as THREE from "three";
import { paintings } from "./paintings";

const textureLoader = new THREE.TextureLoader();
const preload = () => {
  const text = document.querySelector("#text");

  console.log("Paintings to preload: ", paintings.length);
  let numImagesLoaded = 0;
  let numImagesToLoad = 0;

  function updateText() {
    if (!numImagesToLoad) {
      text.innerHTML = "Loading (0%)";
      return;
    }
    const pct = Math.round((numImagesLoaded / numImagesToLoad) * 100);
    text.innerHTML =
      `Loading ${numImagesLoaded} / ${numImagesToLoad} (${pct})%`;

    if (pct > 50) {
      text.style.color = "yellow";
    }

    if (pct > 80) {
      text.style.color = "green";
    }
  }

  paintings.forEach((painting) => {
    return;
    const isOneElementGrid = !painting.slice || (painting.slice.num_x === 1 &&
      painting.slice.num_y === 1);
    for (let x = 0; x < painting.slice?.num_x ?? 1; x++) {
      for (let y = 0; y < painting.slice?.num_y ?? 1; y++) {
        updateText();
        const sliceUrl = isOneElementGrid
          ? painting.url.replace("{SLICE}", "")
          : painting.url.replace("{SLICE}", `(${x},${y})`);

        console.log(
          `Loading ${sliceUrl} ${JSON.stringify(textureLoader, null, 2)}`,
        );
        numImagesToLoad++;
        textureLoader.load(
          sliceUrl,
          (texture) => {
            numImagesLoaded++;
            updateText();
            console.log(`Loaded ${sliceUrl}`);
          },
          undefined,
          (err) => {
            console.error(`Failed to load ${sliceUrl}`, err);
            numImagesToLoad--;
            updateText();
          },
        );

        if (painting.normal_map_url) {
          const normalMapUrl = painting.normal_map_url.replace(
            "{SLICE}",
            isOneElementGrid ? "" : `(${x},${y})`,
          );
          numImagesToLoad++;
          textureLoader.load(
            normalMapUrl,
            (texture) => {
              numImagesLoaded++;
              updateText();
              console.log(`Loaded ${normalMapUrl}`);
            },
            undefined,
            (err) => {
              console.error(`Failed to load ${normalMapUrl}`, err);
              numImagesToLoad--;
              updateText();
            },
          );
        }

        if (painting.depth_map_url) {
          const depthMapUrl = painting.depth_map_url.replace(
            "{SLICE}",
            isOneElementGrid ? "" : `(${x},${y})`,
          );
          numImagesToLoad++;
          textureLoader.load(
            depthMapUrl,
            (texture) => {
              numImagesLoaded++;
              updateText();
              console.log(`Loaded ${depthMapUrl}`);
            },
            undefined,
            (err) => {
              console.error(`Failed to load ${depthMapUrl}`, err);
              numImagesToLoad--;
              updateText();
            },
          );
        }
      }
    }
  });
};

export { preload };
