# Dynamic Sliders Stack for ComfyUI

A custom node pack for ComfyUI providing a stack of named sliders with dynamic behavior.

## Features

*   **Slider Stacker**: A node with a configurable number of named sliders (up to 50).
*   **Slider Receiver**: Extracts the weight value of a specific slider from the stack output based on its index.
*   **Dynamic Max Strength**: Adjusting the `slider_max_strength` scales all individual sliders proportionally.
*   **Dynamic Individual Sliders**: Adjusting an individual `slider_wt` updates the `slider_max_strength` to reflect the new highest value among all sliders.
*   **String Output**: The `Slider Stacker` outputs a comma-separated string of the current weights for all active sliders.
*   **Dynamic UI**: The stacker node automatically shows/hides slider input rows based on the `slider_count` setting.
*   **Context Menu**: Right-click options for batch slider operations (Average, Reset, Set All to Max/Min).

## Nodes

### Slider Stacker

*   **Inputs**:
    *   `slider_max_strength` (FLOAT): The master maximum value. Adjusting this scales all sliders below it.
    *   `slider_count` (INT): Controls how many slider rows are visible and processed (1-50).
    *   `slider_name_{i}` (STRING): A text field to name or describe the slider (optional).
    *   `({i})` (FLOAT Widget): The individual weight for this slider (0.0-2.0). Adjusting this updates the `slider_max_strength` if this slider becomes the new maximum. (Widget name uses parentheses around the index).
*   **Output**:
    *   `SLIDER_WEIGHTS` (STRING): A comma-separated string of the weight values for sliders 1 through `slider_count`, formatted to two decimal places (e.g., "1.00, 0.50, 0.75").
*   **Right-Click Options**:
    *   `Average Slider Values`: Sets all visible sliders to their average value.
    *   `Reset Slider Values`: Sets all visible sliders to the default value (1.0).
    *   `Set All to Max Value`: Finds the highest value among visible sliders and sets all visible sliders to that value.
    *   `Set All to Min Value`: Finds the lowest value among visible sliders and sets all visible sliders to that value.

### Slider Receiver

*   **Inputs**:
    *   `weights_string` (STRING): Connect the `SLIDER_WEIGHTS` output from the `Slider Stacker` here.
    *   `index` (INT): The 1-based index of the slider whose weight you want to extract (1-50).
*   **Output**:
    *   `WEIGHT` (FLOAT): The floating-point value of the slider at the specified index (returns 0.0 if index is out of bounds or input is invalid).

## Installation

1.  Ensure the folder containing these files is named `Dynamic_sliders_stack`.
2.  Place the `Dynamic_sliders_stack` folder inside your ComfyUI `custom_nodes` directory.
3.  Restart ComfyUI.

## Usage Example

1.  Add a `Slider Stacker` node (found under the `Dynamic Sliders Stack` category).
2.  Set the `slider_count`.
3.  Adjust sliders or use right-click options.
4.  Add a `Slider Receiver` node.
5.  Connect `SLIDER_WEIGHTS` to `weights_string`.
6.  Set the `index` on the Receiver.
7.  Connect the `WEIGHT` output.

## Use Case Scenarios

This node setup provides a centralized control panel for managing multiple numerical weights within your workflow. Here are a few examples:

*   **Multiple LoRA Weights:** Assign each slider to a different LoRA. Use the `Slider Stacker` to adjust the overall impact (`slider_max_strength`) or fine-tune individual LoRA weights. Use `Slider Receiver` nodes to pipe the individual weights into the `strength_model` and/or `strength_clip` inputs of `LoRA Loader` nodes.
*   **Prompt Segment Weighting:** If using nodes that allow weighting different parts of a prompt (e.g., via attention syntax or specialized nodes), you could use sliders to control the emphasis on different elements like `(subject:WEIGHT)`, `(style:WEIGHT)`, `(background:WEIGHT)`. Connect `Slider Receiver` outputs to the relevant weight inputs.
*   **Embedding/Textual Inversion Strength:** Control the influence of multiple embeddings by connecting `Slider Receiver` outputs to nodes that adjust their strength (if available).
*   **Style/Character Consistency:** If you have multiple elements defining a style or character (multiple LoRAs, specific prompt weights), group their controls onto one `Slider Stacker` for easier holistic adjustments.
*   **Controlling Custom Node Parameters:** Any custom node that accepts a FLOAT input for strength, influence, weight, etc., can potentially be controlled by connecting a `Slider Receiver`'s output to it.
*   **Centralized Control Panel:** Create a 'dashboard' near the start of your workflow using one or more `Slider Stacker` nodes to manage key weights without needing to hunt down individual nodes later in the graph.

## License

Please check the LICENSE file. Remember to update the placeholder copyright line `Copyright (c) 2024 Your Name or Project Name Here` with the correct year and your name/project name.
