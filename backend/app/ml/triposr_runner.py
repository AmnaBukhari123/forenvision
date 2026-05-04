# backend/ml/triposr_runner.py
import os
import sys
import subprocess
import threading
import logging
from typing import Callable
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

TRIPOSR_PATH   = os.environ.get("TRIPOSR_PATH")
TRIPOSR_PYTHON = os.environ.get("TRIPOSR_PYTHON")

REMBG_SCRIPT = os.path.join(os.path.dirname(__file__), "rembg_preprocess.py")

MILESTONES = [
    ("initializing model", 10),
    ("processing images",  20),
    ("running model",      40),
    ("extracting mesh",    70),
    ("exporting mesh",     85),
]


def _parse_progress(line: str):
    lower = line.lower()
    for keyword, pct in MILESTONES:
        if keyword in lower:
            return pct
    return None


def _find_output_file(output_dir: str):
    """Return first .glb found, then first .obj, else None."""
    for ext in (".glb", ".obj"):
        for root, _dirs, files in os.walk(output_dir):
            for fname in files:
                if fname.lower().endswith(ext):
                    return os.path.join(root, fname)
    return None


def _convert_obj_to_glb(obj_path: str) -> str | None:
    """
    Convert a .obj file to .glb using trimesh.
    Returns the path to the .glb file on success, None on failure.
    Trimesh must be installed in the TripoSR venv.
    """
    glb_path = os.path.splitext(obj_path)[0] + ".glb"

    convert_script = (
        "import sys, trimesh; "
        f"m = trimesh.load(r'{obj_path}', force='mesh', process=False); "
        f"m.export(r'{glb_path}')"
    )

    try:
        result = subprocess.run(
            [TRIPOSR_PYTHON, "-c", convert_script],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            logger.warning(
                "trimesh conversion failed (code %d): %s\n"
                "Install trimesh in the TripoSR venv:  %s -m pip install trimesh",
                result.returncode,
                result.stderr.strip(),
                TRIPOSR_PYTHON,
            )
            return None

        if os.path.isfile(glb_path):
            logger.info("Converted %s → %s", obj_path, glb_path)
            return glb_path

        logger.warning("trimesh ran but .glb not found at %s", glb_path)
        return None

    except subprocess.TimeoutExpired:
        logger.warning("trimesh conversion timed out")
        return None
    except Exception:
        logger.exception("Unexpected error during trimesh conversion")
        return None


def _remove_background(
    image_filepath: str,
    output_dir: str,
    on_progress: Callable[[int], None],
) -> str | None:
    if not os.path.isfile(REMBG_SCRIPT):
        logger.warning("rembg_preprocess.py not found at %s — skipping bg removal", REMBG_SCRIPT)
        return None

    cleaned_path = os.path.join(output_dir, "_rembg_input.png")
    logger.info("Running rembg on %s → %s", image_filepath, cleaned_path)
    on_progress(3)

    try:
        result = subprocess.run(
            [TRIPOSR_PYTHON, REMBG_SCRIPT, image_filepath, cleaned_path],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode == 1:
            logger.warning(
                "rembg is not installed in the TripoSR venv.\n"
                "  Install with:  %s -m pip install rembg[gpu]\n"
                "  Falling back to original image.",
                TRIPOSR_PYTHON,
            )
            return None

        if result.returncode != 0:
            logger.warning(
                "rembg_preprocess.py exited %d: %s — falling back to original image",
                result.returncode,
                result.stderr.strip(),
            )
            return None

        if result.stdout:
            logger.info("rembg: %s", result.stdout.strip())

        on_progress(8)
        return cleaned_path

    except subprocess.TimeoutExpired:
        logger.warning("rembg timed out — falling back to original image")
        return None
    except Exception:
        logger.exception("Unexpected error running rembg — falling back to original image")
        return None


def run_triposr(
    image_filepath: str,
    output_dir: str,
    on_progress: Callable[[int], None],
    on_done: Callable[[str], None],
    on_error: Callable[[str], None],
    remove_bg: bool = True,
) -> None:
    os.makedirs(output_dir, exist_ok=True)

    run_py = os.path.join(TRIPOSR_PATH, "run.py")

    if not os.path.isfile(TRIPOSR_PYTHON):
        on_error(f"Python executable not found: {TRIPOSR_PYTHON}")
        return

    if not os.path.isfile(run_py):
        on_error(f"TripoSR run.py not found: {run_py}")
        return

    if not os.path.isfile(image_filepath):
        on_error(f"Input image not found: {image_filepath}")
        return

    # Optional background removal
    actual_input = image_filepath
    if remove_bg:
        cleaned = _remove_background(image_filepath, output_dir, on_progress)
        if cleaned:
            actual_input = cleaned
            logger.info("Using bg-removed image: %s", actual_input)
        else:
            logger.info("bg removal skipped — using original image")

    os.makedirs(os.path.join(output_dir, "0"), exist_ok=True)

    command = [
        TRIPOSR_PYTHON, run_py,
        actual_input,
        "--output-dir", output_dir,
    ]

    if remove_bg and actual_input != image_filepath:
        command.append("--no-remove-bg")

    logger.info("TripoSR command: %s", " ".join(command))
    on_progress(10)

    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        current_progress = 10
        heartbeat_lines  = 0

        for raw_line in process.stdout:
            line = raw_line.strip()
            print("TRIPOSR:", line)
            if not line:
                continue
            logger.debug("TripoSR | %s", line)

            milestone = _parse_progress(line)
            if milestone is not None and milestone > current_progress:
                current_progress = milestone
                heartbeat_lines  = 0
                on_progress(current_progress)
            else:
                heartbeat_lines += 1
                if heartbeat_lines >= 5 and current_progress < 84:
                    current_progress = min(current_progress + 1, 84)
                    heartbeat_lines  = 0
                    on_progress(current_progress)

        process.wait()

        if process.returncode != 0:
            on_error(f"TripoSR exited with code {process.returncode}")
            return

        # Find the raw output file (.obj or .glb)
        output_file = _find_output_file(output_dir)
        if not output_file:
            on_error("No 3D model file generated")
            return

        on_progress(90)

        # Convert .obj → .glb for better color support in the browser viewer
        if output_file.lower().endswith(".obj"):
            logger.info("Converting .obj to .glb for browser compatibility...")
            glb_file = _convert_obj_to_glb(output_file)
            if glb_file:
                output_file = glb_file
                logger.info("Using .glb for output: %s", output_file)
            else:
                logger.warning("Conversion failed — serving .obj instead")

        on_progress(100)
        on_done(output_file)

    except Exception as exc:
        logger.exception("Unexpected error running TripoSR")
        on_error(str(exc))


def run_triposr_async(
    image_filepath: str,
    output_dir: str,
    on_progress: Callable[[int], None],
    on_done: Callable[[str], None],
    on_error: Callable[[str], None],
    remove_bg: bool = True,
) -> threading.Thread:
    t = threading.Thread(
        target=run_triposr,
        args=(image_filepath, output_dir, on_progress, on_done, on_error, remove_bg),
        daemon=True,
    )
    t.start()
    return t