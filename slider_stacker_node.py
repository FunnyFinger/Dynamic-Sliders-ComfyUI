import folder_paths

# Updated Node name for registration (used in JS)
NODE_NAME = "Slider Stacker (DSS)" # Internal name, keep suffix for uniqueness

########################################################################################################################
# TSC Slider Stacker (DSS) - String Inputs for Names
class TSC_Slider_Stacker_Standalone:
    @classmethod
    def INPUT_TYPES(cls):
        max_sliders = 50
        inputs = {
            "required": {
                "sliders_max": ("FLOAT", {"default": 1.00, "min": 0.0, "max": 2.0, "step": 0.01, "precision": 2, "display": "number"}),
                "sliders_count": ("INT", {"default": 1, "min": 1, "max": max_sliders, "step": 1}),
                "sliders_sum": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 9999.0, "step": 0.01, "precision": 2, "display": "number"}),
                "lock_sum": ("BOOLEAN", {"default": False, "label_on": "on", "label_off": "off"})
            }
        }

        # Define all possible widgets without the hidden flag initially
        for i in range(1, max_sliders + 1):
            inputs["required"][f"slider_name_{i}"] = ("STRING", {"multiline": False, "default": "None"}) # Removed hidden: True
            widget_name = f"({i})"
            inputs["required"][widget_name] = ("FLOAT", {
                "default": 1.0,
                "min": 0.0,
                "max": 2.0,
                "step": 0.01,
                "precision": 2,
                "display": "slider"
                # Removed hidden: True
            })
        return inputs

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("SLIDER_WEIGHTS",)
    FUNCTION = "slider_stacker"
    # Updated Category
    CATEGORY = "Dynamic Sliders Stack"

    # Add compatibility attributes for newer ComfyUI versions
    TITLE = "Slider Stacker"
    TYPE = "Slider Stacker (DSS)"

    # Removed __init__, onNodeLoad, update_slider_visibility, getWidgets, onExecute overrides
    # Let JS handle the dynamic visibility

    def slider_stacker(self, sliders_max, sliders_count, sliders_sum=None, lock_sum=False, **kwargs):
        # Clamp sliders_count to a valid range (1 to 50)
        sliders_count = max(1, min(int(sliders_count), 50))

        # Regular processing using the validated sliders_count
        sliders_available = [kwargs.get(f"slider_name_{i}") for i in range(1, sliders_count + 1)]
        weights_raw = [kwargs.get(f"({i})") for i in range(1, sliders_count + 1)]
        safe_max_strength = max(0.0, sliders_max)
        weights_clamped_by_widget = [max(0.0, min(w, 2.0)) for w in weights_raw]
        weights_clamped_final = [min(w, safe_max_strength) for w in weights_clamped_by_widget]
        active_weights = []
        for i in range(sliders_count):
            active_weights.append(f"{weights_clamped_final[i]:.2f}")
        weights_string = ", ".join(active_weights)
        return (weights_string,)

# --- Mappings ---
NODE_CLASS_MAPPINGS = {
    NODE_NAME: TSC_Slider_Stacker_Standalone
}

# Updated Display Name
NODE_DISPLAY_NAME_MAPPINGS = {
    NODE_NAME: "Slider Stacker" # Removed suffix for cleaner UI
}
