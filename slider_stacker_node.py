import folder_paths

# Updated Node name for registration (used in JS)
NODE_NAME = "Slider Stacker (DSS)" # Internal name, keep suffix for uniqueness

########################################################################################################################
# TSC Slider Stacker (DSS) - String Inputs for Names
class TSC_Slider_Stacker_Standalone:
    @classmethod
    def INPUT_TYPES(cls):
        # ... (rest of INPUT_TYPES remains the same) ...
        max_sliders = 50
        inputs = {
            "required": {
                "slider_max_strength": ("FLOAT", {"default": 1.00, "min": 0.0, "max": 2.0, "step": 0.01, "precision": 2, "display": "number"}),
                "slider_count": ("INT", {"default": 1, "min": 0, "max": max_sliders, "step": 1}),
            }
        }
        for i in range(1, max_sliders + 1):
            inputs["required"][f"slider_name_{i}"] = ("STRING", {"multiline": False, "default": "None"})
            widget_name = f"({i})"
            inputs["required"][widget_name] = ("FLOAT", { 
                "default": 1.0, 
                "min": 0.0,      
                "max": 2.0,      
                "step": 0.01,     
                "precision": 2,    
                "display": "slider" 
            })
        return inputs

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("SLIDER_WEIGHTS",)
    FUNCTION = "slider_stacker"
    # Updated Category
    CATEGORY = "Dynamic Sliders Stack"

    # ... (slider_stacker function remains the same) ...
    def slider_stacker(self, slider_max_strength, slider_count, **kwargs):
        sliders_available = [kwargs.get(f"slider_name_{i}") for i in range(1, slider_count + 1)]
        weights_raw = [kwargs.get(f"({i})") for i in range(1, slider_count + 1)]
        safe_max_strength = max(0.0, slider_max_strength)
        weights_clamped_by_widget = [max(0.0, min(w, 2.0)) for w in weights_raw] 
        weights_clamped_final = [min(w, safe_max_strength) for w in weights_clamped_by_widget]
        active_weights = []
        for i in range(slider_count):
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