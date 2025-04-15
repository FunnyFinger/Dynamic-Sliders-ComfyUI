import { app } from "../../scripts/app.js";

const COLOR_THEMES = {
    red: { nodeColor: "#332222", nodeBgColor: "#553333" },
    green: { nodeColor: "#223322", nodeBgColor: "#335533" },
    blue: { nodeColor: "#222233", nodeBgColor: "#333355" },
    pale_blue: { nodeColor: "#2a363b", nodeBgColor: "#3f5159" },
    cyan: { nodeColor: "#223333", nodeBgColor: "#335555" },
    purple: { nodeColor: "#332233", nodeBgColor: "#553355" },
    yellow: { nodeColor: "#443322", nodeBgColor: "#665533" },
    none: { nodeColor: null, nodeBgColor: null } // no color
};

// Updated NODE_COLORS map
const NODE_COLORS = {
    "Slider Stacker": "purple", 
    "Slider Receiver": "purple", // Added receiver, same color
    // Add other nodes here if needed
 };

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];  // Swap elements
    }
}

let colorKeys = Object.keys(COLOR_THEMES).filter(key => key !== "none");
shuffleArray(colorKeys);  // Shuffle the color themes initially

function setNodeColors(node, theme) {
    if (!theme) {return;}
    node.shape = "box"; // Apply box shape if desired
    if(theme.nodeColor && theme.nodeBgColor) {
        node.color = theme.nodeColor;
        node.bgcolor = theme.nodeBgColor;
    }
}

const ext = {
    // Updated extension name
    name: "Comfy.DynamicSlidersStack.Appearance",

    nodeCreated(node) {
        const nodeTitle = node.getTitle ? node.getTitle() : node.title;
        // Check if the node title exists in our updated map
        if (NODE_COLORS.hasOwnProperty(nodeTitle)) {
            let colorKey = NODE_COLORS[nodeTitle];

            // Random color logic (remains the same, applies if "random" is used)
            if (colorKey === "random") {
                if (colorKeys.length === 0 || !COLOR_THEMES[colorKeys[colorKeys.length - 1]]) {
                    colorKeys = Object.keys(COLOR_THEMES).filter(key => key !== "none");
                    shuffleArray(colorKeys);
                }
                colorKey = colorKeys.pop();
            }

            const theme = COLOR_THEMES[colorKey];
            setNodeColors(node, theme);
        }
    }
};

app.registerExtension(ext); 