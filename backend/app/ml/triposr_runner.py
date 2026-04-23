# backend/ml/triposr_runner.py
import os
import sys
import subprocess
import threading
import logging
from typing import Callable

logger = logging.getLogger(__name__)

TRIPOSR_PATH = os.environ.get(
    "TRIPOSR_PATH",
    r"C:\Users\bukha\Documents\project_root\TripoSR",
)

TRIPOSR_PYTHON = os.environ.get(
    "TRIPOSR_PYTHON",
    r"C:\Users\bukha\Documents\project_root\cleanenv\Scripts\python.exe",
)

MILESTONES = [
    ("loading model",        5),
    ("processing image",    15),
    ("image encoder",       25),
    ("generating 3d",       35),
    ("generating triplane", 40),
    ("rendering",           50),
    ("marching cubes",      60),
    ("extracting mesh",     75),
    ("saving",              90),
    ("done",                95),
]


def _parse_progress(line: str):
    lower = line.lower()
    for keyword, pct in MILESTONES:
        if keyword in lower:
            return pct
    return None


def _find_output_file(output_dir: str):
    for ext in (".glb", ".obj"):
        for root, dirs, files in os.walk(output_dir):
            for fname in files:
                if fname.lower().endswith(ext):
                    return os.path.join(root, fname)
    return None


def run_triposr(
    image_filepath: str,
    output_dir: str,
    on_progress: Callable[[int], None],
    on_done: Callable[[str], None],
    on_error: Callable[[str], None],
) -> None:
    os.makedirs(output_dir, exist_ok=True)

    run_py = os.path.join(TRIPOSR_PATH, "run.py")

    # Validate paths before launching so errors are clear
    if not os.path.isfile(TRIPOSR_PYTHON):
        on_error(f"Python executable not found: {TRIPOSR_PYTHON}")
        return

    if not os.path.isfile(run_py):
        on_error(f"TripoSR run.py not found: {run_py}")
        return

    if not os.path.isfile(image_filepath):
        on_error(f"Input image not found: {image_filepath}")
        return

    command = [TRIPOSR_PYTHON, run_py, image_filepath, "--output-dir", output_dir]

    logger.info("TripoSR command: %s", " ".join(command))
    on_progress(2)

    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        current_progress = 2
        heartbeat_lines = 0

        for raw_line in process.stdout:
            line = raw_line.strip()
            if not line:
                continue
            logger.debug("TripoSR | %s", line)

            milestone = _parse_progress(line)
            if milestone is not None and milestone > current_progress:
                current_progress = milestone
                heartbeat_lines = 0
                on_progress(current_progress)
            else:
                heartbeat_lines += 1
                if heartbeat_lines >= 5 and current_progress < 89:
                    current_progress = min(current_progress + 1, 89)
                    heartbeat_lines = 0
                    on_progress(current_progress)

        process.wait()

        if process.returncode == 0:
            output_file = _find_output_file(output_dir)
            on_progress(100)
            on_done(output_file or output_dir)
        else:
            stderr_output = process.stderr.read()
            on_error(f"TripoSR exited with code {process.returncode}. stderr: {stderr_output}")

    except Exception as exc:
        logger.exception("Unexpected error running TripoSR")
        on_error(str(exc))


def run_triposr_async(
    image_filepath: str,
    output_dir: str,
    on_progress: Callable[[int], None],
    on_done: Callable[[str], None],
    on_error: Callable[[str], None],
) -> threading.Thread:
    t = threading.Thread(
        target=run_triposr,
        args=(image_filepath, output_dir, on_progress, on_done, on_error),
        daemon=True,
    )
    t.start()
    return t