/**
 * Graph Converter Service
 *
 * Converts parsed nmap data directly to GraphData without AI.
 * Uses deterministic gateway detection (IP ending in .1 or .254)
 * and connects all devices to the gateway in a star topology.
 */

import type { GraphData, NodeData, LinkData } from '../types';
import type { NmapScanResult, NmapHost } from './nmapParser';

/**
 * Known port-to-role mappings for device identification
 */
const portRoleMappings: { [port: number]: string } = {
  22: 'Server',      // SSH
  80: 'Server',      // HTTP
  443: 'Server',     // HTTPS
  21: 'Server',      // FTP
  23: 'Server',      // Telnet
  25: 'Server',      // SMTP
  53: 'Server',      // DNS
  110: 'Server',     // POP3
  143: 'Server',     // IMAP
  3306: 'Server',    // MySQL
  5432: 'Server',    // PostgreSQL
  6379: 'Server',    // Redis
  27017: 'Server',   // MongoDB
  515: 'Printer',    // LPD
  631: 'Printer',    // CUPS/IPP
  9100: 'Printer',   // JetDirect
  548: 'NAS',        // AFP
  139: 'NAS',        // SMB/NetBIOS
  445: 'NAS',        // SMB
  5000: 'NAS',       // Synology DSM
  8080: 'Server',    // HTTP Alt
  3389: 'PC',        // RDP
  5900: 'PC',        // VNC
  554: 'Webcam',     // RTSP
  8554: 'Webcam',    // RTSP Alt
};

/**
 * Vendor to role mappings for device identification
 */
const vendorRoleMappings: { [vendor: string]: string } = {
  'cisco': 'Router',
  'netgear': 'Router',
  'tp-link': 'Router',
  'asus': 'Router',
  'linksys': 'Router',
  'd-link': 'Router',
  'ubiquiti': 'Router',
  'mikrotik': 'Router',
  'juniper': 'Router',
  'aruba': 'Access Point',
  'ruckus': 'Access Point',
  'hp': 'Printer',
  'hewlett packard': 'Printer',
  'epson': 'Printer',
  'canon': 'Printer',
  'brother': 'Printer',
  'xerox': 'Printer',
  'lexmark': 'Printer',
  'apple': 'Client',
  'samsung': 'Smartphone',
  'huawei': 'Smartphone',
  'xiaomi': 'Smartphone',
  'oneplus': 'Smartphone',
  'google': 'Smartphone',
  'dell': 'PC',
  'lenovo': 'PC',
  'intel': 'PC',
  'gigabyte': 'PC',
  'msi': 'PC',
  'asrock': 'PC',
  'synology': 'NAS',
  'qnap': 'NAS',
  'western digital': 'NAS',
  'wd': 'NAS',
  'buffalo': 'NAS',
  'hikvision': 'Webcam',
  'dahua': 'Webcam',
  'axis': 'Webcam',
  'logitech': 'Webcam',
  'nest': 'Webcam',
  'ring': 'Webcam',
  'wyze': 'Webcam',
  'sonicwall': 'Firewall',
  'fortinet': 'Firewall',
  'paloalto': 'Firewall',
  'checkpoint': 'Firewall',
  'watchguard': 'Firewall',
  'pfsense': 'Firewall',
  'sophos': 'Firewall',
  'zte': 'ONT',
  'humax': 'ONT',
  'calix': 'ONT',
  'alcatel': 'ONT',
  'nokia': 'ONT',
};

/**
 * OS family to role mappings
 */
const osRoleMappings: { [os: string]: string } = {
  'linux': 'Server',
  'windows': 'PC',
  'macos': 'Laptop',
  'ios': 'Smartphone',
  'android': 'Smartphone',
  'printer': 'Printer',
  'router': 'Router',
  'switch': 'Switch',
  'firewall': 'Firewall',
};

/**
 * Generates a unique ID for a host
 * Prefers MAC address, falls back to IP-based ID
 */
function generateHostId(host: NmapHost): string {
  if (host.macAddress) {
    return host.macAddress.toUpperCase();
  }
  // Generate a pseudo-MAC from IP for consistency
  return `IP-${host.ipAddress.replace(/\./g, '-')}`;
}

/**
 * Infers the device role from host information
 */
export function inferRoleFromHost(host: NmapHost): string {
  const ipParts = host.ipAddress.split('.').map(Number);
  const lastOctet = ipParts[3];

  // Check if it's a gateway (common gateway IPs)
  if (lastOctet === 1 || lastOctet === 254) {
    return 'Router';
  }

  // Check vendor mapping
  if (host.vendor) {
    const vendorLower = host.vendor.toLowerCase();
    for (const [vendorKey, role] of Object.entries(vendorRoleMappings)) {
      if (vendorLower.includes(vendorKey)) {
        return role;
      }
    }
  }

  // Check OS match
  if (host.osMatch) {
    const osName = host.osMatch.name.toLowerCase();
    const osFamily = host.osMatch.osfamily?.toLowerCase() || '';
    const osType = host.osMatch.type?.toLowerCase() || '';

    // Check type first (most specific)
    if (osType) {
      for (const [typeKey, role] of Object.entries(osRoleMappings)) {
        if (osType.includes(typeKey)) {
          return role;
        }
      }
    }

    // Check OS family
    for (const [osKey, role] of Object.entries(osRoleMappings)) {
      if (osName.includes(osKey) || osFamily.includes(osKey)) {
        return role;
      }
    }
  }

  // Check open ports
  if (host.ports.length > 0) {
    // Count role votes from ports
    const roleVotes: { [role: string]: number } = {};

    for (const port of host.ports) {
      const role = portRoleMappings[port.port];
      if (role) {
        roleVotes[role] = (roleVotes[role] || 0) + 1;
      }
    }

    // Return the role with most votes
    let maxVotes = 0;
    let inferredRole = '';
    for (const [role, votes] of Object.entries(roleVotes)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        inferredRole = role;
      }
    }

    if (inferredRole) {
      return inferredRole;
    }
  }

  // Default fallback
  return 'Client';
}

/**
 * Generates a display name for a host
 */
function generateHostName(host: NmapHost, role: string): string {
  // Use hostname if available
  if (host.hostname) {
    return host.hostname;
  }

  // Use vendor + role
  if (host.vendor) {
    return `${host.vendor}-${role}`;
  }

  // Use role + last octet
  const lastOctet = host.ipAddress.split('.').pop();
  return `${role}-${lastOctet}`;
}

/**
 * Converts a single NmapHost to NodeData
 */
export function hostToNode(host: NmapHost): NodeData {
  const role = inferRoleFromHost(host);
  const name = generateHostName(host, role);
  const id = generateHostId(host);

  return {
    id,
    name,
    role,
    ipAddress: host.ipAddress,
    macAddress: host.macAddress,
    vendor: host.vendor,
    openPorts: host.ports.map(p => p.port.toString()),
  };
}

/**
 * Finds the gateway node from a list of nodes
 * Returns the first node with IP ending in .1 or .254
 */
export function findGateway(nodes: NodeData[]): NodeData | undefined {
  // First, try to find .1 gateway (most common)
  const gateway1 = nodes.find(node => {
    if (!node.ipAddress) return false;
    const lastOctet = parseInt(node.ipAddress.split('.').pop() || '0', 10);
    return lastOctet === 1;
  });

  if (gateway1) return gateway1;

  // Then try .254 gateway
  const gateway254 = nodes.find(node => {
    if (!node.ipAddress) return false;
    const lastOctet = parseInt(node.ipAddress.split('.').pop() || '0', 10);
    return lastOctet === 254;
  });

  if (gateway254) return gateway254;

  // Look for nodes with Router/Gateway role
  return nodes.find(node =>
    node.role === 'Router' || node.role === 'Gateway' || node.role === 'ONT'
  );
}

/**
 * Converts parsed nmap data to GraphData without AI
 * Uses star topology connecting all devices to the detected gateway
 */
export function convertNmapToGraphData(nmapResult: NmapScanResult): GraphData {
  // Convert all hosts to nodes
  const nodes: NodeData[] = nmapResult.hosts.map(host => hostToNode(host));

  // Find the gateway
  const gateway = findGateway(nodes);

  // Create links - star topology with gateway at center
  const links: LinkData[] = [];

  if (gateway) {
    // Connect all non-gateway devices to the gateway
    for (const node of nodes) {
      if (node.id !== gateway.id) {
        links.push({
          source: gateway.id,
          target: node.id,
        });
      }
    }
  }

  return { nodes, links };
}

/**
 * Merges new nmap scan data with existing graph data
 * Updates existing nodes, adds new ones, and maintains links
 */
export function mergeNmapWithGraphData(
  nmapResult: NmapScanResult,
  existingData: GraphData
): GraphData {
  // Create a map of existing nodes by IP and MAC
  const existingByIp = new Map<string, NodeData>();
  const existingByMac = new Map<string, NodeData>();

  for (const node of existingData.nodes) {
    if (node.ipAddress) {
      existingByIp.set(node.ipAddress, node);
    }
    if (node.macAddress) {
      existingByMac.set(node.macAddress.toUpperCase(), node);
    }
  }

  // Process new hosts
  const updatedNodes = new Map<string, NodeData>();
  const newNodes: NodeData[] = [];

  // Keep all existing nodes
  for (const node of existingData.nodes) {
    updatedNodes.set(node.id, { ...node });
  }

  // Process nmap hosts
  for (const host of nmapResult.hosts) {
    const newNode = hostToNode(host);

    // Check if this host already exists (by MAC or IP)
    let existingNode = host.macAddress
      ? existingByMac.get(host.macAddress.toUpperCase())
      : existingByIp.get(host.ipAddress);

    if (existingNode) {
      // Update existing node with new information
      const updated: NodeData = {
        ...existingNode,
        ipAddress: host.ipAddress,
        macAddress: host.macAddress || existingNode.macAddress,
        vendor: host.vendor || existingNode.vendor,
        openPorts: host.ports.length > 0
          ? host.ports.map(p => p.port.toString())
          : existingNode.openPorts,
      };
      updatedNodes.set(existingNode.id, updated);
    } else {
      // Add as new node
      newNodes.push(newNode);
      updatedNodes.set(newNode.id, newNode);
    }
  }

  const allNodes = Array.from(updatedNodes.values());

  // Find gateway
  const gateway = findGateway(allNodes);

  // Keep existing links
  const existingLinks = [...existingData.links];

  // Add links for new nodes
  const newLinks: LinkData[] = [];
  if (gateway) {
    for (const newNode of newNodes) {
      if (newNode.id !== gateway.id) {
        // Check if link already exists
        const linkExists = existingLinks.some(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
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
