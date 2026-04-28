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

TRIPOSR_PATH = os.environ.get("TRIPOSR_PATH")
TRIPOSR_PYTHON = os.environ.get("TRIPOSR_PYTHON")

# rembg_preprocess.py lives next to this file
REMBG_SCRIPT = os.path.join(os.path.dirname(__file__), "rembg_preprocess.py")

MILESTONES = [
    ("initializing model", 10),
    ("processing images",  20),
    ("running model",      40),
    ("extracting mesh",    70),
    ("exporting mesh",     90),
]


def _parse_progress(line: str):
    lower = line.lower()
    for keyword, pct in MILESTONES:
        if keyword in lower:
            return pct
    return None


def _find_output_file(output_dir: str):
    for ext in (".glb", ".obj"):
        for root, _dirs, files in os.walk(output_dir):
            for fname in files:
                if fname.lower().endswith(ext):
                    return os.path.join(root, fname)
    return None


def _remove_background(
    image_filepath: str,
    output_dir: str,
    on_progress: Callable[[int], None],
) -> str | None:
    """
    Run rembg_preprocess.py inside the TripoSR venv.

    Returns the path to the cleaned image on success, or None on failure
    (in which case the caller should fall back to the original image).
    """
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
            timeout=120,            # rembg can take a while on CPU first run (model download)
        )

        if result.returncode == 1:
            # rembg not installed — log clearly and skip
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

    # ── Validate paths ──────────────────────────────────────────────────────
    if not os.path.isfile(TRIPOSR_PYTHON):
        on_error(f"Python executable not found: {TRIPOSR_PYTHON}")
        return

    if not os.path.isfile(run_py):
        on_error(f"TripoSR run.py not found: {run_py}")
        return

    if not os.path.isfile(image_filepath):
        on_error(f"Input image not found: {image_filepath}")
        return

    # ── Optional background removal ─────────────────────────────────────────
    actual_input = image_filepath
    if remove_bg:
        cleaned = _remove_background(image_filepath, output_dir, on_progress)
        if cleaned:
            actual_input = cleaned
            logger.info("Using bg-removed image: %s", actual_input)
        else:
            logger.info("bg removal skipped — using original image")

    # ── Build TripoSR command ────────────────────────────────────────────────
    # Pass --no-remove-bg because we have already cleaned the image ourselves
    # (or chose to skip it). Letting TripoSR's own bg removal run on top of
    # rembg's output sometimes degrades quality.
    os.makedirs(os.path.join(output_dir, "0"), exist_ok=True)

    command = [
        TRIPOSR_PYTHON, run_py,
        actual_input,
        "--output-dir", output_dir,          # we handle bg removal ourselves
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
                if heartbeat_lines >= 5 and current_progress < 89:
                    current_progress = min(current_progress + 1, 89)
                    heartbeat_lines  = 0
                    on_progress(current_progress)

        process.wait()

        if process.returncode == 0:
            output_file = _find_output_file(output_dir)
            if not output_file:
                on_error("No 3D model file generated")
                return
            on_progress(100)
            on_done(output_file)
        else:
            on_error(f"TripoSR exited with code {process.returncode}")

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