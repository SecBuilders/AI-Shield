"""
Test script for AI Image Detection System
Demonstrates usage and validates functionality
"""

import sys
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_detector():
    """Test the detector with sample images."""
    try:
        from advanced_ai_detector import AdvancedAIImageDetector
    except ImportError as e:
        logger.error(f"Failed to import detector: {e}")
        logger.info("Make sure all dependencies are installed:")
        logger.info("  pip install -r requirements.txt --break-system-packages")
        return False
    
    logger.info("="*70)
    logger.info("AI IMAGE DETECTION SYSTEM - TEST SUITE")
    logger.info("="*70)
    
    # Initialize detector
    logger.info("\n1. Initializing detector...")
    try:
        detector = AdvancedAIImageDetector()
        logger.info("✓ Detector initialized successfully")
    except Exception as e:
        logger.error(f"✗ Failed to initialize detector: {e}")
        return False
    
    # Test with uploaded image if available
    logger.info("\n2. Checking for test images...")
    
    test_paths = [
        "/mnt/user-data/uploads",
        "test_images",
        "."
    ]
    
    test_image = None
    for path in test_paths:
        path_obj = Path(path)
        if path_obj.exists():
            # Find first image file
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
                images = list(path_obj.glob(ext))
                if images:
                    test_image = images[0]
                    break
            if test_image:
                break
    
    if test_image:
        logger.info(f"✓ Found test image: {test_image}")
        
        logger.info("\n3. Running detection...")
        try:
            with open(test_image, 'rb') as f:
                image_bytes = f.read()
            
            logger.info(f"   Image size: {len(image_bytes)} bytes")
            
            result = detector.predict(image_bytes)
            
            if 'error' in result:
                logger.error(f"✗ Detection failed: {result['error']}")
                return False
            
            # Display results
            logger.info("\n" + "="*70)
            logger.info("DETECTION RESULTS")
            logger.info("="*70)
            logger.info(f"Classification:  {result['label']}")
            logger.info(f"Confidence:      {result['confidence']:.2f}%")
            logger.info(f"AI Generated:    {result['is_ai_generated']}")
            
            if 'breakdown' in result:
                logger.info("\nScore Breakdown:")
                breakdown = result['breakdown']
                logger.info(f"  Base Model Score:     {breakdown['model_score']:.3f}")
                logger.info(f"  Frequency Adjustment: +{breakdown['frequency_adjustment']:.3f}")
                logger.info(f"  Noise Adjustment:     +{breakdown['noise_adjustment']:.3f}")
                logger.info(f"  Edge Adjustment:      +{breakdown['edge_adjustment']:.3f}")
                logger.info(f"  Final Score:          {breakdown['final_score']:.3f}")
            
            if 'features' in result:
                logger.info("\nFeature Analysis:")
                
                freq = result['features'].get('frequency', {})
                if freq:
                    logger.info(f"  Frequency Ratio:      {freq.get('freq_ratio', 0):.3f}")
                    logger.info(f"  Spectrum Variance:    {freq.get('spectrum_variance', 0):.1f}")
                
                noise = result['features'].get('noise', {})
                if noise:
                    logger.info(f"  Noise Variance:       {noise.get('global_noise_variance', 0):.3f}")
                    logger.info(f"  Noise Consistency:    {noise.get('noise_consistency', 0):.3f}")
                
                edges = result['features'].get('edges', {})
                if edges:
                    logger.info(f"  Edge Density:         {edges.get('edge_density', 0):.3f}")
                    logger.info(f"  Sharp Edge Ratio:     {edges.get('sharp_edge_ratio', 0):.3f}")
            
            logger.info("="*70)
            
            logger.info("\n✓ Detection completed successfully!")
            
            # Interpretation
            logger.info("\nInterpretation:")
            conf = result['confidence']
            if conf >= 90:
                logger.info("  → VERY HIGH confidence - Strong indicators of AI generation")
            elif conf >= 70:
                logger.info("  → HIGH confidence - Multiple AI indicators detected")
            elif conf >= 60:
                logger.info("  → MODERATE confidence - Some AI indicators present")
            elif conf >= 40:
                logger.info("  → UNCERTAIN - Mixed signals, human review recommended")
            else:
                logger.info("  → LOW confidence - Appears to be real photograph")
            
            return True
            
        except Exception as e:
            logger.error(f"✗ Error during detection: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        logger.warning("✗ No test images found")
        logger.info("\nTo test the detector:")
        logger.info("  1. Place an image in the current directory")
        logger.info("  2. Run: python test_detector.py")
        logger.info("\nOr test directly:")
        logger.info("  python advanced_ai_detector.py path/to/image.jpg")
        
        # Still test initialization
        logger.info("\n✓ Detector initialization successful")
        logger.info("✓ All imports working correctly")
        return True


def print_system_info():
    """Print system and dependency information."""
    import sys
    logger.info("\nSystem Information:")
    logger.info(f"  Python Version: {sys.version.split()[0]}")
    
    try:
        import torch
        logger.info(f"  PyTorch Version: {torch.__version__}")
        logger.info(f"  CUDA Available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            logger.info(f"  CUDA Device: {torch.cuda.get_device_name(0)}")
    except ImportError:
        logger.warning("  PyTorch: Not installed")
    
    try:
        import transformers
        logger.info(f"  Transformers Version: {transformers.__version__}")
    except ImportError:
        logger.warning("  Transformers: Not installed")
    
    try:
        import cv2
        logger.info(f"  OpenCV Version: {cv2.__version__}")
    except ImportError:
        logger.warning("  OpenCV: Not installed")
    
    try:
        import numpy as np
        logger.info(f"  NumPy Version: {np.__version__}")
    except ImportError:
        logger.warning("  NumPy: Not installed")


if __name__ == "__main__":
    print_system_info()
    
    logger.info("\n" + "="*70)
    
    success = test_detector()
    
    logger.info("\n" + "="*70)
    if success:
        logger.info("TEST COMPLETED SUCCESSFULLY ✓")
    else:
        logger.error("TEST FAILED ✗")
        sys.exit(1)
    logger.info("="*70 + "\n")
