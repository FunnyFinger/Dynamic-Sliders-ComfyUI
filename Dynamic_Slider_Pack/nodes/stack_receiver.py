class StackReceiver:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input": ("STRING", {"forceInput": True}),
                "slider_index": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 10,
                    "step": 1,
                    "display": "number"
                })
            }
        }
    
    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("value",)
    FUNCTION = "get_slider_value"
    CATEGORY = "Dynamic_Slider_Pack"

    def get_slider_value(self, input, slider_index):
        # Parse the comma-separated values from input
        try:
            values = [float(val.strip()) for val in input.split(',')]
            # Check if the index is valid
            if 1 <= slider_index <= len(values):
                return (values[slider_index - 1],)
            else:
                # Return default if index is out of range
                return (0.0,)
        except:
            # Handle parsing errors
            return (0.0,)
