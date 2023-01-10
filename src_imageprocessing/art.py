# This file convers an art URL into a texture, normal map, and depth map in public/art/<name>
import os
import sys
import subprocess
import json
import re

dezoomify_regex = re.compile(r"\s*(\d)\.\s.*?(\d+).*?(\d+)\spixels.*?$")
dezoomify_prompt = "Which level do you want to download?"
dezoomify_max_area = 10000 * 10000

def download_with_dezoomify(url, path_to_store):
    process = subprocess.Popen(["dezoomify-rs", url, path_to_store],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    best_index = 0
    res_x = 0
    res_y = 0
    for line in process.stdout:
        decoded = line.decode("utf-8")

        # match to regex
        match = dezoomify_regex.match(decoded)
        if match:
            index = int(match.group(1))
            x = int(match.group(2))
            y = int(match.group(3))
            dezoomify_max_area = 10000 * 10000
            print(f"index: {index}, x: {x}, y: {y}")
            if x * y < dezoomify_max_area and x * y > res_x * res_y:
                best_index = index
                res_x = x
                res_y = y

        if dezoomify_prompt in decoded:
            break

    x = best_index

    print(f"best index: {x}")
    process.stdin.write(str(x).encode("utf-8"))
    process.stdin.write("\n".encode("utf-8"))
    process.stdin.close()
    process.wait()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        # can also do --low-res AFTER inputs
        print("Usage: python3 art.py <url-or-local-path> <short-hyphenated-name>")
        exit()

    # setup variables
    url = sys.argv[1]
    name = sys.argv[2]
    low_res = len(sys.argv) > 3 and sys.argv[3] == "--low-res"
    art_dir = f"public/art/" if not low_res else f"public/art_lowres/"
    dest_dir = f"public/art/{name}" if not low_res else f"public/art_lowres/{name}"
    dest_dir_without_public = f"art/{name}" if not low_res else f"art_lowres/{name}"

    print(f"URL: {url}")
    print(f"Dest: {dest_dir}")
    print(f"ID: {name}")
    print(f"Res: {'low' if low_res else 'high'}")

    res = [-1, -1]
    dims = [-1, -1]

    temp_art_file = f'temp/texture.png'

    # clean and rebuild temp dir
    os.system("rm -r temp")
    os.system("mkdir temp")

    if low_res:
        # (0) instead of scraping for dimensions, first look for existing highres file
        if os.path.exists(f"public/art/{name}/texture.json"):
            with open(f"public/art/{name}/texture.json", "r") as f:
                data = json.load(f)
                dims = data["dims"]

    if not url.startswith("http"):
        # (1+2) copy existing local file to temp/
        os.system(f"cp {url} {temp_art_file}")
    else:
        # (1) run scrape art to get dimensions and the url of an image
        output = subprocess.check_output(
            ["deno", "run", "-A", "src_imageprocessing/scrape_art.ts", sys.argv[1]])
        json_output = json.loads(output)

        print(json_output)

        url = json_output["url"]
        res = [-1, -1] if "res" not in json_output else json_output["res"]
        dims = json_output["dims"]

        # (2) download the image
        if "artsandculture.google.com/" in url:
            # for google, use dezoomify
            download_with_dezoomify(url, temp_art_file)
        else:
            # wikiart/wikipedia/etc.
            subprocess.run(["scripts/download.sh", url, temp_art_file])

    # (3) run process_art.py to create normals, depth, and json
    subprocess.run(
        ["python3", "src_imageprocessing/process_art.py", temp_art_file, "temp/", "false" if low_res else "false", "false" if low_res else "true"])

    # (4) move everything to public/art/<name>
    os.system(f"rm {temp_art_file}")
    os.system(f"mkdir -p {dest_dir}")
    os.system(f"mv temp/* {dest_dir}")

    # (5) update json file with new urls
    json_path = f"{dest_dir}/texture.json"
    data = {}
    with open(json_path, 'r') as f:
        data = json.load(f)
        if dims is not None:
            data["dims"] = dims
        else:
            data["dims"] = [1, 1]

        data['id'] = name
        data['name'] = name
        data["og_url"] = url
        data['url'] = f'{dest_dir_without_public}/texture{{SLICE}}.jpg'

        if not low_res:
            data['normal_map_url'] = f'{dest_dir_without_public}/texture@normal{{SLICE}}.jpg'
            data['depth_map_url'] = f'{dest_dir_without_public}/texture@depth{{SLICE}}.jpg'

        # overwrite res
        res = data["res"]

        # write back to file
        with open(json_path, "w") as f:
            json.dump(data, f, indent=4)

    # (6) update index.json - directory of all artwork
    index_path = f"{art_dir}/index.json"
    if not os.path.exists(index_path):
        with open(index_path, "w") as f:
            json.dump([], f)
    with open(index_path, "r") as f:
        index = json.load(f)
        # remove all instances of name
        index = [x for x in index if x["name"] != name]
        # add to front
        index.insert(0, data)

        with open(index_path, "w") as f:
            json.dump(index, f, indent=4)

    # done! capture total size of directory
    size = subprocess.check_output(["du", "-sh", f"{art_dir}{name}"])
    size_str = size.decode("utf-8").split("\t")[0]
    print(f'Total size: {size_str}')
