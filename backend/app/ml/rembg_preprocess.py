"""
Usage:
    python rembg_preprocess.py <input_path> <output_path>

Exit codes:
    0  — success, output_path written
    1  — rembg not installed
    2  — any other error
"""
import sys
import os

def main():
    if len(sys.argv) != 3:
        print("Usage: rembg_preprocess.py <input> <output>", file=sys.stderr)
        sys.exit(2)

    input_path  = sys.argv[1]
    output_path = sys.argv[2]

    try:
        from rembg import remove
        from PIL import Image
    except ImportError as e:
        print(f"ImportError: {e}", file=sys.stderr)
        print("Install with:  pip install rembg[gpu]  (or rembg if no CUDA)", file=sys.stderr)
        sys.exit(1)

    try:
        input_img = Image.open(input_path).convert("RGBA")
        removed   = remove(input_img)          # RGBA, alpha = mask

        # Composite onto a solid light-grey background — TripoSR works best with
        # a neutral, uniform background rather than pure white (avoids blown edges).
        bg = Image.new("RGBA", removed.size, (200, 200, 200, 255))
        composite = Image.alpha_composite(bg, removed).convert("RGB")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        composite.save(output_path)
        print(f"rembg: saved to {output_path}")
        sys.exit(0)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()