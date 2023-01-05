# VR Art Gallery (WebXR)

View artworks like the Mona Lisa, The Sistine Chapel, Starry Night as they
appear in real life.

Rendered to scale with realistic texture. Ultra HD (10K+). As a virtual reality website!

<video src="https://user-images.githubusercontent.com/4052466/210516174-53ad4164-b135-49a8-a557-013375c00061.mp4" autoplay loop></video>

---

## [Live demo](https://cosm.run)

**Visit https://cosm.run from your VR headset's browser.**

Click the "Enter VR" button. Note that loading may take awhile and be choppy because of the massive files. High-speed internet required.

**Controls:**

- Left joystick: Move painting up / down / left / right.

- Right joystick: Switch to next or previous painting.

- Right trigger: Bring painting closer or further away.

---

## How it works

1. This is app/website is built using [WebXR](https://immersiveweb.dev/) and
   [Three.JS](https://threejs.org/).

2. High-resolution public domain artwork was scraped from Wikimedia and similar
   websites.

3. This artwork was then sliced up into smaller chunks, and processed to show
   depth and lighting effects, by generating normal & displacement maps.

![the pipeline of artwork from ingestion to generation of normal maps and depth maps, to an output VR ready image, shown for Starry Night by Van Gogh](https://user-images.githubusercontent.com/4052466/210637353-8a423bb3-1357-4d77-a127-6c56608238a3.jpg)

4. For some classic paintings, I couldn't find high-resolution scans. For these,
   I used [ESRGAN](https://github.com/xinntao/Real-ESRGAN) which increases the
   resolution of images via a generative adversarial network.

![comparing the best online image of Cupid and Psyche by Bougeareau vs. after processing with ESRGAN which increases its resolution 3x](https://user-images.githubusercontent.com/4052466/210637132-5aa42e18-3dca-4b53-a2c9-e35d4ca4bfa5.jpg)

---

## To run your own instance

```sh
npm install
npm run dev
```

This will start a server on your local network you can see at
[`https://localhost`](https://localhost). You'll see a security warning that appears for using a self-signed certificate, this is safe to bypass.

You will then need to visit your local IP address on your VR headset's browser
to use the app (likely something like: `https://192.168.1.123`).

> ⚠️ Note: If running locally, you will have only a limited set of artwork available. You need to manually generate assets for custom art, as the files are too large to be included in this repo. See next section.

### Loading custom artwork

To load in your own artwork, you will need to pre-process it before it can be
used in the app.

Install dependencies:
[`deno`](https://deno.land/manual@v1.29.1/getting_started/installation),
[`python3`](https://www.python.org/downloads/),
`pip install -r requirement.txt`, `npm install`, and (if using Google Arts &
Culture) [`dezoomify-rs`](https://github.com/lovasoa/dezoomify-rs)

Once installed, find a painting on [Wikipedia](https://wikipedia.org),
[WikiArt](https://wikiart.org), or
[Google Arts & Culture](https://artsandculture.google.com/) and copy its URL.

Then run:

```sh
./scripts/art.sh <valid-url> <unique-hyphenated-name-for-art>
```

This will automatically generate slices, normal maps, and displacement maps for
your art. You may need to manually adjust some of the values it writes to
`public/art/index.json`. More about this in [`scripts/`](/scripts/README.md)

Force refresh the page (`Cmd+Shift+R`) to see your artwork loaded in!

---

## TODO

- Improve performance loading images
- Use WebXR layers for higher resolution
- Add augmented reality support
- Way to browse artwork
- Automate more of image processing, super-resolution

---

🖼️ + 🥽
