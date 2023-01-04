
from PIL import Image
import sys
import math

MAX_SLICE_DIM = 4096

QUALITY_LEVELS = {
    "low": {
        'type': 'jpg',
        "quality": 80,
        "max_out_dim": 1024,
    },
    "full": {
        'type': 'jpg',
        "quality": 85,
        "max_out_dim": 4096,
    }
}


def main(image_path, output_path, quality='full', nice_seams=False):
    image = Image.open(image_path)
    image_width = image.width
    image_height = image.height
    image_name, image_ext = image_path.split(".")
    image_name_after_slash = image_name.split("/")[-1]

    # Log the image name and size
    print(f"image name: {image_name}")
    print(f"image size: {image_width}x{image_height}")

    MAX_TILE_HEIGHT = MAX_SLICE_DIM
    MAX_TILE_WIDTH = MAX_SLICE_DIM
    quality = QUALITY_LEVELS[quality]

    if image_width <= MAX_TILE_WIDTH and image_height <= MAX_TILE_HEIGHT:
        print("image is smaller than max tile size, just converting to jpg")

        data = {
            "slice": {
                "num_x": 1,
                "num_y": 1,
                "full_cell_width": image_width,
                "full_cell_height": image_height,
                "last_x_width": image_width,
                "last_y_height": image_height,
            },
            "res": [image_width, image_height],
        }

        # if image_ext == "jpg":
        #     print("image is already jpg, no need to convert")
        #     return data

        # resize depending on quality level
        if quality["max_out_dim"] < image.width or quality["max_out_dim"] < image.height:
            image.thumbnail(
                (quality["max_out_dim"], quality["max_out_dim"]))

        print(f"converting {image_path} to jpg")
        image.save(f"{output_path}/{image_name_after_slash}.jpg",
                   "JPEG", quality=quality["quality"])

        return data

    full_cell_width = min(image_width, MAX_TILE_WIDTH)
    full_cell_height = min(image_height, MAX_TILE_HEIGHT)

    num_x = math.ceil(image_width / full_cell_width)
    num_y = math.ceil(image_height / full_cell_height)

    last_x_width = image_width % MAX_TILE_WIDTH
    last_y_height = image_height % MAX_TILE_HEIGHT

    print(f"num_x: {num_x}")
    print(f"num_y: {num_y}")

    for x in range(num_x):
        print(f"processing column {x}")
        is_last_column = x == num_x - 1
        cell_width = last_x_width if is_last_column else full_cell_width

        for y in range(num_y):
            print(f"processing row {y}")
            is_last_row = y == num_y - 1
            cell_height = last_y_height if is_last_row else full_cell_height

            slice = {
                "x": x * full_cell_width,
                "y": y * full_cell_height,
                "width": cell_width,
                "height": cell_height
            }

            outfile_path = f"{output_path}/{image_name_after_slash}({x},{y}).jpg"

            print(f"saving {outfile_path}")
            print(f"slice: {slice}")

            slice_image = image.crop(
                (slice["x"], slice["y"], slice["x"] + slice["width"], slice["y"] + slice["height"]))

            if nice_seams:
                # make the edges all 50% so that there are less obvious seams
                # between tiles
                slice_image = slice_image.convert("RGB")
                pixels = slice_image.load()
                for i in range(slice_image.size[0]):
                    pixels[i, 0] = (127, 127, 127)
                    pixels[i, slice_image.size[1] - 1] = (127, 127, 127)
                for i in range(slice_image.size[1]):
                    pixels[0, i] = (127, 127, 127)
                    pixels[slice_image.size[0] - 1, i] = (127, 127, 127)

            # resize depending on quality level
            if quality["max_out_dim"] < slice_image.width or quality["max_out_dim"] < slice_image.height:
                slice_image.thumbnail(
                    (quality["max_out_dim"], quality["max_out_dim"]))

            slice_image.save(outfile_path, "JPEG", quality=quality["quality"])

    data = {
        "slice": {
            "num_x": num_x,
            "num_y": num_y,
            "full_cell_width": full_cell_width,
            "full_cell_height": full_cell_height,
            "last_x_width": last_x_width,
            "last_y_height": last_y_height,
        },
        "res": [(num_x - 1) * full_cell_width + last_x_width, (num_y - 1) * full_cell_height + last_y_height],
    }

    return data


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
