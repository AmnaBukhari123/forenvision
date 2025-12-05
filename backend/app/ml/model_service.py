# backend/app/ml/model_service.py
import onnxruntime as ort
import numpy as np
from PIL import Image
import cv2
from typing import List, Dict, Any, Optional
import os
from enum import Enum

class ModelType(Enum):
    """Available detection models"""
    BLOOD = "blood_detection"
    CRIME_SCENE = "crimescene_detection"

class ObjectDetector:
    def __init__(self, model_type: ModelType = ModelType.CRIME_SCENE):
        """
        Initialize the ONNX object detection model
        
        Args:
            model_type: Type of model to load (BLOOD or CRIME_SCENE)
        """
        self.model_type = model_type
        self.session = None
        self.input_name = None
        self.output_names = None
        self.input_shape = (640, 640)  # YOLOv8 default input size
        
        # Set model path and classes based on model type
        if model_type == ModelType.BLOOD:
            self.model_path = "blood_detection_best.onnx"
            self.class_names = ['blood', 'bloodstain']
            self.category_mapping = {
                'Blood Evidence': ['blood', 'bloodstain']
            }
        else:  # CRIME_SCENE
            self.model_path = "crimescene_detection_best.onnx"
            self.class_names = [
                'Blood',           # 0
                'Finger-print',    # 1
                'Glass',           # 2
                'Hammer',          # 3
                'Handgun',         # 4
                'Human-body',      # 5
                'Human-hair',      # 6
                'Human-hand',      # 7
                'Knife',           # 8
                'Rope',            # 9
                'Shoe-print',      # 10
                'Shotgun',         # 11
                'Victim'           # 12
            ]
            self.category_mapping = {
                'Evidence': ['Blood', 'Finger-print', 'Shoe-print', 'Glass'],
                'Weapons - Firearms': ['Handgun', 'Shotgun'],
                'Weapons - Melee': ['Knife', 'Hammer', 'Rope'],
                'Human': ['Human-body', 'Human-hair', 'Human-hand', 'Victim']
            }
        
        self.load_model()
    
    def load_model(self):
        """Load the ONNX model"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            # Create ONNX Runtime session
            self.session = ort.InferenceSession(
                self.model_path,
                providers=['CPUExecutionProvider']
            )
            
            # Get model input/output details
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            
            # Get input shape from model
            input_shape = self.session.get_inputs()[0].shape
            if len(input_shape) == 4:
                self.input_shape = (input_shape[2], input_shape[3])
            
            model_name = "Blood Detection" if self.model_type == ModelType.BLOOD else "Crime Scene Detection"
            print(f"✅ {model_name} Model loaded successfully: {self.model_path}")
            print(f"   Input: {self.input_name}, Shape: {self.input_shape}")
            print(f"   Outputs: {self.output_names}")
            print(f"   Classes: {len(self.class_names)} object types - {self.class_names}")
            
        except Exception as e:
            print(f"❌ Error loading model: {str(e)}")
            raise
    
    def get_category(self, class_name: str) -> str:
        """Get the category for a detected class"""
        for category, classes in self.category_mapping.items():
            if class_name in classes:
                return category
        return "Other"
    
    def preprocess_image(self, image_path: str) -> tuple:
        """Preprocess image for model input"""
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Failed to read image: {image_path}")
            
            # Get original dimensions
            original_height, original_width = image.shape[:2]
            
            # Convert BGR to RGB
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Resize to model input size
            resized = cv2.resize(image, self.input_shape)
            
            # Normalize to [0, 1] and convert to float32
            input_tensor = resized.astype(np.float32) / 255.0
            
            # Transpose to CHW format (channels first)
            input_tensor = np.transpose(input_tensor, (2, 0, 1))
            
            # Add batch dimension
            input_tensor = np.expand_dims(input_tensor, axis=0)
            
            return input_tensor, (original_width, original_height)
            
        except Exception as e:
            print(f"Error preprocessing image: {str(e)}")
            raise
    
    def postprocess_output(
        self, 
        outputs: np.ndarray, 
        original_size: tuple,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45
    ) -> List[Dict[str, Any]]:
        """Post-process model outputs to get detection results"""
        try:
            # YOLOv8 output format: [batch, 4+nc, num_detections]
            predictions = outputs[0]  # Get first batch
            
            # Handle different output shapes
            # If shape is [nc+4, 8400], transpose to [8400, nc+4]
            if len(predictions.shape) == 2:
                if predictions.shape[0] < predictions.shape[1]:
                    predictions = predictions.T
            elif len(predictions.shape) == 3:
                predictions = predictions[0]  # Remove batch dimension
                if predictions.shape[0] < predictions.shape[1]:
                    predictions = predictions.T
            
            detections = []
            num_classes = len(self.class_names)
            
            for detection in predictions:
                # Extract box coordinates and class scores
                x_center, y_center, width, height = detection[:4]
                class_scores = detection[4:4+num_classes]
                
                # Get class with highest confidence
                class_id = np.argmax(class_scores)
                confidence = float(class_scores[class_id])
                
                # Filter by confidence threshold
                if confidence < conf_threshold:
                    continue
                
                # Scale coordinates to original image size
                orig_width, orig_height = original_size
                scale_x = orig_width / self.input_shape[0]
                scale_y = orig_height / self.input_shape[1]
                
                x1 = int((x_center - width / 2) * scale_x)
                y1 = int((y_center - height / 2) * scale_y)
                x2 = int((x_center + width / 2) * scale_x)
                y2 = int((y_center + height / 2) * scale_y)
                
                # Get class name
                class_name = self.class_names[class_id] if class_id < len(self.class_names) else f"Class_{class_id}"
                category = self.get_category(class_name)
                
                detections.append({
                    'class_id': int(class_id),
                    'class_name': class_name,
                    'category': category,
                    'confidence': confidence,
                    'bbox': {
                        'x1': max(0, x1),
                        'y1': max(0, y1),
                        'x2': min(orig_width, x2),
                        'y2': min(orig_height, y2)
                    }
                })
            
            # Apply NMS (Non-Maximum Suppression)
            detections = self.apply_nms(detections, iou_threshold)
            
            # Sort by confidence
            detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
            
            return detections
            
        except Exception as e:
            print(f"Error in post-processing: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    def apply_nms(self, detections: List[Dict], iou_threshold: float) -> List[Dict]:
        """Apply Non-Maximum Suppression to remove duplicate detections"""
        if len(detections) == 0:
            return []
        
        # Sort by confidence
        detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
        
        # Apply NMS per class
        keep = []
        while len(detections) > 0:
            keep.append(detections[0])
            current_class = detections[0]['class_name']
            
            # Remove overlapping detections of the same class
            detections = [
                det for det in detections[1:] 
                if det['class_name'] != current_class or 
                   self.calculate_iou(keep[-1]['bbox'], det['bbox']) < iou_threshold
            ]
        
        return keep
    
    def calculate_iou(self, box1: Dict, box2: Dict) -> float:
        """Calculate Intersection over Union between two boxes"""
        x1 = max(box1['x1'], box2['x1'])
        y1 = max(box1['y1'], box2['y1'])
        x2 = min(box1['x2'], box2['x2'])
        y2 = min(box1['y2'], box2['y2'])
        
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        
        area1 = (box1['x2'] - box1['x1']) * (box1['y2'] - box1['y1'])
        area2 = (box2['x2'] - box2['x1']) * (box2['y2'] - box2['y1'])
        
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0
    
    def detect_objects(
        self, 
        image_path: str,
        conf_threshold: float = 0.25
    ) -> Dict[str, Any]:
        """
        Run object detection on an image
        
        Args:
            image_path: Path to the image file
            conf_threshold: Confidence threshold for detections
            
        Returns:
            Dictionary containing detection results with forensic categorization
        """
        try:
            # Preprocess image
            input_tensor, original_size = self.preprocess_image(image_path)
            
            # Run inference
            outputs = self.session.run(
                self.output_names,
                {self.input_name: input_tensor}
            )
            
            # Post-process outputs
            detections = self.postprocess_output(
                outputs[0], 
                original_size,
                conf_threshold
            )
            
            # Group detections by class
            class_counts = {}
            for det in detections:
                class_name = det['class_name']
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
            
            # Group detections by category
            category_counts = {}
            for det in detections:
                category = det['category']
                category_counts[category] = category_counts.get(category, 0) + 1
            
            # Identify critical findings based on model type
            critical_items = []
            if self.model_type == ModelType.BLOOD:
                # For blood detection, all detections are critical
                for det in detections:
                    critical_items.append({
                        'type': det['class_name'],
                        'confidence': det['confidence']
                    })
            else:  # CRIME_SCENE
                # Identify critical crime scene items
                for det in detections:
                    if det['class_name'] in ['Blood', 'Victim', 'Human-body']:
                        critical_items.append({
                            'type': det['class_name'],
                            'confidence': det['confidence']
                        })
            
            # Count weapons found (only for crime scene model)
            weapons_found = []
            if self.model_type == ModelType.CRIME_SCENE:
                weapons_found = [det for det in detections if det['category'] in ['Weapons - Firearms', 'Weapons - Melee']]
            
            return {
                'success': True,
                'model_type': self.model_type.value,
                'image_path': image_path,
                'image_dimensions': {
                    'width': original_size[0],
                    'height': original_size[1]
                },
                'total_detections': len(detections),
                'class_counts': class_counts,
                'category_counts': category_counts,
                'weapons_count': len(weapons_found),
                'critical_findings': critical_items,
                'detections': detections
            }
            
        except Exception as e:
            print(f"Error in object detection: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e),
                'detections': []
            }


# Global instances for both models
blood_detector = ObjectDetector(ModelType.BLOOD)
crimescene_detector = ObjectDetector(ModelType.CRIME_SCENE)


# Convenience function to use the appropriate detector
def detect_with_model(image_path: str, model_type: str = "crime_scene", conf_threshold: float = 0.25) -> Dict[str, Any]:
    """
    Detect objects using the specified model
    
    Args:
        image_path: Path to the image file
        model_type: Type of model to use ("blood" or "crime_scene")
        conf_threshold: Confidence threshold for detections
        
    Returns:
        Dictionary containing detection results
    """
    if model_type.lower() == "blood" or model_type.lower() == "blood_detection":
        return blood_detector.detect_objects(image_path, conf_threshold)
    else:
        return crimescene_detector.detect_objects(image_path, conf_threshold)