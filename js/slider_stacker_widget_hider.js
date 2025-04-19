import { app } from "../../scripts/app.js";

// Helper function to find a widget by name
const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
};

// Function to check if node is our Slider Stacker
function isSliderStackerNode(node) {
    const nodeTitle = node.getTitle ? node.getTitle() : node.title;
    if (nodeTitle === "Slider Stacker") return true;
    if (node.type === "Slider Stacker (DSS)") return true;
    return false;
}

// Constants for hiding
const HIDDEN_TAG = "_hidden_"; // Needs a unique suffix if other nodes use similar tags

// Cache for original widget properties
let originalWidgetProps = {};

// Function to toggle widget visibility using standard JS properties
function toggleWidgetVisibility(node, widget, show) {
    if (!widget) return false; // Return false if no widget

    // Store original properties if not already saved
    const widgetKey = `${node.id}_${widget.name}`;
    if (!originalWidgetProps[widgetKey]) {
        originalWidgetProps[widgetKey] = {
            origType: widget.type,
            origComputeSize: widget.computeSize,
            origHidden: widget.hidden // Store original hidden state if available
        };
    }

    const origProps = originalWidgetProps[widgetKey];
    // Check both hidden property and our custom type tag
    const isCurrentlyHidden = widget.hidden || widget.type === HIDDEN_TAG;

    // Only change if the state needs toggling
    if (show && !isCurrentlyHidden) return false; // Return false: no change needed
    if (!show && isCurrentlyHidden) return false; // Return false: no change needed

    if (show) {
        // Restore original properties
        widget.type = origProps.origType;
        widget.hidden = origProps.origHidden || false;
        widget.computeSize = origProps.origComputeSize || null; // Restore original or set to null
    } else {
        // Hide the widget
        widget.type = HIDDEN_TAG;
        widget.hidden = true;
        widget.computeSize = () => [0, -4]; // Standard way to hide widget space
    }

    // Mark the node as needing redraw
    node.setDirtyCanvas(true, false); // Only redraw foreground (nodes)
    return true; // Return true: change was made
}

// Function to handle the actual update of slider visibility
function updateSliderWidgetsVisibility(node) {
    if (!isSliderStackerNode(node) || !node.widgets) return;

    const countWidget = findWidgetByName(node, "sliders_count");
    if (!countWidget) {
        // Don't log error repeatedly if widget is just missing temporarily during load
        return;
    }

    let currentCount = 1;
    try {
        currentCount = parseInt(countWidget.value) || 1;
        currentCount = Math.max(1, Math.min(currentCount, 50)); // Clamp value (min 1)
    } catch (e) {
        console.error("Slider Stacker: Error parsing sliders_count value", e); // Keep error log
        currentCount = 1; // Default to 1 on error
    }

    const maxSliders = 50; // Assuming max 50 sliders based on Python code
    let visibilityChanged = false;
    // Store current width to preserve it
    const currentWidth = node.size[0];

    for (let i = 1; i <= maxSliders; i++) {
        const nameWidget = findWidgetByName(node, `slider_name_${i}`);
        const sliderWidget = findWidgetByName(node, `(${i})`);
        const shouldShow = i <= currentCount;

        let nameChanged = false;
        let sliderChanged = false;

        if (nameWidget) {
            nameChanged = toggleWidgetVisibility(node, nameWidget, shouldShow);
        }
        if (sliderWidget) {
            sliderChanged = toggleWidgetVisibility(node, sliderWidget, shouldShow);
        }

        if (nameChanged || sliderChanged) {
            visibilityChanged = true;
        }
    }

    // Trigger a resize and redraw if visibility actually changed
    if (visibilityChanged && node.graph) {
        // Recalculate the required size based on visible widgets
        let newHeight = node.size[1]; // Default to current height
        if (node.computeSize) {
            try {
                const computedSize = node.computeSize();
                if (computedSize && computedSize.length === 2) {
                    newHeight = computedSize[1]; // Get the computed height
                }
            } catch (e) {
                // Keep error log
                console.error("Slider Stacker: Error computing node size after visibility change", e);
            }
        }

        // Set the size, preserving width and using the new height
        node.setSize([currentWidth, newHeight]);

        // Mark the whole graph canvas as dirty to ensure redraw and layout adjustment
        node.graph.setDirtyCanvas(true, true);
    }
}

// Main App Extension
app.registerExtension({
    name: "Comfy.DynamicSlidersStack.WidgetHider.JS",

    // Called once per node type before registration
    beforeRegisterNodeDef(nodeType, nodeData, appInstance) {
        if (nodeData.name === "Slider Stacker (DSS)") {
            // Store original onConfigure if it exists
            const originalOnConfigure = nodeType.prototype.onConfigure;

            // Override onConfigure to apply initial visibility
            nodeType.prototype.onConfigure = function(info) {
                if (originalOnConfigure) {
                    originalOnConfigure.apply(this, arguments);
                }
                requestAnimationFrame(() => updateSliderWidgetsVisibility(this));
            };

            // Store original onConnectionsChange if it exists
            const originalOnConnectionsChange = nodeType.prototype.onConnectionsChange;

            // Override onConnectionsChange to potentially update visibility if needed
            nodeType.prototype.onConnectionsChange = function(side, slot, connect, link_info, output) {
                if (originalOnConnectionsChange) {
                    originalOnConnectionsChange.apply(this, arguments);
                }
                 requestAnimationFrame(() => updateSliderWidgetsVisibility(this));
            };
        }
    },

    // Called every time a node instance is created
    nodeCreated(node) {
        if (!isSliderStackerNode(node)) return;

        const countWidget = findWidgetByName(node, "sliders_count");
        if (!countWidget) {
            // Don't log error repeatedly
            return;
        }

        // Intercept the 'value' property of the sliders_count widget
        let widgetValue = countWidget.value;
        const descriptor = Object.getOwnPropertyDescriptor(countWidget, 'value');

        Object.defineProperty(countWidget, 'value', {
            configurable: true,
            enumerable: true,
            get() {
                return descriptor?.get ? descriptor.get.call(countWidget) : widgetValue;
            },
            set(newVal) {
                let changedValue = newVal;
                // Ensure value is at least 1
                changedValue = Math.max(1, parseInt(changedValue) || 1);

                if (descriptor?.set) {
                    descriptor.set.call(countWidget, changedValue);
                } else {
                    widgetValue = changedValue;
                }
                // Update input element visually if it exists
                if(countWidget.inputEl) {
                    countWidget.inputEl.value = changedValue;
                }
                requestAnimationFrame(() => updateSliderWidgetsVisibility(node));
            }
        });

        // Initial setup - apply visibility based on the default/loaded value
        requestAnimationFrame(() => updateSliderWidgetsVisibility(node));
    },

    // Called when node is added to the graph (might be redundant with nodeCreated)
    nodeAdded(node) {
         if (!isSliderStackerNode(node)) return;
         requestAnimationFrame(() => updateSliderWidgetsVisibility(node));
    }
});

// console.log("Loaded Dynamic Sliders Stack Widget Hider Script");
