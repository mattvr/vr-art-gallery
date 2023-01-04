import gen_textures
import slice_art
import sys
import time
import os
import json
from PIL import Image
Image.MAX_IMAGE_PIXELS = 1000000000


def write_json(image_name_after_slash, output_path, data):
    with open(f"{output_path}/{image_name_after_slash}.json", "w") as f:
        print(f"writing json to {output_path}/{image_name_after_slash}.json")
        json.dump(data, f, indent=4)


def main():
    start_time = time.time()

    if len(sys.argv) < 3:
        print("usage: python process_art.py <original_image_path> <output_path> <optional:should_slice> <optional:should_generate_maps>")
        sys.exit(1)

    image_path = sys.argv[1]
    output_path = sys.argv[2]
    should_slice = sys.argv[3] if len(sys.argv) > 3 else "true"
    should_generate_maps = sys.argv[4] if len(sys.argv) > 4 else "true"

    if not os.path.exists(image_path):
        print(f"image_path: {image_path} does not exist")
        sys.exit(1)

    if not os.path.exists(output_path):
        os.makedirs(output_path)

    print(f"image_path: {image_path}")
    print(f"output_path: {output_path}")
    print(f"should_slice: {should_slice}")
    print(f"should_generate_maps: {should_generate_maps}")

    slice_data = {}

    # generate normal and depth maps
    if should_generate_maps == "true":
        normal_map_path, depth_map_path = gen_textures.main(
            image_path, output_path, lossless=should_slice == "true")

        if should_slice == "true":
            # slice images into grid
            slice_data = slice_art.main(image_path, output_path)
            slice_art.main(normal_map_path, output_path, quality='low')
            slice_art.main(depth_map_path, output_path,
                           quality='low', nice_seams=True)

            slice_data['url'] = (
                output_path + "/" + image_path.split("/")[-1]).replace('.jpg', '{SLICE}.jpg')

            os.remove(normal_map_path)
            os.remove(depth_map_path)
        else:
            # get image size
            image = Image.open(image_path)
            width, height = image.size

            # copy og image to output path
            os.system(f"cp {image_path} {output_path}")

            slice_data = {
                "res": [width, height],
                "url": output_path + "/" + image_path.split("/")[-1]
            }

        slice_data = {
            "normal_map_url": normal_map_path.replace('.png', '{SLICE}.jpg' if should_slice else '.png'),
            "depth_map_url": depth_map_path.replace('.png', '{SLICE}.jpg' if should_slice else '.png'),
            **slice_data
        }

    # no need to generate maps, just slice into grid
    elif should_slice == "true":
        slice_data = slice_art.main(image_path, output_path)

    # write json
    image_name_after_slash = image_path.split("/")[-1].split(".")[0]
    write_json(image_name_after_slash, output_path, slice_data)

    print(f"done in {time.time() - start_time}s")


if __name__ == "__main__":
    main()
