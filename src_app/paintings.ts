const SEATED = true;

export type PaintingSpec = {
  id: string;
  name: string;
  artist: string;
  year: number;
  description: string;

  dims?: [number, number];
  res: [number, number];
  slice: {
    "num_x": number;
    "num_y": number;
    "full_cell_width": number;
    "full_cell_height": number;
    "last_x_width": number;
    "last_y_height": number;
  };

  url: string;
  og_url?: string;
  alt_url?: string;
  normal_map_url?: string;
  depth_map_url?: string;

  tags?: string[];
};

// load paintings from /art/index.json
export const paintings: PaintingSpec[] = [];

const lowResPaintings: PaintingSpec[] = [
  {
    "name": "The Starry Night",
    "artist": "Vincent van Gogh",
    "year": 1889,
    "url":
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
    "dims": [
      0.737,
      0.9209999999999999,
    ],
    "res": [
      1280,
      1013,
    ],
    "og_url":
      "https://en.wikipedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
  },
];

export const initPaintings = async (): Promise<void> => {
  // check if user agent is VR
  const isVR = navigator.userAgent.includes("VR") ||
    navigator.userAgent.includes("Oculus");
  if (isVR) {
    const response = await fetch("/art/index.json");
    try {
      const json = await response.json();
      paintings.push(...json);
    } catch (e) {
      document.querySelector('#text').innerHTML = "Failed to load custom paintings. Falling back to built-ins."
      console.warn(
        "Failed to load custom paintings.",
        e,
        "Falling back to built-ins.",
      );
      paintings.push(...lowResPaintings);
    }
  } else {
    document.querySelector('#text').innerHTML = "Please use a VR headset to load the full experience."
    console.warn("Not VR, falling back to built-ins.");
    paintings.push(...lowResPaintings);
  }
};

export const getPaintings = (): PaintingSpec[] | null => {
  if (paintings.length === 0) {
    return null;
  }
  return paintings;
};