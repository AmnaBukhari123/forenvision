# backend/app/ml/model_service.py
import onnxruntime as ort
import numpy as np
import cv2
from typing import List, Dict, Any
import os


class ObjectDetector:
    def __init__(self):
        """Initialize single ONNX object detection model"""

        self.model_path = "Object_detection_best.onnx"
        self.session = None
        self.input_name = None
        self.output_names = None
        self.input_shape = (640, 640)

        # Your unified classes
        self.class_names = [
            'Blood',           # 0
            'Finger-print',    # 1
            'Glass',           # 2
            'Hammer',          # 3
            'Handgun',         # 4
            'Person',          # 5
            'Knife',           # 6
            'Shotgun',         # 7
        ]

        # Fixed category mapping
        self.category_mapping = {
            'Evidence': ['Blood', 'Finger-print', 'Glass'],
            'Weapons - Firearms': ['Handgun', 'Shotgun'],
            'Weapons - Melee': ['Knife', 'Hammer'],
            'Human': ['Person']
        }

        self.load_model()

    def load_model(self):
        """Load ONNX model"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found: {self.model_path}")

        self.session = ort.InferenceSession(
            self.model_path,
            providers=['CPUExecutionProvider']
        )

        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [o.name for o in self.session.get_outputs()]

        input_shape = self.session.get_inputs()[0].shape
        if len(input_shape) == 4:
            self.input_shape = (input_shape[2], input_shape[3])

        print(f"✅ Model loaded: {self.model_path}")
        print(f"Classes: {self.class_names}")

    def get_category(self, class_name: str) -> str:
        for category, classes in self.category_mapping.items():
            if class_name in classes:
                return category
        return "Other"

    def preprocess_image(self, image_path: str):
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")

        # ✅ h, w from numpy shape (rows=height, cols=width)
        h, w = image.shape[:2]

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # ✅ Always resize to exactly 640x640 (stretch, no letterbox)
        resized = cv2.resize(image_rgb, (640, 640))

        tensor = resized.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))
        tensor = np.expand_dims(tensor, axis=0)

        # ✅ Return (width, height) to match original_size convention
        return tensor, (w, h)

    def calculate_iou(self, box1, box2):
        x1 = max(box1['x1'], box2['x1'])
        y1 = max(box1['y1'], box2['y1'])
        x2 = min(box1['x2'], box2['x2'])
        y2 = min(box1['y2'], box2['y2'])

        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (box1['x2'] - box1['x1']) * (box1['y2'] - box1['y1'])
        area2 = (box2['x2'] - box2['x1']) * (box2['y2'] - box2['y1'])

        union = area1 + area2 - inter
        return inter / union if union > 0 else 0

    def apply_nms(self, detections, iou_threshold=0.45):
        detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
        keep = []

        while detections:
            best = detections.pop(0)
            keep.append(best)

            detections = [
                d for d in detections
                if d['class_name'] != best['class_name']
                or self.calculate_iou(best['bbox'], d['bbox']) < iou_threshold
            ]

        return keep

    def postprocess_output(self, outputs, original_size, conf_threshold=0.25):
        preds = outputs

        if len(preds.shape) == 3:
            preds = preds[0]
        if preds.shape[0] < preds.shape[1]:
            preds = preds.T

        detections = []
        num_classes = len(self.class_names)

        orig_w, orig_h = original_size  # original image width, height

        # ✅ The model always runs on 640x640 input
        model_w, model_h = 640, 640

        # ✅ Calculate how the image was letterboxed/stretched into 640x640
        # cv2.resize stretches — so scale is simply original/model
        scale_x = orig_w / model_w
        scale_y = orig_h / model_h

        for det in preds:
            x, y, bw, bh = det[:4]
            scores = det[4:4 + num_classes]

            class_id = int(np.argmax(scores))
            conf = float(scores[class_id])

            if conf < conf_threshold:
                continue

            # ✅ x, y, bw, bh are in 640x640 model space — scale to original
            x1 = int((x - bw / 2) * scale_x)
            y1 = int((y - bh / 2) * scale_y)
            x2 = int((x + bw / 2) * scale_x)
            y2 = int((y + bh / 2) * scale_y)

            # ✅ Clamp to image bounds
            x1 = max(0, min(x1, orig_w))
            y1 = max(0, min(y1, orig_h))
            x2 = max(0, min(x2, orig_w))
            y2 = max(0, min(y2, orig_h))

            # Skip degenerate boxes
            if x2 <= x1 or y2 <= y1:
                continue

            class_name = self.class_names[class_id]
            category = self.get_category(class_name)

            detections.append({
                "class_id": class_id,
                "class_name": class_name,
                "category": category,
                "confidence": conf,
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                }
            })

        detections = self.apply_nms(detections)
        return sorted(detections, key=lambda x: x['confidence'], reverse=True)

    def detect_objects(self, image_path: str, conf_threshold=0.25):
        try:
            tensor, size = self.preprocess_image(image_path)
            orig_w, orig_h = size

            outputs = self.session.run(
                self.output_names,
                {self.input_name: tensor}
            )

            # ✅ DEBUG: print raw output shape and first few rows
            raw = outputs[0]
            print(f"Raw output shape: {raw.shape}")
            print(f"Original image size: {orig_w}x{orig_h}")
            if len(raw.shape) == 3:
                sample = raw[0]
            else:
                sample = raw
            if sample.shape[0] < sample.shape[1]:
                sample = sample.T
            print(f"First 3 detections raw (x,y,w,h,scores):")
            for i in range(min(3, len(sample))):
                print(f"  [{i}]: {sample[i][:10]}")

            detections = self.postprocess_output(outputs[0], size, conf_threshold)

            class_counts = {}
            category_counts = {}
            for d in detections:
                class_counts[d['class_name']] = class_counts.get(d['class_name'], 0) + 1
                category_counts[d['category']] = category_counts.get(d['category'], 0) + 1

            weapons = [
                d for d in detections
                if d['category'] in ['Weapons - Firearms', 'Weapons - Melee']
            ]

            return {
                "success": True,
                "image_path": image_path,
                # ✅ Always store actual image dimensions
                "image_dimensions": {
                    "width": orig_w,
                    "height": orig_h
                },
                "total_detections": len(detections),
                "class_counts": class_counts,
                "category_counts": category_counts,
                "weapons_count": len(weapons),
                "detections": detections
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "detections": []
            }
# SINGLE GLOBAL DETECTOR
detector = ObjectDetector()


# SIMPLE CALL FUNCTION
def detect(image_path: str, conf_threshold=0.25):
    return detector.detect_objects(image_path, conf_threshold)