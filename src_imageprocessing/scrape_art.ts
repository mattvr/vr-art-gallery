// scrape-art.ts
// gets physical dimensions & highest res image, given
// (a) WikiArt painting ID/URL
// (b) Google Arts & Culture painting URL
// or (c) Wikimedia painting URL

// example inputs:
// 193173 (WikiArt painting ID)
// michelangelo/sistine-chapel-ceiling-creation-of-adam-1510 (WikiArt painting URL)
// https://www.wikiart.org/en/michelangelo/sistine-chapel-ceiling-creation-of-adam-1510 (WikiArt painting URL)
// https://artsandculture.google.com/asset/movement-in-squares-bridget-riley/dwGpQ5o3Dc4FrQ (Google Arts & Culture painting URL)
// https://commons.wikimedia.org/wiki/File:Edvard_Munch_-_The_Sun_-_Google_Art_Project.jpg (Wikipedia painting URL)

import { DOMParser } from "https://esm.sh/linkedom";

const getPaintingDetailsGivenId = async (id: string) => {
  const paintingDetailsUrl =
    `https://www.wikiart.org/en/App/Painting/ImageJson/${id}`;

  const paintingDetailsJson = await fetch(
    paintingDetailsUrl,
  )
    .then((res) => res.json());

  console.log(paintingDetailsUrl, paintingDetailsJson);

  const { artistUrl, url, sizeX, sizeY } = paintingDetailsJson;
  return { artistUrl, url, sizeX, sizeY, paintingDetailsUrl };
};

const getPaintingIdGivenShortUrl = async (shortUrl: string) => {
  return `https://www.wikiart.org/en/${shortUrl}?json=2`;
};

const getPaintingWebGivenShortUrl = async (shortUrl: string) => {
  const paintingWebsiteUrl = `https://www.wikiart.org/en/${shortUrl}`;
  const paintingWebsiteHtml = await fetch(paintingWebsiteUrl).then((res) =>
    res.text()
  );
  return { paintingWebsiteUrl, paintingWebsiteHtml };
};

const getWikiArt = async (input: string) => {
  // console.log("input is", input);
  const isId = input.match(/^\d+$/);
  const isShortUrl = input.match(/^[a-z]+\/[a-z-]+$/);

  let sizeX = null;
  let sizeY = null;
  let id = null;
  let shortUrl = null;
  let paintingDetailsUrl = null;
  if (isId) {
    const details = await getPaintingDetailsGivenId(input);
    paintingDetailsUrl = details.paintingDetailsUrl;
    sizeX = details.sizeX;
    sizeY = details.sizeY;
    shortUrl = `${details.artistUrl}/${details.url}`;
  } else {
    shortUrl = input;
  }

  const { paintingWebsiteHtml, paintingWebsiteUrl } =
    await getPaintingWebGivenShortUrl(`${shortUrl}`);

  // parse html
  const doc = new DOMParser().parseFromString(
    paintingWebsiteHtml,
    "text/html",
  );

  if (!isId) {
    // look for the text ANYWHERE in doc
    // example: 91 x 73.5 cm
    // regex: (\d+\.?\d*) x (\d+\.?\d*) cm
    const regex = /(\d+\.?\d*) x (\d+\.?\d*) cm/;

    const text = doc.querySelector("body").textContent;
    const match = text.match(regex);
    if (match) {
      sizeX = Number(match[1]);
      sizeY = Number(match[2]);
    }
  }

  // find all ".image-variants-container a"
  const imageVariants = doc.querySelectorAll(".image-variants-container a");

  // map to the attrib value for data-max-resolution
  const imageVariantsResolutions = Array.from(imageVariants).map((a) =>
    a.getAttribute("data-max-resolution")
  ).filter(Boolean).map((res) =>
    res.substring(0, res.length - 2).split("x").map(Number)
  );

  const imageVariantsUrls = Array.from(imageVariants).map((a) =>
    a.getAttribute("data-image-url") ?? a.getAttribute("data-source-url")
  ).filter(Boolean).map((x) => x.split("!Large")[0]);

  // get the highest res
  const sortedResolutions = [];
  for (let i = 0; i < imageVariantsResolutions.length; i++) {
    const [width, height] = imageVariantsResolutions[i];
    const object = {
      pixels_x: width,
      pixels_y: height,
      cm_x: sizeX,
      cm_y: sizeY,
      index: i,
      url: imageVariantsUrls[i],
    };
    if (
      sortedResolutions.length !== 0 &&
      sortedResolutions[0].pixels_x >= width
    ) {
      sortedResolutions.push(object);
    } else {
      sortedResolutions.unshift(object);
    }
  }

  if (sortedResolutions.length === 0) {
    const maxResolution = doc.querySelector(".max-resolution")?.textContent
      .match(
        /(\d+)x(\d+)px/,
      );

    const url = doc.querySelector(".wiki-layout-artist-image-wrapper img")
      ?.getAttribute("src").split("!Large")[0];

    if (maxResolution) {
      const [width, height] = maxResolution.slice(1).map(Number);
      const object = {
        pixels_x: width,
        pixels_y: height,
        cm_x: sizeX,
        cm_y: sizeY,
        index: 0,
        url: url,
      };
      sortedResolutions.push(object);
    }
    // console.log(
    //   "no resolutions found",
    //   input,
    //   paintingDetailsUrl,
    //   paintingWebsiteUrl,
    //   imageVariantsResolutions,
    // );
    // return;
  }

  // console.log("all resolutions", sortedResolutions);

  const paintingOutput = {
    name: shortUrl,
    res: [sortedResolutions[0].pixels_x, sortedResolutions[0].pixels_y],
    dims: [
      Number((sortedResolutions[0].cm_x / 100).toFixed(2) || 1),
      Number((sortedResolutions[0].cm_y / 100).toFixed(2) || 1),
    ],
    url: sortedResolutions[0].url,
  };

  //   console.log(`
  //   painting details url: ${paintingDetailsUrl}\n
  //   painting web url: ${paintingWebsiteUrl}\n
  //   image url: ${sortedResolutions[0].url}\n
  //   highest res: ${sortedResolutions[0].pixels_x} x ${
  //     sortedResolutions[0].pixels_y
  //   }\n
  //   dimensions: ${sortedResolutions[0].cm_x}cm x ${
  //     sortedResolutions[0].cm_y
  //   }cm\n\n
  // fulldata: ${JSON.stringify(paintingOutput, null, 2)}
  //   `);
  console.log(JSON.stringify(paintingOutput, null, 2));
};

const getGoogArt = async (input: string) => {
  const paintingWebsiteUrl = input;
  const paintingWebsiteHtml = await fetch(paintingWebsiteUrl).then((res) =>
    res.text()
  );

  const doc = new DOMParser().parseFromString(
    paintingWebsiteHtml,
    "text/html",
  );

  // Format is: "Physical Dimensions: 123.2 x 121.2cm"
  // Also may see "Physical Dimensions: h123 x w123mm"
  // 1. Find span element with text "Physical Dimensions:"
  // 2. Get the parent element
  // 3. Get the textContent which should match XXX x XXXcm

  const physicalDimensions = doc.querySelector(
    "span:contains('Physical Dimensions:')",
  )?.parentElement?.textContent;

  const cmRegex = /(\d+\.?\d*)\s?[x×]\s?(\d+\.?\d*)\s?cm/;
  const cmMatch = physicalDimensions?.match(cmRegex);

  let sizeX = null;
  let sizeY = null;
  if (cmMatch) {
    sizeX = Number(cmMatch[1]);
    sizeY = Number(cmMatch[2]);
  } else {
    const mmRegex = /h?(\d+\.?\d*)\s?[x×]\s?w?(\d+\.?\d*)\s?mm/;
    const mmMatch = physicalDimensions?.match(mmRegex);

    if (mmMatch) {
      sizeX = Number(mmMatch[1]) / 10;
      sizeY = Number(mmMatch[2]) / 10;
    } else {
      const reverseMmRegex = /w?(\d+\.?\d*)\s?[x×]\s?h?(\d+\.?\d*)\s?(?:mm)/;
      const reverseMmMatch = physicalDimensions?.match(reverseMmRegex);
      if (reverseMmMatch) {
        sizeX = Number(reverseMmMatch[2]) / 10;
        sizeY = Number(reverseMmMatch[1]) / 10;
      }
    }
  }

  const mSizeX = sizeX / 100;
  const mSizeY = sizeY / 100;

  console.log(
    JSON.stringify(
      { dims: [mSizeX || 1, mSizeY || 1], url: paintingWebsiteUrl },
      null,
      2,
    ),
  );
};

const getWikiMedia = async (input: string) => {
  const paintingWebsiteUrl = input;
  const paintingWebsiteHtml = await fetch(paintingWebsiteUrl).then((res) =>
    res.text()
  );

  const doc = new DOMParser().parseFromString(
    paintingWebsiteHtml,
    "text/html",
  );

  let imageUrl = doc.querySelector(".fullImageLink a")?.getAttribute("href");

  if (imageUrl.startsWith("//")) {
    imageUrl = "https:" + imageUrl;
  }

  const regex =
    /height:\s?(?<height>\d+)\s?(?<measurement>cm|mm).*?width:\s?(?<width>\d+)\s?(cm|mm)/gm;

  const match = regex.exec(doc.body);

  if (match) {
    const { height, width, measurement } = match.groups;
    const mHeight = Number(height) / (measurement === "cm" ? 100 : 1000);
    const mWidth = Number(width) / (measurement === "cm" ? 100 : 1000);

    console.log(
      JSON.stringify(
        { dims: [mWidth || 1, mHeight || 1], url: imageUrl },
        null,
        2,
      ),
    );
  }
};

const arg = Deno.args[0];

if (arg) {
  if (arg.startsWith("https://artsandculture.google.com/")) {
    await getGoogArt(arg);
  } else if (
    arg.startsWith(
      "https://commons.wikimedia.org/wiki/",
    ) ||
    arg.includes("wikipedia.org/wiki/File")
  ) {
    await getWikiMedia(arg);
  } else {
    const startToRemove = /https:\/\/(?:www\.)?wikiart\.org\/en\//;
    await getWikiArt(arg.replace(startToRemove, ""));
  }
} else {
  console.warn("ERR");
}
