/**
 * Dynamic Sliders Stack - Modern Widget Hider
 * Manages widget visibility based on slider count
 */

// REMOVE top-level import attempts for app
/*
// Import app with fallbacks
let app;
try { app = await import('/scripts/app.js'); } catch (e) {
    try { app = await import('../../../scripts/app.js'); } catch (e) {
        app = window.app;
    }
}
*/

// REMOVE top-level check
// const isModernFrontend = app && app.extensionManager;

// Config
const NODE_CONFIG = {
    controlWidgets: 3,   // Number of control widgets
    maxSliders: 50,      // Maximum number of sliders
    // nodeRadius removed as ComfyUI default is round
};

let domObserver = null;      // DOM Mutation observer

// Helper to find node element
const findNodeElement = (nodeId) => document?.getElementById(nodeId) ||
    document?.querySelector(`.litegraph-node[data-node-id="${nodeId}"]`) ||
    document?.querySelector(`.comfy-node[data-node-id="${nodeId}"]`) ||
    document?.querySelector(`.node_box[data-litegraph-id="${nodeId}"]`) ||
    document?.querySelector(`.litegraph.litecontextualmenu .node_box[data-litegraph-id='${nodeId}']`);

// Extension definition
const extension = {
    app: null, // Add property to store app instance

    /** Set up the extension */
    setup(app) { // Receive app as argument
        // console.log("[DSS Modern Hider] setup() called.");
        this.app = app; // Store app instance

        // No need to check isModernFrontend here, this script should only load in modern
        this.createGlobalStyles();
        this.setupNodeTracking();
        // console.log("[DSS Modern Hider] setup() completed.");
        return true; // Indicate setup was successful (or based on actual success)
    },

    /** Update widget visibility (internal & DOM) */
    updateWidgetVisibility(node, sliderCount) {
        // console.log(`[DSS Modern Hider] updateWidgetVisibility called for node ${node.id}, sliderCount: ${sliderCount}`); // Log entry
        if (!node?.widgets) {
            // console.warn(`[DSS Modern Hider] No widgets found for node ${node.id}`);
            return;
        }

        // Sanitize slider count
        const originalSliderCount = sliderCount;
        sliderCount = Math.max(1, Math.min(Math.floor(sliderCount), NODE_CONFIG.maxSliders));
        if (originalSliderCount !== sliderCount) {
            // console.log(`[DSS Modern Hider] Sanitized sliderCount from ${originalSliderCount} to ${sliderCount}`);
        }

        // Update internal widget visibility
        let hiddenChangedCount = 0;
        node.widgets.slice(NODE_CONFIG.controlWidgets).forEach((widget, i) => {
            const shouldBeHidden = Math.floor(i / 2) + 1 > sliderCount;
            if (widget.hidden !== shouldBeHidden) {
                widget.hidden = shouldBeHidden;
                hiddenChangedCount++;
                // console.log(`[DSS Modern Hider] Set widget ${widget.name} (index ${i}) hidden: ${shouldBeHidden}`); // Optional detailed log
            }
        });
        // console.log(`[DSS Modern Hider] Updated 'hidden' property for ${hiddenChangedCount} widgets.`);

        // Remove the DOM manipulation block entirely
        /*
        // Update DOM widget visibility <-- REMOVED
        const nodeElement = findNodeElement(node.id);
        if (nodeElement) {
            const widgetContainers = nodeElement.querySelectorAll('.slotcontainer .for_widget');
            if (widgetContainers?.length > NODE_CONFIG.controlWidgets) {
                widgetContainers.forEach((container, i) => {
                    if (i >= NODE_CONFIG.controlWidgets) {
                        container.style.display = Math.floor((i - NODE_CONFIG.controlWidgets) / 2) + 1 > sliderCount ? 'none' : '';
                    }
                });
            }
        }
        */
    },

    /** Create global CSS */
    createGlobalStyles() {
        if (document.getElementById('dynamic-slider-stack-styles')) return;
        const style = document.createElement('style');
        style.id = 'dynamic-slider-stack-styles';
        style.textContent = `
            /* Hide disabled widgets */
            .widget.disabled { display: none !important; }
        `;
        document.head.appendChild(style);
    },

    /** Setup node tracking */
    setupNodeTracking() {
        // console.log("[DSS Modern Hider] setupNodeTracking() called.");
        // Use this.app instead of global app
        if (!this.app?.graph) {
            // console.warn("[DSS Modern Hider] this.app.graph not available during setupNodeTracking.");
            return;
        }

        // Process existing nodes
        // console.log(`[DSS Modern Hider] Processing ${this.app.graph.nodes?.length || 0} existing nodes.`);
        this.app.graph.nodes?.forEach(node => {
            // Add more comprehensive check including the suffixed name
            if (node.type === "Slider Stacker (DSS)" || node.type === "SliderStacker" || node.title === "Slider Stacker") {
                // console.log(`[DSS Modern Hider] Found existing Slider Stacker node (ID: ${node.id}, Type: ${node.type}, Title: ${node.title}). Processing...`);
                this.processNewNode(node);
            }
        });

        // Listen for new nodes
        // console.log("[DSS Modern Hider] Adding nodeCreated listener.");
        // Use this.app instead of global app
        this.app.graph.addEventListener("nodeCreated", (node) => {
            // console.log(`[DSS Modern Hider] nodeCreated event fired for node (ID: ${node.id}, Type: ${node.type}, Title: ${node.title})`);
            // Add more comprehensive check including the suffixed name
            if (node.type === "Slider Stacker (DSS)" || node.type === "SliderStacker" || node.title === "Slider Stacker") {
                 // console.log(`[DSS Modern Hider] nodeCreated is a Slider Stacker. Scheduling processNewNode...`);
                 // Pass 'this' context if processNewNode uses it, although it doesn't currently
                 setTimeout(() => this.processNewNode(node), 0);
            } else if (node.title === "Slider Receiver") { // Also log receiver for context
                 // console.log(`[DSS Modern Hider] nodeCreated is a Slider Receiver.`);
                 // Potentially call processNewNode if receiver needs processing later
            }
        });

        // Setup DOM observer
        // Pass 'this' context if setupDOMObserver uses it (it doesn't currently)
        this.setupDOMObserver();
        // console.log("[DSS Modern Hider] setupNodeTracking() completed.");
    },

    /** Setup DOM observer */
    setupDOMObserver() {
        if (domObserver) domObserver.disconnect();

        domObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes?.forEach(domNode => { // Rename to domNode to avoid confusion with LiteGraph node
                    if (domNode.classList?.contains('comfy-node') && // Check for modern class name
                        domNode.dataset?.nodeType?.includes('Slider Stacker')) { // Check data attribute if available

                        // console.log(`[DSS Modern Hider] DOM Observer detected node addition (ID: ${domNode.dataset?.nodeId}, Type: ${domNode.dataset?.nodeType})`);
                        // Attempt to find the LiteGraph node and re-process it
                        // Use this.app
                        const lgNode = this.app?.graph?.getNodeById(parseInt(domNode.dataset?.nodeId));
                        if (lgNode) {
                            // console.log(`[DSS Modern Hider] Found corresponding LiteGraph node ${lgNode.id}. Processing...`);
                            this.processNewNode(lgNode);
                        } else {
                            // console.warn(`[DSS Modern Hider] Could not find LiteGraph node for DOM node ID ${domNode.dataset?.nodeId}`);
                        }
                    }
                });
            });
        });

        // Assuming the main graph container might have a different ID or structure in modern
        // Let's try a more generic approach or rely on setupNodeTracking initially
        // const graphCanvas = document.getElementById('graph-canvas'); // This might be legacy
        // For now, let's observe the body, which is less efficient but might catch additions
        // Consider refining this later if needed
        // console.log("[DSS Modern Hider] Setting up DOM Observer on document.body.");
        domObserver.observe(document.body, { childList: true, subtree: true });
    },

    /** Process a new node */
    processNewNode(node) {
        // console.log(`[DSS Modern Hider] processNewNode called for node (ID: ${node.id}, Type: ${node.type}, Title: ${node.title})`); // Log process entry
        if (!node) {
            // console.warn("[DSS Modern Hider] processNewNode called with null node.");
            return;
        }

        // Intercept widget and update visibility (only for Stacker)
        // Use more robust check
        if (node.type === "Slider Stacker (DSS)" || node.type === "SliderStacker" || node.title === "Slider Stacker") {
             // console.log(`[DSS Modern Hider] Node ${node.id} confirmed as Slider Stacker, calling interceptAndUpdate.`);
             this.interceptAndUpdate(node);
        }
        // No styling needed here, assuming ComfyUI default round shape
    },

    /** Intercept sliders_count widget setter and update visibility */
    interceptAndUpdate(node) {
        const widget = node.widgets?.find(w => w.name === "sliders_count");
        if (!widget) {
            // console.warn(`[DSS Modern Hider] 'sliders_count' widget not found for node ${node.id}`);
            return;
        }

        if (widget._valueSetterOverridden) {
             // console.log(`[DSS Modern Hider] Setter already overridden for node ${node.id}. Triggering initial update.`);
             this.updateWidgetVisibility(node, widget.value);
             return;
        }

        // console.log(`[DSS Modern Hider] Intercepting 'sliders_count' setter for node ${node.id}`);
        const originalSetter = Object.getOwnPropertyDescriptor(widget, "value")?.set;
        widget._valueSetterOverridden = true;

        Object.defineProperty(widget, "value", {
            get: function() { return this._value; },
            set: function(v) {
                // console.log(`[DSS Modern Hider] 'sliders_count' setter triggered for node ${node.id}. New value: ${v}, Old value: ${this._value}`);
                const oldValue = this._value;
                this._value = v;
                if (originalSetter) originalSetter.call(this, v);
                if (oldValue !== v) {
                    // console.log(`[DSS Modern Hider] Value changed, calling updateWidgetVisibility.`);
                    extension.updateWidgetVisibility(node, v);
                } else {
                    // console.log(`[DSS Modern Hider] Value did not change, skipping update.`);
                }
            },
            enumerable: true, configurable: true
        });

        // console.log(`[DSS Modern Hider] Triggering initial update for node ${node.id} with value ${widget.value}`);
        this.updateWidgetVisibility(node, widget.value); // Initial update
    },

    /** Clean up resources */
    cleanup() {
        if (domObserver) { domObserver.disconnect(); domObserver = null; }
        const style = document.getElementById('dynamic-slider-stack-styles');
        if (style) style.remove();
    }
};

export default extension;
