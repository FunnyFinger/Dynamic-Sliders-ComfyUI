import { app } from "../../scripts/app.js";

console.log("Loading Dynamic.js for Slider Stacker (Refactored)");

// --- Helper Functions --- (remain the same) ...

const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
};
const getWidgetValue = (widget) => {
    const val = widget?.value;
    const num = Number(val);
    return isNaN(num) ? 0 : num; 
};
function interceptWidgetValue(node, widgetName, setterCallback) {
    const widget = findWidgetByName(node, widgetName);
    if (!widget) return;
    let internalValueTracker = widget.value; 
    let originalDescriptor = Object.getOwnPropertyDescriptor(widget, 'value');
    if (!originalDescriptor) {
        let proto = Object.getPrototypeOf(widget);
        while (proto && !originalDescriptor && proto !== Object.prototype) {
            originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'value');
            proto = Object.getPrototypeOf(proto);
        }
    }
    Object.defineProperty(widget, 'value', {
        configurable: true,
        enumerable: true,
        get() { /* ... */ return originalDescriptor?.get ? originalDescriptor.get.call(widget) : internalValueTracker; },
        set(newValue) {
            if (node._isUpdatingInternally) { /* ... */
                 if (originalDescriptor?.set) { originalDescriptor.set.call(widget, newValue); } else { internalValueTracker = newValue; }
                 if (widget.inputEl) { widget.inputEl.value = Number(newValue).toFixed(widget.options?.precision ?? 2); }
                 return;
            }
            const clampedNewValue = Math.max(widget.options?.min ?? -Infinity, Math.min(Number(newValue) || 0, widget.options?.max ?? Infinity));
            if (originalDescriptor?.set) { originalDescriptor.set.call(widget, clampedNewValue); }
            internalValueTracker = clampedNewValue;
            if(widget.inputEl) { widget.inputEl.value = internalValueTracker.toFixed(widget.options?.precision ?? 2); }
            setterCallback(clampedNewValue);
        }
    });
}

// --- Core Logic Functions --- (remain the same) ...

function recalculateCurrentMaxStrength(node) { /* ... */
    const sliderCountWidget = findWidgetByName(node, "slider_count");
    const count = getWidgetValue(sliderCountWidget);
    let currentMaxValue = 0;
    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) { 
            currentMaxValue = Math.max(currentMaxValue, getWidgetValue(wtWidget));
        }
    }
    const maxStrengthWidget = findWidgetByName(node, "slider_max_strength");
    const overallMax = maxStrengthWidget?.options?.max ?? 2.0;
    const overallMin = maxStrengthWidget?.options?.min ?? 0.0;
    return Math.max(overallMin, Math.min(currentMaxValue, overallMax));
 }
function updateNormalization(node, currentMaxStrength) { /* ... */ 
    if (!node.normalizedSliderWeights) node.normalizedSliderWeights = {};
    const sliderCountWidget = findWidgetByName(node, "slider_count");
    const maxSliders = sliderCountWidget?.options?.max || 50;
    for (let i = 1; i <= maxSliders; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const currentWt = getWidgetValue(wtWidget);
            node.normalizedSliderWeights[i] = (currentMaxStrength > 0) ? (currentWt / currentMaxStrength) : (node.normalizedSliderWeights[i] !== undefined ? node.normalizedSliderWeights[i] : 0);
        }
    }
}
function updateAllSliderDisplays(node, newMaxStrength) { /* ... */ 
    if (!node.normalizedSliderWeights || node._isUpdatingInternally) return; 
    node._isUpdatingInternally = true;
    const sliderCountWidget = findWidgetByName(node, "slider_count");
    const count = getWidgetValue(sliderCountWidget);
    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const normalizedValue = node.normalizedSliderWeights[i] || 0;
            let newDisplayValue = normalizedValue * newMaxStrength;
            const widgetMax = wtWidget.options?.max ?? 2.0;
            const widgetMin = wtWidget.options?.min ?? 0.0;
            newDisplayValue = Math.max(widgetMin, Math.min(newDisplayValue, widgetMax, newMaxStrength)); 
            if (Math.abs(getWidgetValue(wtWidget) - newDisplayValue) > 0.001) {
                wtWidget.value = newDisplayValue;
            }
        }
    }
    node.graph.setDirtyCanvas(true, true);
    node._isUpdatingInternally = false;
}

// --- ComfyUI Extension --- 

app.registerExtension({
    // Updated extension name
    name: "Comfy.DynamicSlidersStack.DynamicBehavior", 

    nodeCreated(node) {
        const nodeTitle = node.getTitle ? node.getTitle() : node.title;
        // Check for new display name
        if (nodeTitle !== "Slider Stacker") return; 

        node.normalizedSliderWeights = {};
        node._isUpdatingInternally = false;

        const maxStrengthWidget = findWidgetByName(node, "slider_max_strength");
        const sliderCountWidget = findWidgetByName(node, "slider_count");

        if (!maxStrengthWidget || !sliderCountWidget) {
            console.error("Slider Stacker Dynamic.js: Setup failed, required widgets not found.");
            return;
        }

        // --- Initialize --- (remains the same) ...
        setTimeout(() => { /* ... */
            const initialMax = recalculateCurrentMaxStrength(node);
            if (Math.abs(initialMax - getWidgetValue(maxStrengthWidget)) > 0.001) {
                maxStrengthWidget.value = initialMax; 
            }
            updateNormalization(node, initialMax);
            updateAllSliderDisplays(node, initialMax); 
        }, 150);


        // --- Set up Widget Interceptors --- (remain the same, logic relies on widget names)

        interceptWidgetValue(node, "slider_max_strength", (newMax) => { /* ... */
             updateAllSliderDisplays(node, newMax);
             const actualMaxAfterUpdate = recalculateCurrentMaxStrength(node);
             if (Math.abs(actualMaxAfterUpdate - newMax) > 0.001) {
                  node._isUpdatingInternally = true;
                  maxStrengthWidget.value = actualMaxAfterUpdate;
                  node._isUpdatingInternally = false;
             }
         });

        const maxSlidersIntercept = sliderCountWidget?.options?.max || 50;
        for (let i = 1; i <= maxSlidersIntercept; i++) {
            interceptWidgetValue(node, `(${i})`, (newWt) => { /* ... */
                const currentMaxStrengthWidget = findWidgetByName(node, "slider_max_strength");
                const currentMaxDisplayed = getWidgetValue(currentMaxStrengthWidget);
                const newCalculatedMax = recalculateCurrentMaxStrength(node);
                updateNormalization(node, newCalculatedMax);
                if (Math.abs(newCalculatedMax - currentMaxDisplayed) > 0.001) {
                    node._isUpdatingInternally = true;
                    currentMaxStrengthWidget.value = newCalculatedMax; 
                    node._isUpdatingInternally = false;
                } else {
                     updateAllSliderDisplays(node, currentMaxDisplayed);
                 }
            });
        }
    }
}); 