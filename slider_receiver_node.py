import folder_paths
import re

# Updated Node name for registration
RECEIVER_NODE_NAME = "Slider Receiver (DSS)" # Internal name

########################################################################################################################
# TSC Slider Receiver (DSS)
class TSC_Slider_Receiver_Standalone: # Keep class name for now, just update registration
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "weights_string": ("STRING", {"multiline": False, "default": ""}),
                "index": ("INT", {"default": 1, "min": 1, "max": 50, "step": 1}),
            }
        }

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("WEIGHT",)
    FUNCTION = "get_weight_at_index"
    # Updated Category
    CATEGORY = "Dynamic Sliders Stack"

    # Add compatibility attributes for newer ComfyUI versions
    TITLE = "Slider Receiver"
    TYPE = "Slider Receiver (DSS)"

    # Add getWidgets method for consistency
    def getWidgets(self):
        # Just return all widgets since this node doesn't need filtering
        return self.widgets if hasattr(self, 'widgets') else None

    def get_weight_at_index(self, weights_string, index):
        selected_weight = 0.0
        if not weights_string or not isinstance(weights_string, str):
            return (selected_weight,)
        try:
            weights_str_list = re.split(r'\s*,\s*', weights_string.strip())
            weights_str_list = [w for w in weights_str_list if w]

            if 1 <= index <= len(weights_str_list):
                selected_weight_str = weights_str_list[index - 1]
                selected_weight = float(selected_weight_str)
            else:
                print(f"Warning: Index {index} out of bounds for weights list (Length: {len(weights_str_list)}). Returning 0.0.")
        except ValueError:
            print(f"Warning: Could not convert value to float in weights string: '{weights_string}' at index {index}. Returning 0.0.")
        except Exception as e:
            print(f"Error processing weights string '{weights_string}': {e}. Returning 0.0.")
        return (selected_weight,)

# --- Mappings ---
NODE_CLASS_MAPPINGS = {
    RECEIVER_NODE_NAME: TSC_Slider_Receiver_Standalone
}

# Updated Display Name
NODE_DISPLAY_NAME_MAPPINGS = {
    RECEIVER_NODE_NAME: "Slider Receiver" # Removed suffix
}
