/**
 * Live Scan Service
 *
 * Handles parsing live scan results and updating graph data
 * with online/offline status indicators.
 */

import type { GraphData, NodeData, LiveScanResult } from '../types';
import { parseNmapXml, NmapScanResult } from './nmapParser';
import { hostToNode, findGateway } from './graphConverter';

/**
 * Parses the XML output from a live nmap scan and extracts online host IPs
 */
export function parseLiveScanResult(xmlOutput: string): LiveScanResult {
  try {
    const nmapResult = parseNmapXml(xmlOutput);

    // Extract IP addresses of hosts that are up
    const hostsUp = nmapResult.hosts
      .filter(host => host.status === 'up')
      .map(host => host.ipAddress);

    return {
      timestamp: new Date().toISOString(),
      hostsUp,
      scanDuration: parseFloat(nmapResult.summary.elapsed) || 0,
    };
  } catch (error) {
    console.error('Failed to parse live scan XML:', error);
    return {
      timestamp: new Date().toISOString(),
      hostsUp: [],
      scanDuration: 0,
    };
  }
}

/**
 * Extracts full host data from nmap XML for adding new devices
 */
export function extractHostsFromXml(xmlOutput: string): NmapScanResult | null {
  try {
    return parseNmapXml(xmlOutput);
  } catch (error) {
    console.error('Failed to parse nmap XML:', error);
    return null;
  }
}

/**
 * Updates the graph data with live scan results
 *
 * - Marks existing nodes as online/offline based on IP match
 * - Adds new devices discovered (connects them to gateway)
 * - Never removes devices - just marks as offline
 * - Updates lastSeen timestamp for online devices
 */
export function updateGraphWithLiveData(
  existingGraph: GraphData,
  liveScanResult: LiveScanResult,
  nmapResult: NmapScanResult | null
): GraphData {
  const timestamp = liveScanResult.timestamp;
  const onlineIps = new Set(liveScanResult.hostsUp);

  // Create a map of existing nodes by IP for quick lookup
  const existingByIp = new Map<string, NodeData>();
  for (const node of existingGraph.nodes) {
    if (node.ipAddress) {
      existingByIp.set(node.ipAddress, node);
    }
  }

  // Update existing nodes with live status
  const updatedNodes: NodeData[] = existingGraph.nodes.map(node => {
    if (node.ipAddress) {
      const isOnline = onlineIps.has(node.ipAddress);
      return {
        ...node,
        liveStatus: isOnline ? 'online' : 'offline',
        lastSeen: isOnline ? timestamp : node.lastSeen,
      } as NodeData;
    }
    // Nodes without IP keep their current status or become unknown
    return {
      ...node,
      liveStatus: node.liveStatus || 'unknown',
    } as NodeData;
  });

  // Track new nodes to add
  const newNodes: NodeData[] = [];
  const existingIds = new Set(updatedNodes.map(n => n.id));

  // Check for new devices from the nmap scan
  if (nmapResult) {
    for (const host of nmapResult.hosts) {
      // Check if this host already exists
      const existingNode = existingByIp.get(host.ipAddress);

      if (!existingNode) {
        // This is a new device - add it
        const newNode = hostToNode(host);

        // Ensure unique ID
        if (!existingIds.has(newNode.id)) {
          newNode.liveStatus = 'online';
          newNode.lastSeen = timestamp;
          newNodes.push(newNode);
          existingIds.add(newNode.id);
        }
      }
    }
  }

  // Combine existing and new nodes
  const allNodes = [...updatedNodes, ...newNodes];

  // Find gateway for connecting new devices
  const gateway = findGateway(allNodes);

  // Keep existing links
  const existingLinks = [...existingGraph.links];

  // Add links for new nodes (connect to gateway)
  const newLinks = [];
  if (gateway && newNodes.length > 0) {
    for (const newNode of newNodes) {
      if (newNode.id !== gateway.id) {
        // Check if link already exists
        const linkExists = existingLinks.some(link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeData).id;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeData).id;
          return (sourceId === gateway.id && targetId === newNode.id) ||
                 (sourceId === newNode.id && targetId === gateway.id);
        });

        if (!linkExists) {
          newLinks.push({
            source: gateway.id,
            target: newNode.id,
          });
        }
      }
    }
  }

  return {
    nodes: allNodes,
    links: [...existingLinks, ...newLinks],
  };
}

/**
 * Resets all live status fields on nodes
 * Called when stopping live mode or before downloading JSON
 */
export function resetLiveStatus(graph: GraphData): GraphData {
  return {
    nodes: graph.nodes.map(node => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { liveStatus, lastSeen, ...rest } = node;
      return rest as NodeData;
    }),
    links: graph.links,
  };
}

/**
 * Validates a target IP range or address
 * Returns true if the format appears valid
 */
export function validateTarget(target: string): boolean {
  // Match IP address (with optional CIDR notation)
  const ipCidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

  // Match IP range (e.g., 192.168.1.1-100)
  const ipRangePattern = /^(\d{1,3}\.){3}\d{1,3}-\d{1,3}$/;

  // Match hostname pattern
  const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

  return ipCidrPattern.test(target) || ipRangePattern.test(target) || hostnamePattern.test(target);
}

/**
 * Extracts a default scan target from existing graph data
 * Attempts to determine the network based on existing IP addresses
 */
export function inferNetworkTarget(graph: GraphData): string {
  // Find an IP address from the graph
  for (const node of graph.nodes) {
    if (node.ipAddress) {
      const parts = node.ipAddress.split('.');
      if (parts.length === 4) {
        // Return the /24 network for this IP
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      }
    }
  }

  // Default fallback
  return '192.168.1.0/24';
}
