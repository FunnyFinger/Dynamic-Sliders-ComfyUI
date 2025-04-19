import { app } from "../../scripts/app.js";

// Removed console log

// --- Helper Functions (Copied from Dynamic.js for self-containment) ---

const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
};

const getWidgetValue = (widget) => {
    const val = widget?.value;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

// Function to check if node is our Slider Stacker using multiple identification methods
function isSliderStackerNode(node) {
    // Check the display title
    const nodeTitle = node.getTitle ? node.getTitle() : node.title;
    if (nodeTitle === "Slider Stacker") return true;

    // Check internal type name
    if (node.type === "Slider Stacker (DSS)") return true;

    // Check properties that are unique to our node
    if (findWidgetByName(node, "sliders_count") &&
        findWidgetByName(node, "sliders_max") &&
        findWidgetByName(node, "slider_name_1")) {
        return true;
    }

    return false;
}

// Gets the actual max strength based on current slider values and activity
function recalculateCurrentMaxStrength(node) {
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    const count = getWidgetValue(sliderCountWidget);
    let currentMaxValue = 0;
    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            currentMaxValue = Math.max(currentMaxValue, getWidgetValue(wtWidget));
        }
    }
    const maxStrengthWidget = findWidgetByName(node, "sliders_max");
    const overallMax = maxStrengthWidget?.options?.max ?? 2.0;
    const overallMin = maxStrengthWidget?.options?.min ?? 0.0;
    return Math.max(overallMin, Math.min(currentMaxValue, overallMax));
}

// Updates the stored normalized weights based on current displayed values and max strength
function updateNormalization(node, currentMaxStrength) {
     if (!node.normalizedSliderWeights) node.normalizedSliderWeights = {}; // Ensure it exists
     const sliderCountWidget = findWidgetByName(node, "sliders_count");
     const maxSliders = sliderCountWidget?.options?.max || 50;
     for (let i = 1; i <= maxSliders; i++) {
         const wtWidget = findWidgetByName(node, `(${i})`);
         if (wtWidget) {
             const currentWt = getWidgetValue(wtWidget);
             node.normalizedSliderWeights[i] = (currentMaxStrength > 0)
                 ? (currentWt / currentMaxStrength)
                 : (node.normalizedSliderWeights[i] !== undefined ? node.normalizedSliderWeights[i] : 0);
         }
     }
}

// Updates the displayed values of individual sliders based on normalized weights and new max strength
// Note: Needs access to node._isUpdatingInternally if called directly, but here it's used post-operation
function updateAllSliderDisplaysFromContext(node, newMaxStrength) {
    if (!node.normalizedSliderWeights) return;
    node._isUpdatingInternally = true; // Set flag for this operation
    const count = getWidgetValue(findWidgetByName(node, "sliders_count"));
    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const normalizedValue = node.normalizedSliderWeights[i] || 0;
            let newDisplayValue = normalizedValue * newMaxStrength;
            const widgetMax = wtWidget.options?.max ?? 2.0;
            const widgetMin = wtWidget.options?.min ?? 0.0;
            newDisplayValue = Math.max(widgetMin, Math.min(newDisplayValue, widgetMax, newMaxStrength));
            if (Math.abs(getWidgetValue(wtWidget) - newDisplayValue) > 0.001) {
                wtWidget.value = newDisplayValue; // This should use the intercepted setter
            }
        }
    }
    if (node.graph) {
        node.graph.setDirtyCanvas(true, true);
    }
    node._isUpdatingInternally = false;
}

// --- Function to add menu options ---

function addContextMenuOptions(node) {
    const originalGetExtraMenuOptions = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function(_, options) {
        if (originalGetExtraMenuOptions) {
            originalGetExtraMenuOptions.apply(this, arguments);
        }

        // Option 1: Average Values
        options.push({
            content: "Average Slider Values",
            callback: () => {
                const count = getWidgetValue(findWidgetByName(this, "sliders_count"));
                let sum = 0;
                let activeCount = 0;
                for (let i = 1; i <= count; i++) {
                     const wtWidget = findWidgetByName(this, `(${i})`);
                     if(wtWidget) {
                         sum += getWidgetValue(wtWidget);
                         activeCount++;
                     }
                }
                const average = activeCount > 0 ? sum / activeCount : 0;

                this._isUpdatingInternally = true;
                for (let i = 1; i <= count; i++) {
                    const wtWidget = findWidgetByName(this, `(${i})`);
                    if (wtWidget) { wtWidget.value = average; }
                }
                this._isUpdatingInternally = false;

                // Recalculate max and update normalization *after* loop
                const newMax = recalculateCurrentMaxStrength(this);
                updateNormalization(this, newMax);

                // Trigger update on master slider to sync everything
                const masterWidget = findWidgetByName(this, "sliders_max");
                if (masterWidget && Math.abs(getWidgetValue(masterWidget) - newMax) > 0.001) {
                    masterWidget.value = newMax; // This uses the setter from Dynamic.js
                } else {
                     // If max didn't change, still redraw displays based on new average
                     updateAllSliderDisplaysFromContext(this, newMax);
                }
                 if (this.graph) {
                     this.graph.setDirtyCanvas(true, true);
                 }
            }
        });

        // Option 2: Reset Values
        options.push({
            content: "Reset Slider Values",
            callback: () => {
                const count = getWidgetValue(findWidgetByName(this, "sliders_count"));
                const defaultValue = 1.0;

                this._isUpdatingInternally = true;
                for (let i = 1; i <= count; i++) {
                    const wtWidget = findWidgetByName(this, `(${i})`);
                    if (wtWidget) { wtWidget.value = defaultValue; }
                }
                this._isUpdatingInternally = false;

                const newMax = recalculateCurrentMaxStrength(this);
                updateNormalization(this, newMax);
                const masterWidget = findWidgetByName(this, "sliders_max");
                 if (masterWidget && Math.abs(getWidgetValue(masterWidget) - newMax) > 0.001) {
                    masterWidget.value = newMax;
                } else {
                    updateAllSliderDisplaysFromContext(this, newMax);
                }
                if (this.graph) {
                    this.graph.setDirtyCanvas(true, true);
                }
            }
        });

        // Option 3: Set All to Max Value
        options.push({
            content: "Set All to Max Value",
            callback: () => {
                const count = getWidgetValue(findWidgetByName(this, "sliders_count"));
                let maxValue = -Infinity; // Start low

                // First pass: Find the maximum value among visible sliders
                for (let i = 1; i <= count; i++) {
                     const wtWidget = findWidgetByName(this, `(${i})`);
                     if(wtWidget) {
                         maxValue = Math.max(maxValue, getWidgetValue(wtWidget));
                     }
                }

                // Second pass: Set all visible sliders to the found maximum value
                this._isUpdatingInternally = true;
                for (let i = 1; i <= count; i++) {
                    const wtWidget = findWidgetByName(this, `(${i})`);
                    if (wtWidget) { wtWidget.value = maxValue; } // Use setter
                }
                this._isUpdatingInternally = false;

                // Recalculate max (should be == maxValue), normalize, and update master slider
                const newMax = recalculateCurrentMaxStrength(this); // Will be maxValue
                updateNormalization(this, newMax);
                const masterWidget = findWidgetByName(this, "sliders_max");
                // Update master slider directly - its setter handles updating displays
                if (masterWidget && Math.abs(getWidgetValue(masterWidget) - newMax) > 0.001) {
                    masterWidget.value = newMax;
                }
                if (this.graph) {
                    this.graph.setDirtyCanvas(true, true);
                }
            }
        });

        // Option 4: Set All to Min Value
        options.push({
            content: "Set All to Min Value",
            callback: () => {
                const count = getWidgetValue(findWidgetByName(this, "sliders_count"));
                let minValue = Infinity; // Start high

                // First pass: Find the minimum value among visible sliders
                for (let i = 1; i <= count; i++) {
                     const wtWidget = findWidgetByName(this, `(${i})`);
                     if(wtWidget) {
                        minValue = Math.min(minValue, getWidgetValue(wtWidget));
                     }
                }

                // Second pass: Set all visible sliders to the found minimum value
                this._isUpdatingInternally = true;
                for (let i = 1; i <= count; i++) {
                    const wtWidget = findWidgetByName(this, `(${i})`);
                    if (wtWidget) { wtWidget.value = minValue; } // Use setter
                }
                this._isUpdatingInternally = false;

                // Recalculate max (will be == minValue), normalize, and update master slider
                const newMax = recalculateCurrentMaxStrength(this); // Will be minValue
                updateNormalization(this, newMax);
                const masterWidget = findWidgetByName(this, "sliders_max");
                // Update master slider directly
                 if (masterWidget && Math.abs(getWidgetValue(masterWidget) - newMax) > 0.001) {
                    masterWidget.value = newMax;
                }
                if (this.graph) {
                    this.graph.setDirtyCanvas(true, true);
                }
            }
        });
    };
}

// --- ComfyUI Extension ---

app.registerExtension({
    name: "Comfy.DynamicSlidersStack.ContextMenu",
    nodeCreated(node) {
        // Use our robust identification instead of title
        if (isSliderStackerNode(node)) {
            addContextMenuOptions(node);
        }
    }
});

// console.log("Loaded Dynamic Sliders Stack Context Menu Script");
