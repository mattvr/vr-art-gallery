# scripts

Scripts for development, deployment, and image processing. Run these from the project root.

# dev.sh

_Hosts a web server while live compiling any Typescript changes you make._

Requires:

- `node`, `npm`, `npm install`

Usage:

```sh
./scripts/dev.sh
```

# art.sh

*Converts an art URL into a texture, normal map, and depth map in `public/art/<name>`*

Usage:

```sh
./scripts/art.sh <valid_url> <short_hyphenated_name_for_art>
```

# scrape_art.sh

_Scrapes public domain artwork from Wikipedia, WikiArt, or Google Arts & Culture
to get its physical dimensions and full-resolution image URL._

Requires:

- `deno`

Usage:

```sh
./scripts/scrape_art.sh <url>
```

# download.sh / download_hires.sh

_Uses dezoomify-rs or curl to download high-res artwork and save it locally._

Requires:

- `cargo`, `cargo install dezoomify-rs`, `libcurl`, `python3`

Usage:

```sh
./scripts/download_hires.sh <url> <output_file>
```

# process_art.sh

_Processes local images, generating normal & height maps for it, and slicing
images into 4096x4096 chunks._

Requires:

- `python3`, `pip install -r requirements.txt`

Usage:

```sh
./scripts/process_art.sh <input_file> <output_path>
```
