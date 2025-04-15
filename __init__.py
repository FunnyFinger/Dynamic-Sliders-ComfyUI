import os
import sys
import __main__

# Add the node's directory to the system path
NODE_DIR = os.path.dirname(__file__)
COMFYUI_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__main__.__file__)))
sys.path.append(NODE_DIR)

# Import the node classes and mappings
from .slider_stacker_node import NODE_CLASS_MAPPINGS as stacker_mappings, NODE_DISPLAY_NAME_MAPPINGS as stacker_display_mappings
from .slider_receiver_node import NODE_CLASS_MAPPINGS as receiver_mappings, NODE_DISPLAY_NAME_MAPPINGS as receiver_display_mappings

# Path for the javascript directory (relative to this file)
WEB_DIRECTORY = "js"

# Combine mappings
NODE_CLASS_MAPPINGS = {**stacker_mappings, **receiver_mappings}
NODE_DISPLAY_NAME_MAPPINGS = {**stacker_display_mappings, **receiver_display_mappings}

# Export mappings for ComfyUI
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']

# Updated print statement
print('Loaded Dynamic Sliders Stack nodes') 