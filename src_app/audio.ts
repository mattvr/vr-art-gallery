import * as THREE from "three";

const listener = new THREE.AudioListener();

const ambienceSound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();
const mouthPopSound = new THREE.Audio(listener);

const init = () => {
  audioLoader.loadAsync("assets/audio/ambience.mp3").then((buffer) => {
    ambienceSound.setBuffer(buffer);
    ambienceSound.setLoop(true);
    ambienceSound.setVolume(0.5);
    ambienceSound.play();
  });

  audioLoader.loadAsync("assets/audio/mouth-pop.wav").then((buffer) => {
    mouthPopSound.setBuffer(buffer);
    mouthPopSound.setLoop(false);
    mouthPopSound.setVolume(0.5);
  });
};

export {init, mouthPopSound, listener}