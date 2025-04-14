
class DynamicSlidersStack:
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "sliders_count": ("INT", {
                    "default": 5,
                    "min": 1,
                    "max": 10,
                    "step": 1,
                    "display": "number"
                }),
                "sliders_Max": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.01,
                    "max": 2.0,
                    "step": 0.01,
                    "display": "number"
                }),
            },
            "optional": {}
        }
        
        # Add 10 title/slider pairs (will be shown/hidden via JS)
        for i in range(1, 11):
            inputs["optional"][f"title_{i}"] = ("STRING", {"default": f"Slider {i}"})
            inputs["optional"][f"slider_{i}"] = ("FLOAT", {
                "default": 1.0,
                "min": 0.0,
                "max": 2.0,
                "step": 0.0001,
                "display": "slider"
            })
        
        return inputs
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("sliders_values",)
    FUNCTION = "process_sliders"
    CATEGORY = "Dynamic_Slider_Pack"

    def process_sliders(self, sliders_count, sliders_Max, **kwargs):
        # Ensure minimum sliders_Max of 0.01
        sliders_Max = max(0.01, sliders_Max)
        
        # Extract slider values up to the count limit
        slider_values = []
        max_value = 0
        
        for i in range(1, sliders_count + 1):
            key = f"slider_{i}"
            if key in kwargs:
                value = kwargs[key]
                slider_values.append(value)
                max_value = max(max_value, value)
        
        # Join values with commas - display with 2 decimal places
        values_str = ", ".join([f"{val:.2f}" for val in slider_values])
        
        return (values_str,)
