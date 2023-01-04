#!/bin/bash
if [ $# -ne 2 ]; then
    echo "Usage: $0 <url> <output_file>"
    exit 1
fi
curl -o $2 $1