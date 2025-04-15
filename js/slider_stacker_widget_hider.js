import { app } from "../../scripts/app.js";

// --- Start: Simplified code snippets --- 

let origProps = {};
let initialized = false; 

const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
};

const doesInputWithNameExist = (node, name) => {
    return node.inputs ? node.inputs.some((input) => input.name === name) : false;
};

const HIDDEN_TAG = "tschide";
function toggleWidget(node, widget, show = false, suffix = "") {
    // ... (toggleWidget function remains the same) ...
    if (!widget || doesInputWithNameExist(node, widget.name)) return;
    if (!origProps[widget.name]) {
        origProps[widget.name] = { origType: widget.type, origComputeSize: widget.computeSize };
    }
    const origSize = node.size;
    widget.type = show ? origProps[widget.name].origType : HIDDEN_TAG + suffix;
    widget.computeSize = show ? origProps[widget.name].origComputeSize : () => [0, -4];
    widget.linkedWidgets?.forEach(w => toggleWidget(node, w, ":" + widget.name, show));
    let newHeight = node.size[1]; 
    try {
        if (node.computeSize) {
             newHeight = node.computeSize()[1];
        } else if (node.onResize) {
             node.onResize(node.size);
             newHeight = node.size[1];
        } 
    } catch (e) {
        console.error("Error computing node size for", node.getTitle(), e);
    }
    node.setSize([node.size[0], newHeight]);
}

function generateWidgetNames(baseName, count) {
    return Array.from({ length: count }, (_, i) => `${baseName}_${i + 1}`);
}

function handleSliderVisibility(node, countValue) {
    const node_type = "Slider Stacker";
    const baseNamesMap = {
        "Slider Stacker": ["slider_name", ""]
    };
    const baseNames = baseNamesMap[node_type];
    if (!baseNames) return;
    const sliderCountWidget = findWidgetByName(node, "slider_count");
    const maxSliders = sliderCountWidget?.options?.max || 50; 
    for (let i = 1; i <= maxSliders; i++) { 
        const nameWidget = findWidgetByName(node, `${baseNames[0]}_${i}`);
        const weightWidget = findWidgetByName(node, `(${i})`);
        const currentCount = Number(countValue) || 0;
        const show = i <= currentCount;
        toggleWidget(node, nameWidget, show);
        toggleWidget(node, weightWidget, show);
    }
    node.graph.setDirtyCanvas(true, true);
}

function handleSliderStackerSliderCount(node, widget) {
    handleSliderVisibility(node, widget.value);
}

// Updated handler map key to match new display name
const nodeWidgetHandlers = {
    "Slider Stacker": { // Updated node title check
        'slider_count': handleSliderStackerSliderCount
    }
};

function widgetLogic(node, widget) {
    const nodeTitle = node.getTitle ? node.getTitle() : node.title;
    // Use the potentially updated title for the handler check
    const handler = nodeWidgetHandlers[nodeTitle]?.[widget.name]; 
    if (handler) {
        handler(node, widget);
    }
}

// --- End: Simplified code snippets --- 

app.registerExtension({
    // Updated extension name
    name: "Comfy.DynamicSlidersStack.WidgetHider",
    nodeCreated(node) {
        const nodeTitle = node.getTitle ? node.getTitle() : node.title;
        // Check for the new display name
        if (nodeTitle === "Slider Stacker") { 
            let hasSliderStackerHandler = false; 

            for (const w of node.widgets || []) {
                 // Use updated title for handler check
                 if (nodeWidgetHandlers[nodeTitle]?.[w.name]) { 
                     hasSliderStackerHandler = true;
                 }
            }

            if(hasSliderStackerHandler) {
                for (const w of node.widgets) {
                    // Use updated title for handler check
                    if (nodeWidgetHandlers[nodeTitle]?.[w.name]) { 
                        // ... (value interception logic remains the same) ...
                        let widgetValue = w.value;
                        let originalDescriptor = Object.getOwnPropertyDescriptor(w, 'value');
                        if (!originalDescriptor) {
                            let proto = Object.getPrototypeOf(w);
                            while (proto && !originalDescriptor && proto !== Object.prototype) {
                                originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                                proto = Object.getPrototypeOf(proto);
                            }
                        }
                        Object.defineProperty(w, 'value', {
                            configurable: true, 
                            enumerable: true,   
                            get() {
                                let valueToReturn = originalDescriptor?.get
                                    ? originalDescriptor.get.call(w)
                                    : widgetValue;
                                return valueToReturn;
                            },
                            set(newVal) {
                                if (originalDescriptor?.set) {
                                    originalDescriptor.set.call(w, newVal);
                                } else {
                                    widgetValue = newVal;
                                }
                                widgetLogic(node, w);
                            }
                        });
                         widgetLogic(node, w);
                    }
                }
            }
            // Trigger full node redraw after setup
            setTimeout(() => { 
                const sliderCountWidget = findWidgetByName(node, "slider_count");
                if (sliderCountWidget) { 
                    handleSliderVisibility(node, sliderCountWidget.value);
                } else {
                     node.graph.setDirtyCanvas(true, true);
                }
             }, 50); 
        }
    }
}); 