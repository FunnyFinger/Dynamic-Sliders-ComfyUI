# Dynamic Slider Pack for ComfyUI

A specialized node for ComfyUI that provides balanced weight control across multiple elements in image generation workflows, helping prevent CFG burnout while maintaining proper relationships between weights.

![Version](https://img.shields.io/badge/version-1.0-blue)
![ComfyUI](https://img.shields.io/badge/ComfyUI-compatible-green)

![Dynamic Slider Pack](https://i.imgur.com/placeholder.png)

## Table of Contents
- [Introduction](#introduction)
- [The CFG Burnout Problem](#the-cfg-burnout-problem)
- [Features](#features)
- [Primary Usage Scenarios](#primary-usage-scenarios)
- [Installation](#installation)
- [Usage](#usage)
- [Known Limitations](#known-limitations)
- [Future Development](#future-development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Introduction

Dynamic Slider Pack v1 is designed to solve a common problem in AI image generation: maintaining balanced weights across multiple prompts, LoRAs, wildcards, and styles. By providing a single interface to control up to 10 related weights, it helps prevent Classifier Free Guidance (CFG) burnout that occurs when weight values become imbalanced or too high.

### The CFG Burnout Problem

When generating images, having improperly balanced weights can lead to:
- Oversaturated colors
- Unwanted artifacts
- Loss of detail
- Poor composition
- Unnatural emphasis on certain elements

This node helps maintain appropriate relative weights between different elements, ensuring no single concept dominates and causes these issues.

## Features

- **Dynamic Visibility**: Show only as many sliders as you need (1-10)
- **Unified Maximum Control**: Set a ceiling for all weights with a single parameter
- **Proportional Scaling**: Maintain proper weight relationships when adjusting the overall scale
- **Custom Labels**: Name each slider according to what it controls
- **Right-click Menu Options**:
  - Refresh Sliders: Force update of slider visibility and values
  - Balance Slider Values: Evenly distribute values across visible sliders
  - Reset Node Size: Reset the node size to default width
- **Comma-Separated Output**: Ready for direct use in text fields or as input to other nodes
- **Precision Formatting**: Values output with 4 decimal places for fine-grained control

## Primary Usage Scenarios

### Multi-Prompt Weight Balancing

Control the influence of different concepts in your prompt:

    "Beautiful landscape:0.8, sunset:1.2, mountains:0.7, lake:0.65, forest:0.4"

### LoRA and Embedding Balance

Maintain proper balance between multiple model modifications:

    <lora:landscape:0.5>, <lora:sunset:0.7>, <lora:detail:0.3>

### Style Mixing Control

Blend multiple styles with controlled influence:

    Style_A * 0.4 + Style_B * 0.6 + Style_C * 0.3

### Wildcard Weighting

Control the influence of different wildcards in your generation:

    __animal__:0.6, __environment__:0.8, __lighting__:0.4

## Installation

1. Clone this repository into your ComfyUI custom_nodes directory:

       cd ComfyUI/custom_nodes/
       git clone https://github.com/FunnyFinger/Dynamic-Sliders-ComfyUI.git

2. Restart ComfyUI or refresh the web page

## Usage

1. Add the "Dynamic Sliders Stack" node to your workflow
2. Set the "sliders_count" to control how many sliders are visible (1-10)
3. Adjust "sliders_Max" to set the maximum value across all sliders
4. Optionally customize the title for each slider to indicate what it controls
5. Adjust individual slider values to set the relative weights
6. Use the slider outputs in your workflow by connecting the "sliders_values" output
7. If needed, use the right-click menu options to refresh or balance sliders

### Workflow Integration Tips

1. Place the Dynamic Slider Pack node near related text nodes for logical grouping
2. Use the "Balance Slider Values" option when starting a new adjustment process
3. Consider workflow arrangement that keeps the node visible for quick adjustments
4. Use descriptive titles that reflect what each slider controls
5. Connect the output to a text combination node for prompt weighting

## Known Limitations

As this is version 1, there are some limitations to be aware of:

1. **UI Responsiveness Issues**: Often requires multiple interactions to update
2. **Imperfect Visibility Toggling**: Sliders may not reliably hide/show
3. **Limited Error Handling**: May break in certain ComfyUI configurations
4. **Basic Functionality Only**: Lacks advanced features planned for future versions
5. **Limited Compatibility Testing**: Works with specific ComfyUI versions available at the time
6. **Widget Visibility Timing**: Sometimes sliders don't hide immediately on count change

## Future Development

As this is v1, planned improvements include:

1. **Enhanced UI Responsiveness**: More reliable widget visibility updates
2. **Advanced Scaling Options**: Better control over how values relate to each other
3. **Additional Output Formats**: Beyond basic comma-separated values
4. **More Context Menu Options**: Additional quick actions for workflow efficiency
5. **Improved ComfyUI Version Compatibility**: More robust detection and initialization
6. **Visual Feedback**: Better indication of relative weight relationships
7. **Weight Normalization**: Automatic normalization to prevent CFG burnout
8. **Value Distribution Presets**: Common weight patterns for different types of workflows
9. **Multi-Output Mode**: Separate outputs for each slider value

## Troubleshooting

If you encounter issues with the Dynamic Slider Pack:

1. **Sliders not updating?** Try refreshing the browser page
2. **Functionality stopped working?** Use the "Refresh Sliders" context menu option
3. **Node behavior inconsistent?** Delete and recreate the node if issues persist
4. **UI elements not appearing correctly?** Ensure the node has enough space to display all widgets
5. **Weight balance causing CFG issues?** Try reducing the overall `sliders_Max` value and ensure no single weight dominates excessively

## License

This project is licensed under the MIT License - see the LICENSE file for details.
