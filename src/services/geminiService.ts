import { GoogleGenAI, Type } from "@google/genai";
import type { GraphData, NodeData, AIConfig } from '../types';

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        nodes: {
            type: Type.ARRAY,
            description: "A list of all identified network devices or entities.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: {
                        type: Type.STRING,
                        description: "A unique identifier for the device. CRITICAL: Use the MAC address for the ID if available. Otherwise, use the IP address as a fallback."
                    },
                    name: {
                        type: Type.STRING,
                        description: "A human-readable name for the device (e.g., 'Gateway Router', 'WebServer01')."
                    },
                    role: {
                        type: Type.STRING,
                        description: "The inferred role of the device. Possible roles: 'Router', 'Access Point', 'Switch', 'Server', 'Client', 'Smartphone', 'Tablet', 'Laptop', 'PC', 'Printer', 'Webcam', 'NAS', 'Firewall', 'ONT', 'Scanner', 'Other'."
                    },
                    ipAddress: {
                        type: Type.STRING,
                        description: "The IP address of the device, if available."
                    },
                    macAddress: {
                        type: Type.STRING,
                        description: "The MAC address of the device, if available."
                    },
                    vendor: {
                        type: Type.STRING,
                        description: "The manufacturer or vendor of the device, inferred from the MAC address if possible (e.g., 'Apple', 'Cisco')."
                    },
                    openPorts: {
                        type: Type.ARRAY,
                        description: "A list of open TCP/UDP ports discovered on the device as strings, if available.",
                        items: {
                            type: Type.STRING
                        }
                    },
                    ping: {
                        type: Type.STRING,
                        description: "The ping latency to the device, if available (e.g., '23ms')."
                    }
                },
                required: ["id", "name", "role"]
            },
        },
        links: {
            type: Type.ARRAY,
            description: "A list of connections between the identified devices.",
            items: {
                type: Type.OBJECT,
                properties: {
                    source: {
                        type: Type.STRING,
                        description: "The 'id' of the source node for the connection."
                    },
                    target: {
                        type: Type.STRING,
                        description: "The 'id' of the target node for the connection."
                    }
                },
                required: ["source", "target"]
            },
        }
    },
    required: ["nodes", "links"]
};

/**
 * A replacer function for JSON.stringify to remove properties injected by the d3 simulation
 * and to simplify link objects, making the JSON clean for AI consumption.
 */
function cleanD3Properties(key: string, value: any) {
    if (['source', 'target'].includes(key) && typeof value === 'object' && value !== null) {
        return (value as NodeData).id; // Send only the ID for links
    }
    if (['x', 'y', 'vx', 'vy', 'fx', 'fy', 'index'].includes(key)) {
        return undefined; // Remove d3 simulation properties
    }
    return value;
}

function buildPrompt(fileContent: string, existingGraphData: GraphData | null, config: AIConfig): string {
    if (existingGraphData) {
        // Use a more robust, algorithmic prompt for local models which may struggle with nuanced instructions.
        if (config.provider === 'local') {
            return `
You are a data processing engine. Your SOLE task is to merge new network log data into an existing JSON network map.
Your output MUST be a single, complete JSON object of the final merged map.
You MUST follow this algorithm exactly.

**ALGORITHM:**

1.  **INITIALIZE:** Start with the provided "EXISTING MAP" as your base.
2.  **PROCESS NEW DATA:** Analyze the "NEW LOG DATA" to identify devices and connections.
3.  **MERGE DEVICES:** For each device found in the NEW LOG DATA:
    a. **CHECK MAC ADDRESS:** If the device has a MAC address, search the EXISTING MAP for a node with the *exact same* \`macAddress\`.
    b. **IF MAC MATCH FOUND:** This is the same device. **DO NOT CREATE A DUPLICATE NODE.** Instead, **UPDATE** the existing node with any new information (like a new IP, open ports, vendor, etc.).
    c. **IF NO MAC MATCH:** This is a new device. **ADD** it as a new node to your map. **CRITICAL:** Use its MAC address as its \`id\`.
    d. **NO MAC ADDRESS CASE:** If the device has no MAC address, use its IP address as the unique identifier to check for an existing node and to use as the \`id\`.
4.  **MERGE CONNECTIONS:** Add any new connections (links) found in the NEW LOG DATA. Ensure link sources and targets use the correct node \`id\`s.
5.  **FINAL OUTPUT:** Return the **ENTIRE, COMBINED** network map as a single JSON object. It must include all original devices and links plus all new/updated devices and links.

**CRITICAL RULES:**
-   Your output MUST be ONLY the final JSON object. No explanations or markdown.
-   The MAC address is the primary key for identifying a device.
-   Do not create duplicate nodes for the same physical device.

--- EXISTING MAP ---
${JSON.stringify(existingGraphData, cleanD3Properties, 2)}
--- END EXISTING MAP ---

--- NEW LOG DATA ---
${fileContent.substring(0, 100000)}
--- END NEW LOG DATA ---

Now, provide the complete, merged JSON output adhering to the provided schema.
The schema for the JSON object is as follows:
${JSON.stringify(responseSchema, null, 2)}
`;
        }

        // Standard, more nuanced prompt for powerful cloud models.
        return `
You are an expert network analyst acting as a stateful engine. You have been given an EXISTING network map and a NEW log file. Your critical task is to UPDATE the existing map with information from the new log file and return a single, complete, merged network map.

**Crucial Rules for Merging & Device Identification:**
1.  **Primary Identifier is MAC Address:** The \`macAddress\` is the most reliable unique identifier for a physical device. If a device in the NEW log has the same \`macAddress\` as a device in the EXISTING MAP, you **MUST** treat them as the same device.
2.  **Use MAC for Node 'id':** When creating a node, if a MAC address is available, you **MUST** use the MAC address as the node's 'id'. If no MAC address is present for a device, you may use its IP address as a fallback 'id'.
3.  **Handle IP Addresses Carefully:** IP addresses can be duplicated. Do **NOT** assume two devices are the same solely based on their IP address if they have different MAC addresses or hostnames.
4.  **Merge, Don't Replace:** When you find a matching device (identified primarily by MAC address), update the existing node with any new information from the new log file (like a newly discovered IP address, open ports, vendor, or connections). Do **NOT** create a duplicate node.
5.  **Infer Connections Logically:** When connecting new devices, create only the most probable links. New client devices should likely connect to a central device from the new scan (like a router). **DO NOT** create a mesh network by connecting a new device to every existing device. Ensure every new device has at least one logical connection so it is not left floating.
6.  **Return a Single, Complete Map:** Your final output **MUST** be a single JSON object representing the **ENTIRE COMBINED NETWORK**. This includes all original nodes and links, plus any new, correctly deduplicated nodes and links from the new data.

--- EXISTING MAP ---
${JSON.stringify(existingGraphData, cleanD3Properties, 2)}
--- END EXISTING MAP ---

Now, analyze the following new log data based on these strict rules and provide the complete, merged JSON output.
The output must be a valid JSON object adhering to this schema:
${JSON.stringify(responseSchema, null, 2)}
--- NEW LOG DATA ---
${fileContent.substring(0, 100000)}
---
`;
    }

    // This is the prompt for the initial analysis of a file.
    return `
You are an expert network analyst. Analyze the following network scan data or log file. Your task is to identify all network devices, infer their connections, and determine their potential roles.
Based on your analysis, generate a network map.

Your output **MUST** be a valid JSON object that strictly adheres to the provided schema. The JSON object should contain two keys: 'nodes' and 'links'. Do not add any extra text, explanations, or markdown formatting around the JSON object.

The schema for the JSON object is as follows:
${JSON.stringify(responseSchema, null, 2)}

Data to analyze:
---
${fileContent.substring(0, 100000)}
---

Instructions for analysis:
1.  **Identify Nodes:** Scan the data for devices. For nmap scan results, each "Host" section represents a device.
2.  **Assign IDs:** For each node's 'id', you **MUST** use its MAC address if available. If and only if the MAC address is not available, use its IP address as the 'id'. This is a critical rule for correctly identifying unique devices.
3.  **Extract Details:** For each node, extract the following if available:
    - 'name': A descriptive hostname. If no hostname is provided, create a meaningful name based on the device's role, OS, or vendor (e.g., "Linux Server", "Apple MacBook", "Network Printer", "Home Router").
    - 'role': The device's function. Choose from: 'Router', 'Access Point', 'Switch', 'Server', 'Client', 'Smartphone', 'Tablet', 'Laptop', 'PC', 'Printer', 'Webcam', 'NAS', 'Firewall', 'ONT', 'Scanner', 'Other'.
      **Role inference hints from nmap data:**
      - If "OS Detection" or "Device Type" mentions "printer" → 'Printer'
      - If IP ends in .1 or .254 with ports 53, 80, 443 and hostname like "gpon" or "gateway" → 'Router' or 'ONT'
      - If running SSH, Samba, HTTP servers with multiple services → likely 'Server' or 'NAS'
      - If vendor is "Apple" with minimal ports → likely 'Laptop', 'PC', or 'Smartphone'
      - If "Device Type" mentions "WAP" or "access point" → 'Access Point'
      - If "Device Type" mentions "switch" → 'Switch'
      - If OS is Linux/Windows with web/app ports → likely 'Server' or 'PC'
    - 'ipAddress': The device's IP address.
    - 'macAddress': The device's MAC address.
    - 'vendor': The manufacturer of the device (from the Vendor field or inferred from MAC/OS).
    - 'openPorts': A list of open port numbers as strings (e.g., "22", "80", "443", "8080").
    - 'ping': Ping latency if recorded (e.g., "15ms"). Omit if not available.
4.  **Identify Links with High Confidence:** Scan the data for explicit evidence of connections.
5.  **Infer Logical Connections:** Create connections to form a realistic network topology.
    **Connection inference for network scans:**
    - Identify the gateway/router (usually IP ending in .1 or .254, or device with DNS/HTTP services and router-like characteristics like hostname "gpon.net")
    - Connect all other devices to this central router/gateway device
    - If multiple routers/APs exist, create a hierarchical structure
    **Crucially, DO NOT create a full mesh by connecting every device to every other device.** The goal is a plausible star or tree topology.
6.  **CRITICAL FALLBACK FOR CONNECTIVITY:** If you cannot determine explicit connections, you **MUST** connect each device to the most logical central device (e.g., the Router or ONT). **Every device must be connected to the graph.**
7.  **Format Output:** Return a single JSON object containing a 'nodes' array and a 'links' array.
`;
}

export async function analyzeNetworkLog(
    fileContent: string,
    existingGraphData: GraphData | null = null,
    config: AIConfig
): Promise<GraphData> {
    
    const prompt = buildPrompt(fileContent, existingGraphData, config);

    if (config.provider === 'local') {
        const url = config.url || 'http://localhost:1234/v1/chat/completions';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "local-model", // This is often a placeholder for LM Studio
                    messages: [
                        { "role": "system", "content": "You are an expert network analysis AI. Your output must be a single, valid JSON object matching the user's requested schema. Do not add any conversational text or markdown formatting." },
                        { "role": "user", "content": prompt }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Local LLM server returned an error: ${response.status} ${response.statusText}. \nDetails: ${errorBody}`);
            }

            const data = await response.json();
            let jsonText = data.choices[0].message.content;

            // Clean up potential markdown code blocks
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.substring(7, jsonText.length - 3).trim();
            } else if (jsonText.startsWith("```")) {
                 jsonText = jsonText.substring(3, jsonText.length - 3).trim();
            }
            
            try {
                return JSON.parse(jsonText) as GraphData;
            } catch (parseError) {
                console.warn("Could not parse JSON from local LLM, attempting to repair.", parseError);
                
                let repairedJson = jsonText.trim();
                
                // Aggressively remove trailing commas that cause parsing errors.
                repairedJson = repairedJson.replace(/,\s*([}\]])/g, '$1').replace(/,$/, '');

                // Check for and close an unclosed string at the very end.
                const quoteCount = (repairedJson.match(/(?<!\\)"/g) || []).length;
                if (quoteCount % 2 !== 0) {
                    repairedJson += '"';
                }

                const stack = [];
                let inString = false;

                for (let i = 0; i < repairedJson.length; i++) {
                    const char = repairedJson[i];
                    if (char === '"' && (i === 0 || repairedJson[i-1] !== '\\')) {
                        inString = !inString;
                    }
                    if (inString) continue;

                    if (char === '{' || char === '[') {
                        stack.push(char);
                    } else if (char === '}') {
                        if (stack.length > 0 && stack[stack.length - 1] === '{') {
                            stack.pop();
                        }
                    } else if (char === ']') {
                        if (stack.length > 0 && stack[stack.length - 1] === '[') {
                            stack.pop();
                        }
                    }
                }

                while (stack.length > 0) {
                    const openChar = stack.pop();
                    if (openChar === '{') repairedJson += '}';
                    if (openChar === '[') repairedJson += ']';
                }

                try {
                    const parsed = JSON.parse(repairedJson);
                    console.log("Successfully parsed repaired JSON.");
                    const nodes = parsed.nodes && Array.isArray(parsed.nodes) ? parsed.nodes : [];
                    const links = parsed.links && Array.isArray(parsed.links) ? parsed.links : [];
                    return { nodes, links };
                } catch (repairError) {
                    console.error("Failed to parse JSON even after repair attempt.", repairError);
                    throw new Error("The local LLM returned incomplete or malformed JSON that could not be automatically repaired. Please check your model's output or context limit settings.");
                }
            }

        } catch (error) {
            console.error("Error calling Local LLM API:", error);
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                 throw new Error("Connection to the local LLM server failed. Please ensure the server is running and CORS is configured correctly.");
            }
            throw error;
        }

    } else if (config.provider === 'openai') {
        const apiKey = config.apiKey;
        if (!apiKey) {
            throw new Error("OpenAI API key not provided. Please enter your key in the settings menu.");
        }
        const model = config.model || 'gpt-4o';
        const url = 'https://api.openai.com/v1/chat/completions';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { "role": "system", "content": "You are an expert network analysis AI. Your output must be a single, valid JSON object matching the user's requested schema. Do not add any conversational text or markdown formatting." },
                        { "role": "user", "content": prompt }
                    ],
                    temperature: 0.1,
                    response_format: { "type": "json_object" }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json();
                const errorMessage = errorBody?.error?.message || JSON.stringify(errorBody);
                throw new Error(`OpenAI API returned an error: ${response.status} ${response.statusText}. \nDetails: ${errorMessage}`);
            }

            const data = await response.json();
            const jsonText = data.choices[0].message.content;
            
            return JSON.parse(jsonText) as GraphData;

        } catch (error) {
            console.error("Error calling OpenAI API:", error);
            if (error instanceof Error && (error.message.includes('API key') || error.message.includes('authentication'))) {
                throw new Error("The provided OpenAI API key appears to be invalid or has expired.");
            }
            throw error;
        }
    } else { // 'google' provider
        const apiKey = config.apiKey;
        if (!apiKey) {
            throw new Error("Google AI API key not provided. Please enter your key in the settings menu.");
        }
        const ai = new GoogleGenAI({ apiKey });

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.1
                },
            });

            const jsonText = response.text.trim();
            const data = JSON.parse(jsonText);
            return data as GraphData;

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            throw new Error("Failed to get a valid response from the AI. This could be due to an invalid API key, network issues, or the model returning an unexpected format.");
        }
    }
}