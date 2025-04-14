(function() {
    // Wait for app to be defined
    const checkExist = setInterval(function() {
        if (typeof app !== 'undefined') {
            clearInterval(checkExist);
            
            // Log to console to verify the script is loaded
            console.log("[Dynamic_Slider_Pack] ✅ JavaScript loaded successfully.");
            
            // Register the extension
            app.registerExtension({
                name: "Dynamic_Slider_Pack",
                
                nodeCreated(node) {
                    // Only apply to our specific node
                    if (node.constructor.type !== "DynamicSlidersStack") {
                        return;
                    }
                    
                    console.log("[Dynamic_Slider_Pack] Node created, initializing");
                    
                    // Constants for node sizing
                    const HEADER_HEIGHT = 30;
                    const CONTROLS_HEIGHT = 60;
                    const PAIR_HEIGHT = 60;
                    const FOOTER_PADDING = 4;
                    const DEFAULT_WIDTH = 340;
                    const MIN_WIDTH = 200;
                    const MAX_SLIDER_VALUE = 2.0;  // Hard cap on max value
                    
                    // Lock to prevent recursive updates
                    node._updatingSliders = false;
                    
                    // Override the onResize method to handle width constraints properly
                    const origOnResize = node.onResize;
                    node.onResize = function(size) {
                        if (origOnResize) {
                            origOnResize.call(this, size);
                        }
                        
                        // Allow width to be changed freely but maintain minimum
                        if (size[0] < MIN_WIDTH) {
                            size[0] = MIN_WIDTH;
                        }
                        
                        // Calculate minimum height based on visible widgets
                        const countWidget = this.widgets.find(w => w.name === "sliders_count");
                        const count = countWidget ? countWidget.value : 5;
                        const minHeight = HEADER_HEIGHT + CONTROLS_HEIGHT + (count * PAIR_HEIGHT) + FOOTER_PADDING;
                        
                        // Set to exact calculated height to prevent extra space
                        size[1] = minHeight;
                        
                        this.size = size;
                    };
                    
                    // Function to find the maximum slider value and index
                    function findMaxSliderValue() {
                        const countWidget = node.widgets.find(w => w.name === "sliders_count");
                        if (!countWidget) return { maxValue: 1.0, maxIndex: 0 };
                        
                        const count = countWidget.value;
                        let maxValue = 0;
                        let maxIndex = -1;
                        
                        for (let i = 1; i <= count; i++) {
                            const sliderWidget = node.widgets.find(w => w.name === `slider_${i}`);
                            if (sliderWidget && !sliderWidget.hidden) {
                                if (sliderWidget.value > maxValue) {
                                    maxValue = sliderWidget.value;
                                    maxIndex = i - 1;  // Zero-based index
                                }
                            }
                        }
                        
                        // If no max found, use defaults
                        if (maxIndex < 0) {
                            maxValue = 1.0;
                            maxIndex = 0;
                        }
                        
                        return { maxValue, maxIndex };
                    }
                    
                    // Update the MAX widget based on current slider values
                    function updateMaxFromSliders() {
                        if (node._updatingSliders) return;
                        
                        const maxWidget = node.widgets.find(w => w.name === "sliders_Max");
                        if (!maxWidget) return;
                        
                        const { maxValue } = findMaxSliderValue();
                        
                        // Cap at the hard maximum of 2.0
                        const capped = Math.min(maxValue, MAX_SLIDER_VALUE);
                        
                        // Only update if significantly different
                        if (Math.abs(maxWidget.value - capped) > 0.0001) {
                            console.log(`[Dynamic_Slider_Pack] Updating MAX to ${capped.toFixed(4)} from sliders`);
                            maxWidget.value = capped;
                        }
                    }
                    
                    // Function to update widget visibility based on sliders_count
                    function updateWidgetVisibility() {
                        if (node._updatingSliders) return;
                        node._updatingSliders = true;
                        
                        try {
                            // Find the control widgets
                            const countWidget = node.widgets.find(w => w.name === "sliders_count");
                            const maxWidget = node.widgets.find(w => w.name === "sliders_Max");
                            
                            if (!countWidget || !maxWidget) {
                                console.error("[Dynamic_Slider_Pack] Could not find control widgets");
                                return;
                            }
                            
                            const count = countWidget.value;
                            const maxVal = Math.max(0.01, maxWidget.value);
                            
                            console.log(`[Dynamic_Slider_Pack] Updating visibility: showing ${count} sliders with max=${maxVal}`);
                            
                            // Loop through all potential title/slider widgets
                            let visibleSliders = 0;
                            for (let i = 1; i <= 10; i++) {
                                const titleWidget = node.widgets.find(w => w.name === `title_${i}`);
                                const sliderWidget = node.widgets.find(w => w.name === `slider_${i}`);
                                
                                if (titleWidget && sliderWidget) {
                                    // Show only up to 'count' widgets
                                    const shouldShow = i <= count;
                                    titleWidget.hidden = !shouldShow;
                                    sliderWidget.hidden = !shouldShow;
                                    
                                    if (shouldShow) {
                                        visibleSliders++;
                                        
                                        // Update slider's max value
                                        if (sliderWidget.options) {
                                            sliderWidget.options.max = MAX_SLIDER_VALUE;  // Always use the hard max
                                            sliderWidget.options.step = 0.0001;
                                            
                                            // Cap value at current Max if needed
                                            if (sliderWidget.value > maxVal) {
                                                sliderWidget.value = maxVal;
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Calculate the new height based on visible widgets
                            const newHeight = HEADER_HEIGHT + CONTROLS_HEIGHT + (visibleSliders * PAIR_HEIGHT) + FOOTER_PADDING;
                            
                            // Update node size
                            const currentWidth = node.size[0] || DEFAULT_WIDTH;
                            node.size = [currentWidth, newHeight];
                            
                            // Use the graph's setDirty for better rendering
                            if (node.graph) {
                                node.graph.setDirty(true, true);
                            } else {
                                node.setDirtyCanvas(true, true);
                            }
                        } finally {
                            node._updatingSliders = false;
                        }
                    }
                    
                    // Set up callbacks for each slider to update MAX value
                    function setupSliderCallbacks() {
                        for (let i = 1; i <= 10; i++) {
                            const sliderWidget = node.widgets.find(w => w.name === `slider_${i}`);
                            if (sliderWidget) {
                                // Store original callback if any
                                const origCallback = sliderWidget.callback;
                                
                                // Replace with our callback
                                sliderWidget.callback = function(v) {
                                    if (origCallback) origCallback.call(this, v);
                                    
                                    // Skip if we're currently updating sliders programmatically
                                    if (node._updatingSliders) return;
                                    
                                    // Update MAX widget if this slider is now the maximum
                                    updateMaxFromSliders();
                                };
                            }
                        }
                    }
                    
                    // Set up MAX widget callback to scale slider values
                    function setupMaxCallback() {
                        const maxWidget = node.widgets.find(w => w.name === "sliders_Max");
                        if (!maxWidget) return;
                        
                        // Store original callback if any
                        const origCallback = maxWidget.callback;
                        
                        // Replace with our callback to handle slider scaling
                        maxWidget.callback = function(newMax) {
                            if (origCallback) origCallback.call(this, newMax);
                            
                            // Skip if we're in the middle of updating
                            if (node._updatingSliders) return;
                            node._updatingSliders = true;
                            
                            try {
                                // Ensure minimum max value
                                newMax = Math.max(0.01, newMax);
                                console.log(`[Dynamic_Slider_Pack] MAX changed to ${newMax.toFixed(4)}`);
                                
                                // Find the current maximum slider
                                const { maxValue, maxIndex } = findMaxSliderValue();
                                
                                // Only proceed if we have a valid max index
                                if (maxIndex >= 0) {
                                    const countWidget = node.widgets.find(w => w.name === "sliders_count");
                                    const count = countWidget ? countWidget.value : 5;
                                    
                                    // Calculate scaling ratio
                                    const ratio = maxValue > 0 ? newMax / maxValue : 1;
                                    console.log(`[Dynamic_Slider_Pack] Scaling ratio: ${ratio.toFixed(4)}`);
                                    
                                    // Scale all slider values
                                    for (let i = 1; i <= count; i++) {
                                        const sliderWidget = node.widgets.find(w => w.name === `slider_${i}`);
                                        if (sliderWidget && !sliderWidget.hidden) {
                                            // Scale value
                                            const scaledValue = sliderWidget.value * ratio;
                                            sliderWidget.value = scaledValue;
                                        }
                                    }
                                }
                                
                                updateWidgetVisibility();
                            } finally {
                                node._updatingSliders = false;
                            }
                        };
                    }
                    
                    // Set up sliders_count callback
                    function setupCountCallback() {
                        const countWidget = node.widgets.find(w => w.name === "sliders_count");
                        if (!countWidget) return;
                        
                        const origCallback = countWidget.callback;
                        countWidget.callback = function(v) {
                            if (origCallback) origCallback.call(this, v);
                            
                            // Update slider visibility
                            updateWidgetVisibility();
                            
                            // After changing count, update MAX value
                            updateMaxFromSliders();
                        };
                    }
                    
                    // Add right-click menu options
                    function setupContextMenu() {
                        const getExtraMenuOptions = node.getExtraMenuOptions;
                        node.getExtraMenuOptions = function(_, options) {
                            if (getExtraMenuOptions) getExtraMenuOptions.apply(this, arguments);
                            
                            options.push({
                                content: "Refresh Sliders",
                                callback: () => {
                                    updateWidgetVisibility();
                                    updateMaxFromSliders();
                                }
                            });
                            
                            // Add option to evenly distribute slider values
                            options.push({
                                content: "Balance Slider Values",
                                callback: () => {
                                    const countWidget = node.widgets.find(w => w.name === "sliders_count");
                                    const maxWidget = node.widgets.find(w => w.name === "sliders_Max");
                                    
                                    if (countWidget && maxWidget) {
                                        const count = countWidget.value;
                                        const maxVal = Math.max(0.01, maxWidget.value);
                                        
                                        // Prevent callbacks during this operation
                                        node._updatingSliders = true;
                                        
                                        try {
                                            // Calculate step size for even distribution
                                            const step = count > 1 ? maxVal / (count - 1) : maxVal / 2;
                                            
                                            // Distribute values evenly, making sure highest = MAX
                                            for (let i = 0; i < count; i++) {
                                                const sliderWidget = node.widgets.find(w => w.name === `slider_${i+1}`);
                                                if (sliderWidget) {
                                                    const value = count > 1 ? step * i : maxVal / 2;
                                                    sliderWidget.value = value;
                                                }
                                            }
                                            
                                            // Set the last slider to exactly MAX
                                            if (count > 0) {
                                                const lastSlider = node.widgets.find(w => w.name === `slider_${count}`);
                                                if (lastSlider) {
                                                    lastSlider.value = maxVal;
                                                }
                                            }
                                        } finally {
                                            node._updatingSliders = false;
                                        }
                                        
                                        node.setDirtyCanvas(true, true);
                                    }
                                }
                            });
                            
                            // Add option to reset node size
                            options.push({
                                content: "Reset Node Size",
                                callback: () => {
                                    node.size[0] = DEFAULT_WIDTH;
                                    updateWidgetVisibility();
                                }
                            });
                        };
                    }
                    
                    // Initialize the node
                    function initialize() {
                        // Set up callbacks in this specific order
                        setupSliderCallbacks();
                        setupMaxCallback();
                        setupCountCallback();
                        setupContextMenu();
                        updateWidgetVisibility();
                        
                        // Add a short delay before updating Max based on sliders
                        setTimeout(() => {
                            updateMaxFromSliders();
                            console.log("[Dynamic_Slider_Pack] Initialization complete");
                        }, 200);
                    }
                    
                    // Initialize with a delay to ensure widgets are created
                    setTimeout(initialize, 500);
                }
            });
        }
    }, 100); // Check every 100ms
})();
