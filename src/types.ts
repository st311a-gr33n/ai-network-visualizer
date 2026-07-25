import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

// FIX: Changed NodeData from an interface to a type to fix type resolution issues with d3.SimulationNodeDatum.
// This ensures that properties like `x`, `y`, `fx`, and `fy` are available on NodeData objects.
export type NodeData = SimulationNodeDatum & {
  id: string; // e.g. MAC Address
  name: string; // e.g. hostname
  role: string;
  ipAddress?: string;
  macAddress?: string;
  openPorts?: string[];
  ping?: string;
  vendor?: string;
  // Live Mode properties
  liveStatus?: 'online' | 'offline' | 'unknown';
  lastSeen?: string; // ISO timestamp
};

export interface LinkData extends SimulationLinkDatum<NodeData> {
  source: string | NodeData;
  target: string | NodeData;
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

export type AIConfig = {
  provider: 'deepseek' | 'local';
  url?: string; // For local provider
  apiKey?: string; // For deepseek provider
  model?: string; // For deepseek provider (defaults to "deepseek-v4-flash")
  useAI?: boolean; // When false, bypass AI and use deterministic graph conversion
};

// Live Mode types
export interface LiveScanConfig {
  target: string;        // e.g., "192.168.1.0/24"
  intervalSeconds: number;
}

export interface LiveScanResult {
  timestamp: string;
  hostsUp: string[];     // List of online IP addresses
  scanDuration: number;  // Scan duration in seconds
}