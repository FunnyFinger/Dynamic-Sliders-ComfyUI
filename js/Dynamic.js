import { app } from "../../scripts/app.js";

// Define the hard cap for sliders maximum
const SLIDERS_MAX_HARD_CAP = 2.0;
const REFERENCE_AVG_BUFFER = 0.01; // Buffer to prevent sliders_max hitting exactly reference_avg

// --- Helper Functions ---

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

// Intercepts widget value changes
function interceptWidgetValue(node, widgetName, setterCallback) {
    const widget = findWidgetByName(node, widgetName);
    if (!widget) {
        // console.error(`Slider Stacker: Could not find widget ${widgetName} to intercept.`);
        return;
    }
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
        get() {
            return originalDescriptor?.get ? originalDescriptor.get.call(widget) : internalValueTracker;
        },
        set(newValue) {
            // --- Special Check for Locked Sum ---
            // If this specific widget is 'sliders_sum' and the lock is on, prevent user changes.
            if (widgetName === 'sliders_sum') {
                const lockWidget = findWidgetByName(node, "lock_sum");
                if (lockWidget?.value && !node._isUpdatingInternally) {
                    // Only block manual user changes while allowing internal updates
                    // Visually revert input if possible (optional, helps reinforce lock)
                    if (widget.inputEl) {
                        const actualSum = getCurrentSum(node);
                        const precision = widget.options?.precision ?? 2;
                        widget.inputEl.value = actualSum.toFixed(precision);
                    }

                    // Log attempt to change locked sum
                    // console.log("Manual change to locked sum widget blocked");

                    // Prevent setting the value or calling the callback
                    return;
                }
            }

            // --- Regular Update Logic ---
            if (node._isUpdatingInternally) {
                 if (originalDescriptor?.set) { originalDescriptor.set.call(widget, newValue); } else { internalValueTracker = newValue; }
                 if (widget.inputEl) {
                    try { widget.inputEl.value = Number(newValue).toFixed(widget.options?.precision ?? 2); } catch (e) { /* Ignore */ }
                 }
                 return;
            }
            const precision = widget.options?.precision ?? 2;
            let clampedNewValue = Math.max(widget.options?.min ?? -Infinity, Math.min(Number(newValue) || 0, widget.options?.max ?? Infinity));
            clampedNewValue = parseFloat(clampedNewValue.toFixed(precision));

            if (originalDescriptor?.set) { originalDescriptor.set.call(widget, clampedNewValue); }
            internalValueTracker = clampedNewValue;
            if(widget.inputEl) {
                 try { widget.inputEl.value = internalValueTracker.toFixed(precision); } catch(e) {/* Ignore */}
            }
            // Only call the callback if the value actually changed (or if it's not locked sum)
            // Note: setterCallback might still be called even if value is same due to float precision?
            // Let's call it regardless for now, the callback can handle its own logic.
            setterCallback(clampedNewValue);
        }
    });
}

// --- Sum Lock Logic ---

// Moved applySumLockVisuals definition BEFORE its first use
function applySumLockVisuals(sumWidget, locked) {
    if (sumWidget?.inputEl) {
        sumWidget.inputEl.style.pointerEvents = locked ? 'none' : '';
        sumWidget.inputEl.style.opacity = locked ? '0.6' : '';
        // Add readOnly property toggle
        sumWidget.inputEl.readOnly = locked;
    }
}

// --- Sum Widget Limit Calculation & Update ---

// Calculate the lowest possible sum given the original deltas
function calculateMinimumPossibleSum(node) {
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return 0;

    const count = getWidgetValue(sliderCountWidget);
    let sum = 0;

    // For minimum sum, only positive deltas contribute
    for (let i = 1; i <= count; i++) {
        const delta = node.originalDeltas?.[i] || 0;
        if (delta > 0) {
            sum += delta;
        }
    }

    return sum;
}

// Calculate the maximum possible sum when maintaining original deltas
function calculateMaximumPossibleSum(node) {
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget || !node.originalDeltas) return 0;

    const count = getWidgetValue(sliderCountWidget);
    let maxDelta = 0;
    let totalDeltas = 0;
    let activeSliderCount = 0;

    // Find maximum delta and count active sliders
    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const delta = node.originalDeltas[i] || 0;
            maxDelta = Math.max(maxDelta, delta);
            totalDeltas += delta;
            activeSliderCount++;
        }
    }

    // Calculate the maximum possible sum:
    if (activeSliderCount > 0) {
        const maxBaseValue = SLIDERS_MAX_HARD_CAP - maxDelta;
        return (maxBaseValue * activeSliderCount) + totalDeltas;
    }

    return 0;
}

// Updates the min/max limits of the sliders_sum widget, incorporating the lock state
function updateSumWidgetLimits(node) {
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    const sumWidget = findWidgetByName(node, "sliders_sum");
    const lockWidget = findWidgetByName(node, "lock_sum");

    if (!sliderCountWidget || !sumWidget || !lockWidget) return;

    const count = getWidgetValue(sliderCountWidget);
    const currentSum = getWidgetValue(sumWidget);
    const isLocked = lockWidget?.value || false;
    const precision = sumWidget.options?.precision ?? 2;
    const epsilon = Math.pow(10, -precision) / 2; // Small value based on precision

    node._isUpdatingInternally = true;

    // Apply visual indicators for lock state but don't restrict the sum widget value
    if (isLocked) {
        // Apply lock visuals but keep actual sum limits
        const absoluteMinSum = calculateMinimumPossibleSum(node);
        const absoluteMaxSum = calculateMaximumPossibleSum(node);
        let minValue = Math.max(0, absoluteMinSum);
        let maxValue = absoluteMaxSum;

        // Update the widget options with dynamic limits
        sumWidget.options.min = parseFloat(minValue.toFixed(precision));
        sumWidget.options.max = parseFloat(maxValue.toFixed(precision));

        // Apply visual indicators for lock state
        applySumLockVisuals(sumWidget, true);
    } else {
        // Remove lock: Calculate dynamic limits based on deltas
        const absoluteMinSum = calculateMinimumPossibleSum(node);
        const absoluteMaxSum = calculateMaximumPossibleSum(node);
        let minValue = Math.max(0, absoluteMinSum);
        let maxValue = absoluteMaxSum;

        // Update the widget options with dynamic limits
        sumWidget.options.min = parseFloat(minValue.toFixed(precision));
        sumWidget.options.max = parseFloat(maxValue.toFixed(precision));
        applySumLockVisuals(sumWidget, false);

        // Update reference_sum when not locked
        node.reference_sum = currentSum;

        // Clamp current value if it falls outside the new dynamic range
        if (currentSum < minValue) {
            sumWidget.value = minValue;
        } else if (currentSum > maxValue) {
            sumWidget.value = maxValue;
        }
    }

    node._isUpdatingInternally = false;
    // Ensure the input element reflects potential clamping/option changes
    if (sumWidget.inputEl) {
         try { sumWidget.inputEl.value = getWidgetValue(sumWidget).toFixed(precision); } catch(e) {}
    }
}

// Updates the displayed value of the sliders_sum widget
function updateTotalSumWidget(node) {
    const sumWidget = findWidgetByName(node, "sliders_sum");
    const lockWidget = findWidgetByName(node, "lock_sum");
    if (!sumWidget) return;

    // Always calculate and display the real sum of all sliders
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    const count = getWidgetValue(sliderCountWidget);
    let currentSum = 0;

    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            currentSum += getWidgetValue(wtWidget);
        }
    }

    // Always update the sum widget with the actual sum regardless of lock state
    // Use direct assignment to bypass the interceptor's lock check
    node._isUpdatingInternally = true;
    if (sumWidget.inputEl) {
        const precision = sumWidget.options?.precision ?? 2;
        try {
            sumWidget.inputEl.value = currentSum.toFixed(precision);
        } catch(e) {/* Ignore */}
    }

    // Update the internal value directly
    let originalDescriptor = Object.getOwnPropertyDescriptor(sumWidget, 'value');
    if (originalDescriptor?.set) {
        originalDescriptor.set.call(sumWidget, currentSum);
    } else {
        sumWidget.value = currentSum;
    }
    node._isUpdatingInternally = false;

    // Update reference_sum only when not locked
    if (!lockWidget?.value) {
        node.reference_sum = currentSum;
    }

    // Update sum widget limits
    updateSumWidgetLimits(node);

    if (node.graph) {
        node.graph.setDirtyCanvas(true, true);
    }
}

// Calculate the maximum base value that can be used without any slider exceeding the hard cap
function calculateMaxBaseValue(activeSliders) {
    if (!activeSliders || activeSliders.length === 0) return 0;

    let maxPossibleBaseValue = SLIDERS_MAX_HARD_CAP;

    for (const slider of activeSliders) {
        const maxBaseForThisSlider = SLIDERS_MAX_HARD_CAP - (slider.delta || 0);
        maxPossibleBaseValue = Math.min(maxPossibleBaseValue, maxBaseForThisSlider);
    }

    return Math.max(0, maxPossibleBaseValue);
}

// Stores the relative differences between sliders
function storeDeltaValues(node) {
    if (!node.sliderDeltas) node.sliderDeltas = {};
    if (!node.originalDeltas) node.originalDeltas = {}; // Store a copy that won't be modified

    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return;

    const count = getWidgetValue(sliderCountWidget);

    // Find the minimum value among all active sliders
    let minValue = Number.MAX_VALUE;
    const activeSliders = [];

    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const value = getWidgetValue(wtWidget);
            minValue = Math.min(minValue, value);
            activeSliders.push({
                index: i,
                widget: wtWidget,
                value: value
            });
        }
    }

    if (activeSliders.length === 0) return;
    if (minValue === Number.MAX_VALUE) minValue = 0; // Handle case where all values might be non-numeric somehow

    // If min value is very small, treat it as zero
    if (minValue < 0.001) minValue = 0;

    // Store the delta for each slider from the minimum value
    for (const slider of activeSliders) {
        node.sliderDeltas[slider.index] = slider.value - minValue;
        node.originalDeltas[slider.index] = slider.value - minValue; // Store unchanging copy
    }

    // Also store the minimum value and current sum for future calculations
    node.baseSliderValue = minValue;
    node.lastTotalSum = getCurrentSum(node);
}

// Gets the current sum of slider values
function getCurrentSum(node) {
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return 0;

    const count = getWidgetValue(sliderCountWidget);
    let totalSum = 0;

    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            totalSum += getWidgetValue(wtWidget);
        }
    }

    return totalSum;
}

// Updates individual sliders based on a change in the total sum
function updateSlidersBasedOnDeltas(node, newSum) {
    if (!node.sliderDeltas || !node.originalDeltas || node._isUpdatingInternally) return;

    // Mark that we're updating via sum to prevent delta recalculation
    node._isUpdatingSumSlider = true;
    node._isUpdatingInternally = true;

    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    const lockWidget = findWidgetByName(node, "lock_sum");

    if (!sliderCountWidget) {
        node._isUpdatingInternally = false;
        node._isUpdatingSumSlider = false;
        return;
    }

    const count = getWidgetValue(sliderCountWidget);

    // Use reference_sum instead of newSum when toggle is on
    const targetSum = lockWidget?.value ? node.reference_sum : newSum;

    // Collect active sliders with their deltas and calculate min/max possible sum
    const activeSliders = [];
    let positiveDeltas = 0;
    let totalDelta = 0;

    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const delta = node.originalDeltas[i] || 0;

            // Track positive deltas for minimum sum calculation
            if (delta > 0) {
                positiveDeltas += delta;
            }

            activeSliders.push({
                index: i,
                widget: wtWidget,
                delta: delta,
                min: wtWidget.options?.min ?? 0.0,
                max: SLIDERS_MAX_HARD_CAP // Use hard cap as the absolute maximum
            });

            totalDelta += delta;
        }
    }

    if (activeSliders.length === 0) {
        node._isUpdatingInternally = false;
        node._isUpdatingSumSlider = false;
        return;
    }

    // Calculate the maximum base value that ensures no slider exceeds the hard cap
    const maxBaseValue = calculateMaxBaseValue(activeSliders);

    // Calculate absolute min and max possible sums
    const minPossibleSum = positiveDeltas;
    const maxPossibleSum = (maxBaseValue * activeSliders.length) + totalDelta;

    // Ensure the target sum is within valid bounds
    const clampedTargetSum = Math.max(minPossibleSum, Math.min(maxPossibleSum, targetSum));

    // Special case: If we're at or near minimum sum
    if (Math.abs(clampedTargetSum - minPossibleSum) < 0.01) {
        for (const slider of activeSliders) {
            const targetValue = Math.max(0, slider.delta);
            slider.widget.value = targetValue;
        }
    }
    // Special case: If we're at or near maximum sum
    else if (Math.abs(clampedTargetSum - maxPossibleSum) < 0.01) {
        for (const slider of activeSliders) {
            const targetValue = maxBaseValue + slider.delta;
            slider.widget.value = Math.min(targetValue, SLIDERS_MAX_HARD_CAP);
        }
    }
    // Normal case: Calculate base value
    else {
        const baseValue = (clampedTargetSum - totalDelta) / activeSliders.length;
        for (const slider of activeSliders) {
            const targetValue = baseValue + slider.delta;
            const constrainedValue = Math.max(slider.min, Math.min(targetValue, slider.max));
            slider.widget.value = constrainedValue;
        }
    }

    // Update max strength to maintain consistency
    const maxStrengthWidget = findWidgetByName(node, "sliders_max");
    if (maxStrengthWidget) {
        const newCalculatedMax = recalculateCurrentMaxStrength(node);
        maxStrengthWidget.value = newCalculatedMax;
        updateNormalization(node, newCalculatedMax);
    }

    // Update the widget limits
    updateSumWidgetLimits(node);

    // Verify we haven't exceeded the maximum possible sum and correct if needed
    const currentSumAfterUpdate = getCurrentSum(node);
    if (currentSumAfterUpdate > maxPossibleSum + 0.01) {
        // console.warn(`Sum exceeded maximum: ${currentSumAfterUpdate} > ${maxPossibleSum}, correcting...`);
        const scaleFactor = maxPossibleSum / currentSumAfterUpdate;
        for (const slider of activeSliders) {
            const currentValue = getWidgetValue(slider.widget);
            slider.widget.value = currentValue * scaleFactor;
        }
    }

    // Keep track of the sum but never recalculate deltas during sum adjustment
    node.lastTotalSum = getCurrentSum(node);

    // Clear flags
    node._isUpdatingInternally = false;
    node._isUpdatingSumSlider = false;

    if (node.graph) {
        node.graph.setDirtyCanvas(true, true);
    }
}

// --- Max Strength and Normalization Logic ---

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
function updateNormalization(node, currentMaxStrength) {
    if (!node.normalizedSliderWeights) node.normalizedSliderWeights = {};
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    const maxSliders = sliderCountWidget?.options?.max || 50;
    for (let i = 1; i <= maxSliders; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            const currentWt = getWidgetValue(wtWidget);
            // Handle division by zero or near-zero
            const norm = (currentMaxStrength > 0.0001) ? (currentWt / currentMaxStrength) : 0;
            node.normalizedSliderWeights[i] = norm;
        }
    }
}
function updateAllSliderDisplays(node, newMaxStrength) {
    if (!node.normalizedSliderWeights || node._isUpdatingInternally) return;
    node._isUpdatingInternally = true;
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
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
    if (node.graph) {
        node.graph.setDirtyCanvas(true, true);
    }
    node._isUpdatingInternally = false;
}

// Calculate the current average of active sliders
function calculateCurrentAverage(node) {
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return 0;
    const count = getWidgetValue(sliderCountWidget);
    let totalSum = 0;
    let activeSliderCount = 0;
    for (let i = 1; i <= count; i++) {
        const wtWidget = findWidgetByName(node, `(${i})`);
        if (wtWidget) {
            totalSum += getWidgetValue(wtWidget);
            activeSliderCount++;
        }
    }
    return activeSliderCount > 0 ? totalSum / activeSliderCount : 0;
}

// Updates the internal state for sliders_avg and reference_avg
function updateAverageState(node, updateContext = null) {
    const lockWidget = findWidgetByName(node, "lock_sum");
    const currentAvg = calculateCurrentAverage(node);
    node.sliders_avg = currentAvg;
    // Update reference_avg unless lock is ON AND the update came from sliders_max
    if (!(lockWidget?.value && updateContext === 'sliders_max')) {
        node.reference_avg = currentAvg;
    }
    // console.log(`Avg updated: ${node.sliders_avg.toFixed(3)}, Ref Avg: ${node.reference_avg.toFixed(3)}, Context: ${updateContext}`);
}

// --- ComfyUI Extension ---

app.registerExtension({
    name: "Comfy.DynamicSlidersStack.DynamicBehavior",

    nodeCreated(node) {
        if (!isSliderStackerNode(node)) return;

        // Initialize node state
        node.normalizedSliderWeights = {};
        node.sliderDeltas = {};
        node.originalDeltas = {}; // Add immutable copy of deltas
        node.baseSliderValue = 0;
        node.lastTotalSum = 0;
        node.reference_sum = 0; // Reference sum for locked mode
        node.sliders_avg = 0;   // NEW: Initialize sliders average
        node.reference_avg = 0; // NEW: Initialize reference average
        node._isUpdatingInternally = false;
        node._isUpdatingSumSlider = false;

        // Get key widgets
        const maxStrengthWidget = findWidgetByName(node, "sliders_max");
        const sliderCountWidget = findWidgetByName(node, "sliders_count");
        const sumWidget = findWidgetByName(node, "sliders_sum");
        const lockWidget = findWidgetByName(node, "lock_sum");

        if (!maxStrengthWidget || !sliderCountWidget || !sumWidget || !lockWidget) {
            // console.error("Slider Stacker Dynamic.js: Setup failed, required widgets not found (max, count, sum, lock).");
            return;
        }

        // --- Initialize ---
        setTimeout(() => {
            // Set up initial max strength
            const initialMax = recalculateCurrentMaxStrength(node);
            if (Math.abs(initialMax - getWidgetValue(maxStrengthWidget)) > 0.001) {
                maxStrengthWidget.value = initialMax;
            }

            // Initialize normalization and slider displays
            updateNormalization(node, initialMax);
            updateAllSliderDisplays(node, initialMax);

            // Store initial delta values between sliders
            storeDeltaValues(node);

            // Initialize reference_sum with the actual sum
            const initialSum = getCurrentSum(node);
            node.reference_sum = initialSum;

            // Initial sum calculation and limits update
            updateTotalSumWidget(node);
            // NEW: Initial average calculation
            updateAverageState(node);
        }, 150);

        // --- Set up Widget Interceptors ---

        // Intercept sliders_max changes
        interceptWidgetValue(node, "sliders_max", (newMax) => {
            const lockWidget = findWidgetByName(node, "lock_sum");
            let actualAchievedMax; // Variable to store the max value after adjustments
            // Epsilon for general comparison still needed if separate from buffer
            const epsilon = 0.0001;

            if (lockWidget?.value) {
                // --- Locked Sum Behavior ---
                // Clamp the requested max based on reference average + BUFFER and hard cap
                const effectiveMax = Math.max(node.reference_avg + REFERENCE_AVG_BUFFER, Math.min(newMax, SLIDERS_MAX_HARD_CAP));

                // Call the new locked update function
                updateSlidersForMaxChangeLockedSum(node, effectiveMax);

                // After locked update, check the actual max achieved
                actualAchievedMax = recalculateCurrentMaxStrength(node);

                // Correct the sliders_max widget if the effectiveMax couldn't be fully reached
                // Or if the user tried to drag below reference_avg + BUFFER
                const valueToSet = Math.max(node.reference_avg + REFERENCE_AVG_BUFFER, actualAchievedMax); // Ensure widget never shows less than ref_avg + BUFFER
                if (Math.abs(getWidgetValue(maxStrengthWidget) - valueToSet) > 0.001) { // Use a slightly larger tolerance for setting widget display
                    node._isUpdatingInternally = true;
                    maxStrengthWidget.value = valueToSet;
                    node._isUpdatingInternally = false;
                }

            } else {
                // --- Unlocked Sum Behavior (Original) ---
                updateAllSliderDisplays(node, newMax); // Use the original function
                actualAchievedMax = recalculateCurrentMaxStrength(node);

                // Correct the widget if requested max wasn't reached
                if (Math.abs(actualAchievedMax - newMax) > 0.001) {
                    node._isUpdatingInternally = true;
                    maxStrengthWidget.value = actualAchievedMax;
                    node._isUpdatingInternally = false;
                }
            }

            // --- Common Updates (Run for both locked and unlocked) ---
            // Deltas might need recalculation based on the new slider values
            storeDeltaValues(node);
            updateTotalSumWidget(node); // Update sum display (should be constant if locked)
            updateAverageState(node, 'sliders_max'); // Update average state with context
        });

        // Intercept sliders_count changes
        interceptWidgetValue(node, "sliders_count", (newCount) => {
            const currentMaxStrength = getWidgetValue(maxStrengthWidget);
            updateNormalization(node, currentMaxStrength);
            updateAllSliderDisplays(node, currentMaxStrength);
            storeDeltaValues(node);
            updateTotalSumWidget(node);
            updateAverageState(node);   // NEW: Update average state
        });

        // Intercept sliders_sum changes
        interceptWidgetValue(node, "sliders_sum", (newSum) => {
            // When toggle is off, update sliders based on the new sum
            // When toggle is on, use the reference_sum instead
            if (!lockWidget.value) {
                // If unlocked, update sliders AND reference_sum based on the new sum
                updateSlidersBasedOnDeltas(node, newSum);
                node.reference_sum = newSum;
            } else {
                // If locked, completely ignore manual changes and revert to actual sum

                // Set a timeout to revert the widget to show the actual sum after user input
                setTimeout(() => {
                    // Get current actual sum
                    const actualSum = getCurrentSum(node);

                    // Force update the widget to show actual sum
                    node._isUpdatingInternally = true;
                    sumWidget.value = actualSum;
                    node._isUpdatingInternally = false;

                    // Make sure the input element displays the correct value
                    if (sumWidget.inputEl) {
                        try {
                            const precision = sumWidget.options?.precision ?? 2;
                            sumWidget.inputEl.value = actualSum.toFixed(precision);
                        } catch(e) {}
                    }
                }, 0);

                // Use reference_sum for any slider updates
                updateSlidersBasedOnDeltas(node, node.reference_sum);
            }

            // Always update limits/visuals after a change attempt
            updateSumWidgetLimits(node);
            updateAverageState(node); // NEW: Update average state after sum changes
        });

        // Intercept lock_sum - Trigger limit/visual update
        interceptWidgetValue(node, "lock_sum", (isLocked) => {
            // If locking (changing from unlocked to locked), store the current sum as reference
            if (isLocked) {
                // Store the current calculated sum as the reference value when locking
                node.reference_sum = getCurrentSum(node);
            }

            // Update the sum widget limits and appearance based on the new lock state
            updateSumWidgetLimits(node);

            // Always update total sum widget to reflect actual calculated sum
            updateTotalSumWidget(node);
            updateAverageState(node); // NEW: Update average state after lock change

            if (node.graph) node.graph.setDirtyCanvas(true, true); // Redraw to show visual changes
        });

        const maxSlidersIntercept = sliderCountWidget?.options?.max || 50;
        for (let i = 1; i <= maxSlidersIntercept; i++) {
            interceptWidgetValue(node, `(${i})`, (newWt) => {
                // Skip delta update if we're updating via the sum slider
                if (node._isUpdatingSumSlider) {
                    updateTotalSumWidget(node); // Still update sum display
                    return;
                }

                // Skip delta recalculation and inverse adjustment if we're updating internally
                if (node._isUpdatingInternally) {
                    return;
                }

                // Get current value for comparison
                const sliderWidget = findWidgetByName(node, `(${i})`);
                const currentValue = getWidgetValue(sliderWidget);

                // Check if toggle is on and we need to maintain constant sum
                const lockWidget = findWidgetByName(node, "lock_sum");
                if (lockWidget?.value) {
                    // In lock mode, redistribute changes to maintain constant sum

                    // Apply redistribution and get constrained new value
                    const constrainedNewValue = redistributeSliderChange(node, i, newWt, currentValue);

                    // If constrained value is different than the attempted value, update the widget
                    if (Math.abs(constrainedNewValue - newWt) > 0.0001) {
                        // Need to update the widget with constrained value, but avoid triggering another intercept
                        node._isUpdatingInternally = true;
                        sliderWidget.value = constrainedNewValue;
                        node._isUpdatingInternally = false;

                        // Update max strength and normalization to reflect the new state
                        const currentMaxStrengthWidget = findWidgetByName(node, "sliders_max");
                        const newCalculatedMax = recalculateCurrentMaxStrength(node);
                        updateNormalization(node, newCalculatedMax);

                        if (Math.abs(newCalculatedMax - getWidgetValue(currentMaxStrengthWidget)) > 0.001) {
                            node._isUpdatingInternally = true;
                            currentMaxStrengthWidget.value = newCalculatedMax;
                            node._isUpdatingInternally = false;
                        }

                        // Force update of sum widget with correct sum
                        node._isUpdatingInternally = true;
                        updateTotalSumWidget(node);
                        node._isUpdatingInternally = false;
                        updateAverageState(node); // NEW: Update average after internal sum update

                        // If lock is on, verify and correct sum as a final step
                        if (lockWidget?.value) {
                            verifyAndCorrectSum(node);
                        }

                        return;
                    }
                }

                const currentMaxStrengthWidget = findWidgetByName(node, "sliders_max");
                const currentMaxDisplayed = getWidgetValue(currentMaxStrengthWidget);
                const newCalculatedMax = recalculateCurrentMaxStrength(node);
                updateNormalization(node, newCalculatedMax); // Update normalization with potentially new max

                // Update master slider display if the calculated max changed
                if (Math.abs(newCalculatedMax - currentMaxDisplayed) > 0.001) {
                    node._isUpdatingInternally = true;
                    currentMaxStrengthWidget.value = newCalculatedMax;
                    node._isUpdatingInternally = false;
                } else {
                    // If master didn't change, still ensure other sliders respect the current max
                     updateAllSliderDisplays(node, currentMaxDisplayed);
                 }

                 // Only recalculate deltas when sliders are directly changed
                 storeDeltaValues(node);

                 // Force update of sum widget with correct sum regardless of lock state
                 node._isUpdatingInternally = true;
                 updateTotalSumWidget(node); // Update sum display
                 node._isUpdatingInternally = false;
                 updateAverageState(node); // NEW: Update average after direct slider change (non-locked)

                 // If lock is on, verify and correct sum as a final step
                 if (lockWidget?.value) {
                     verifyAndCorrectSum(node);
                 }
            });
        }
    }
});

// console.log("Loaded Dynamic Sliders Stack Dynamic Behavior Script V6.0 (Code Cleanup)");

// Redistributes slider change inversely to maintain constant sum
function redistributeSliderChange(node, changedSliderIndex, newValue, oldValue) {
    if (!node.reference_sum) return newValue;

    // Get necessary widgets
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return newValue;
    const count = getWidgetValue(sliderCountWidget);

    // Calculate the delta that needs to be distributed
    const delta = newValue - oldValue;

    // If delta is negligible, no need to redistribute
    if (Math.abs(delta) < 0.0001) return newValue;

    // Find all other active sliders and collect their values
    const otherSliders = [];
    for (let i = 1; i <= count; i++) {
        if (i === changedSliderIndex) continue;
        const sliderWidget = findWidgetByName(node, `(${i})`);
        if (sliderWidget) {
            otherSliders.push({
                index: i,
                widget: sliderWidget,
                value: getWidgetValue(sliderWidget)
            });
        }
    }

    // If no other sliders, we can't redistribute
    if (otherSliders.length === 0) return oldValue;

    // Calculate the exact change per slider using the formula:
    // If slider_x increases by X, other sliders decrease by X/(sliders_count-1)
    const changePerSlider = -delta / otherSliders.length;

    // First, check if any slider would hit its min/max limit with the proposed change
    let limitingSlider = null;
    let maxPossibleChangePerSlider = Infinity;

    for (const slider of otherSliders) {
        const newSliderValue = slider.value + changePerSlider;

        // Check against min (0) constraint
        if (newSliderValue < 0) {
            const possibleChange = -slider.value; // How much this slider can decrease
            if (possibleChange > -0.0001) { // If slider is already near 0
                limitingSlider = slider;
                maxPossibleChangePerSlider = 0;
            } else if (Math.abs(possibleChange) < Math.abs(maxPossibleChangePerSlider)) {
                limitingSlider = slider;
                maxPossibleChangePerSlider = possibleChange;
            }
        }

        // Check against max (2.0) constraint
        else if (newSliderValue > SLIDERS_MAX_HARD_CAP) {
            const possibleChange = SLIDERS_MAX_HARD_CAP - slider.value; // How much this slider can increase
            if (possibleChange < 0.0001) { // If slider is already near max
                limitingSlider = slider;
                maxPossibleChangePerSlider = 0;
            } else if (Math.abs(possibleChange) < Math.abs(maxPossibleChangePerSlider)) {
                limitingSlider = slider;
                maxPossibleChangePerSlider = possibleChange;
            }
        }
    }

    // If we found a limiting slider, constrain the primary slider's movement
    let constrainedChangePerSlider = changePerSlider;
    let constrainedDelta = delta;

    if (limitingSlider && Math.abs(maxPossibleChangePerSlider) < Math.abs(changePerSlider)) {
        constrainedChangePerSlider = maxPossibleChangePerSlider;
        constrainedDelta = -constrainedChangePerSlider * otherSliders.length;
    }

    // Calculate the constrained new value for the primary slider
    const constrainedNewValue = oldValue + constrainedDelta;

    // Now apply the SAME exact change to ALL other sliders
    for (const slider of otherSliders) {
        const targetValue = slider.value + constrainedChangePerSlider;
        const clampedValue = Math.max(0, Math.min(SLIDERS_MAX_HARD_CAP, targetValue));

        // Apply the change
        node._isUpdatingInternally = true;
        slider.widget.value = clampedValue;
        node._isUpdatingInternally = false;
    }

    // Verify and correct to ensure exact reference_sum compliance
    verifyAndCorrectSum(node);

    // Return the constrained new value for the main slider
    return constrainedNewValue;
}

// Adjust sliders to fix tiny precision-based deviations from reference_sum
function verifyAndCorrectSum(node) {
    if (!node.reference_sum) return;

    const lockWidget = findWidgetByName(node, "lock_sum");
    if (!lockWidget?.value) return; // Only verify when lock is on

    const actualSum = getCurrentSum(node);
    const diff = actualSum - node.reference_sum;

    // If the difference is negligible, no need to correct
    if (Math.abs(diff) < 0.0001) return;

    // Get all active sliders
    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return;
    const count = getWidgetValue(sliderCountWidget);

    const activeSliders = [];

    // Collect all slider values
    for (let i = 1; i <= count; i++) {
        const sliderWidget = findWidgetByName(node, `(${i})`);
        if (sliderWidget) {
            const value = getWidgetValue(sliderWidget);
            activeSliders.push({
                index: i,
                widget: sliderWidget,
                value: value
            });
        }
    }

    if (activeSliders.length === 0) return;

    // Distribute the correction evenly across all sliders
    const correctionPerSlider = -diff / activeSliders.length;

    // Apply the correction to all sliders
    node._isUpdatingInternally = true;

    for (const slider of activeSliders) {
        const newValue = slider.value + correctionPerSlider;
        const constrainedValue = Math.max(0, Math.min(SLIDERS_MAX_HARD_CAP, newValue));
        slider.widget.value = constrainedValue;
    }

    node._isUpdatingInternally = false;

    // Update average state after correction
    updateAverageState(node); // NEW: Update average after sum correction
}

// NEW: Adjusts sliders when sliders_max changes and sum is locked
function updateSlidersForMaxChangeLockedSum(node, requestedNewMax) {
    if (node._isUpdatingInternally) return;

    const sliderCountWidget = findWidgetByName(node, "sliders_count");
    if (!sliderCountWidget) return;
    const count = getWidgetValue(sliderCountWidget);
    if (count <= 1) return; // Need at least 2 sliders to make this adjustment meaningful

    const reference_sum = node.reference_sum;
    const reference_avg = node.reference_avg;
    const epsilon = 0.0001;

    // Clamp the requested max value initially based on reference_avg + BUFFER and hard cap
    const initiallyClampedMax = Math.max(reference_avg + REFERENCE_AVG_BUFFER, Math.min(requestedNewMax, SLIDERS_MAX_HARD_CAP));

    // Collect active sliders, their values, and find the current max value/slider
    const sliders = [];
    let currentMaxSliderValue = -Infinity;
    let maxSliderIndex = -1;
    for (let i = 1; i <= count; i++) {
        const widget = findWidgetByName(node, `(${i})`);
        if (widget) {
            const currentValue = getWidgetValue(widget);
            sliders.push({ index: i, widget: widget, currentValue: currentValue });
            if (currentValue > currentMaxSliderValue) {
                currentMaxSliderValue = currentValue;
                maxSliderIndex = i;
            }
        }
    }

    if (sliders.length <= 1 || maxSliderIndex === -1) return; // Need at least 2 sliders

    // Calculate the ideal change for the highest slider based on the clamped request
    const idealDeltaH = initiallyClampedMax - currentMaxSliderValue;

    // If the ideal change is negligible, do nothing
    if (Math.abs(idealDeltaH) < epsilon) {
        // Even if no change, ensure the widget reflects the current max (or ref_avg + BUFFER)
        const maxStrengthWidget = findWidgetByName(node, "sliders_max");
        const valueToSet = Math.max(reference_avg + REFERENCE_AVG_BUFFER, currentMaxSliderValue);
        if(maxStrengthWidget && Math.abs(getWidgetValue(maxStrengthWidget) - valueToSet) > epsilon) {
             node._isUpdatingInternally = true;
             maxStrengthWidget.value = valueToSet;
             node._isUpdatingInternally = false;
        }
        return;
    }

    node._isUpdatingInternally = true;

    // Total change needed for all other sliders to compensate
    const idealDeltaO_total = -idealDeltaH;

    // Calculate deviations from average for *other* sliders and their sum
    let totalDeviationO = 0;
    const otherSliders = [];
    sliders.forEach(s => {
        if (s.index !== maxSliderIndex) {
            s.deviation = s.currentValue - reference_avg;
            totalDeviationO += s.deviation;
            otherSliders.push(s);
        }
    });

    // --- Find the most constraining factor ---
    let maxAllowedDeltaH = idealDeltaH; // Start with the ideal change
    let limitingFactorFound = false;

    if (otherSliders.length > 0) {
        // Handle case where all other sliders are at the average (avoid division by zero)
        if (Math.abs(totalDeviationO) < epsilon) {
            const changePerSlider = idealDeltaO_total / otherSliders.length;
            for (const s of otherSliders) {
                let deltaI_max;
                if (changePerSlider < 0 && s.currentValue + changePerSlider < 0) { // Hitting zero
                    deltaI_max = -s.currentValue;
                } else if (changePerSlider > 0 && s.currentValue + changePerSlider > SLIDERS_MAX_HARD_CAP) { // Hitting max
                    deltaI_max = SLIDERS_MAX_HARD_CAP - s.currentValue;
                } else {
                    continue; // This slider doesn't limit the change
                }

                // Calculate the corresponding max deltaH for this slider
                const currentDeltaH_max = -deltaI_max * otherSliders.length;
                if (Math.abs(currentDeltaH_max) < Math.abs(maxAllowedDeltaH)) {
                    maxAllowedDeltaH = currentDeltaH_max;
                    limitingFactorFound = true;
                }
            }
        } else {
            // Proportional distribution
            for (const s of otherSliders) {
                const proportion = s.deviation / totalDeviationO;
                const idealDeltaI = idealDeltaO_total * proportion;

                let deltaI_max;
                if (idealDeltaI < 0 && s.currentValue + idealDeltaI < 0) { // Hitting zero
                    deltaI_max = -s.currentValue;
                } else if (idealDeltaI > 0 && s.currentValue + idealDeltaI > SLIDERS_MAX_HARD_CAP) { // Hitting max
                    deltaI_max = SLIDERS_MAX_HARD_CAP - s.currentValue;
                } else {
                    continue; // This slider doesn't limit the change
                }

                // Calculate the corresponding max deltaH for this slider
                // deltaI_max = (-deltaH_max) * proportion => deltaH_max = -deltaI_max / proportion
                 if (Math.abs(proportion) > epsilon) { // Avoid division by zero if proportion is tiny
                    const currentDeltaH_max = -deltaI_max / proportion;
                    // We only care if this limit is stricter (smaller magnitude) than the current maxAllowedDeltaH
                    // And has the same sign as the idealDeltaH
                    if (Math.sign(currentDeltaH_max) === Math.sign(idealDeltaH) && Math.abs(currentDeltaH_max) < Math.abs(maxAllowedDeltaH)) {
                        maxAllowedDeltaH = currentDeltaH_max;
                        limitingFactorFound = true;
                    }
                }
            }
        }
    }

    // Use the constrained change
    const constrainedDeltaH = limitingFactorFound ? maxAllowedDeltaH : idealDeltaH;
    const constrainedDeltaO_total = -constrainedDeltaH;
    const finalHighestSliderValue = currentMaxSliderValue + constrainedDeltaH;

    // --- Apply the constrained changes ---
    let finalValues = {};
    finalValues[maxSliderIndex] = finalHighestSliderValue;

    // Distribute the constrained change among other sliders
    if (otherSliders.length > 0) {
        if (Math.abs(totalDeviationO) < epsilon) {
            const changePerSlider = constrainedDeltaO_total / otherSliders.length;
            otherSliders.forEach(s => {
                finalValues[s.index] = s.currentValue + changePerSlider;
            });
        } else {
            otherSliders.forEach(s => {
                const proportion = s.deviation / totalDeviationO;
                const deltaI = constrainedDeltaO_total * proportion;
                finalValues[s.index] = s.currentValue + deltaI;
            });
        }
    }

    // Apply changes with clamping (as a safeguard)
    sliders.forEach(s => {
        const clampedValue = Math.max(0, Math.min(SLIDERS_MAX_HARD_CAP, finalValues[s.index]));
        if (Math.abs(s.widget.value - clampedValue) > epsilon) {
             s.widget.value = clampedValue;
        }
    });

    // --- Update sliders_max widget directly ---
    const maxStrengthWidget = findWidgetByName(node, "sliders_max");
    const finalWidgetValue = Math.max(reference_avg + REFERENCE_AVG_BUFFER, Math.min(finalHighestSliderValue, SLIDERS_MAX_HARD_CAP)); // Clamp final value, ensuring min is ref_avg + BUFFER
    if (maxStrengthWidget && Math.abs(getWidgetValue(maxStrengthWidget) - finalWidgetValue) > epsilon) {
        maxStrengthWidget.value = finalWidgetValue;
    }

    node._isUpdatingInternally = false;

    // Final check to enforce sum constraint strictly
    verifyAndCorrectSum(node);

    if (node.graph) {
        node.graph.setDirtyCanvas(true, true);
    }
}

