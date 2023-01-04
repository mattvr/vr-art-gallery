import numpy as np
import sys
from PIL import Image
from scipy.ndimage import convolve

JPG_QUALITY = 80
JPG_MAX_DIM = 4096

def generate_normal_map(image, scale=1, invert_red=False, invert_green=False):
    grayscale = gen_grayscale(image)

    # Calculate the gradient of the grayscale image using a Sobel operator
    grad_x = convolve(grayscale, [[-1, 0, 1]])
    grad_y = convolve(grayscale, [[-1], [0], [1]])

    # Calculate the surface normals using the gradient
    normals = np.dstack((
        -scale * grad_x,
        scale * grad_y,
        np.ones_like(grad_x)
    ))

    # Normalize the normals
    normals /= np.linalg.norm(normals, axis=2)[:, :, np.newaxis]

    # Optionally invert the red and green channels of the normal map
    if invert_red:
        normals[:, :, 0] = -normals[:, :, 0]
    if invert_green:
        normals[:, :, 1] = -normals[:, :, 1]

    # Convert the normals to an image
    normal_map = np.clip((normals + 1.0) / 2.0, 0.0, 1.0)
    return normal_map


def gen_grayscale(image):
    # Use the luminosity method to convert to grayscale
    # Remove the alpha channel if it exists
    grayscale = np.dot(image[..., :3], [0.299, 0.587, 0.114])
    return grayscale


def save_image(output_path, image_name, image_arr, type, lossless=True):
    # slice image name before the final slash and replace with output path
    image_name = image_name.split("/")[-1]
    outfile_path = f"{output_path}/{image_name}@{type}.{'png' if lossless else 'jpg'}"
    print(f"saving {outfile_path}")

    image = Image.fromarray((image_arr * 255).astype(np.uint8))

    if not lossless:
        image.thumbnail((JPG_MAX_DIM, JPG_MAX_DIM), Image.ANTIALIAS)
        image.save(outfile_path, "JPEG", quality=JPG_QUALITY)
    else:
        image.save(outfile_path, "PNG")

    # save as png
    image.save(outfile_path, "PNG")
    return outfile_path


def main(image_path, output_path, lossless=True):
    image = Image.open(image_path)

    [image_name, image_ext] = image_path.split(".")

    normal_map = generate_normal_map(np.array(image), scale=0.08)
    normal_map_path = save_image(
        output_path, image_name, normal_map, "normal", lossless)

    # now grayscale the normal map and save it
    grayscale_normal_map = gen_grayscale(normal_map)
    depth_map_path = save_image(
        output_path, image_name, grayscale_normal_map, "depth", lossless)

    # print the image name and size
    print(f"image name: {image_path}")

    return normal_map_path, depth_map_path


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
