from .nodes.dynamic_sliders_stack import DynamicSlidersStack
from .nodes.stack_receiver import StackReceiver

NODE_CLASS_MAPPINGS = {
    "DynamicSlidersStack": DynamicSlidersStack,
    "StackReceiver": StackReceiver
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DynamicSlidersStack": "Dynamic Sliders Stack",
    "StackReceiver": "Stack Receiver"
}

WEB_DIRECTORY = "./web/js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
