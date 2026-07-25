/**
 * Nmap XML Parser Service
 *
 * Parses nmap XML output files and extracts structured device information
 * for use with the AI-powered network analysis.
 */

export interface NmapPort {
  port: number;
  protocol: string;
  state: string;
  service?: {
    name: string;
    product?: string;
    version?: string;
    extrainfo?: string;
  };
}

export interface NmapOsMatch {
  name: string;
  accuracy: number;
  type?: string;
  vendor?: string;
  osfamily?: string;
}

export interface NmapHost {
  ipAddress: string;
  macAddress?: string;
  vendor?: string;
  hostname?: string;
  status: 'up' | 'down';
  ports: NmapPort[];
  osMatch?: NmapOsMatch;
  uptime?: {
    seconds: number;
    lastBoot: string;
  };
}

export interface NmapScanResult {
  scanInfo: {
    scanner: string;
    args: string;
    startTime: string;
    version: string;
  };
  hosts: NmapHost[];
  summary: {
    hostsUp: number;
    hostsDown: number;
    hostsTotal: number;
    elapsed: string;
  };
}

/**
 * Parses nmap XML content and extracts structured host information
 */
export function parseNmapXml(xmlContent: string): NmapScanResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML format. Please ensure the file is a valid nmap XML output.');
  }

  const nmaprun = doc.querySelector('nmaprun');
  if (!nmaprun) {
    throw new Error('Invalid nmap XML format. Missing <nmaprun> root element.');
  }

  // Extract scan info
  const scanInfo = {
    scanner: nmaprun.getAttribute('scanner') || 'nmap',
    args: nmaprun.getAttribute('args') || '',
    startTime: nmaprun.getAttribute('startstr') || '',
    version: nmaprun.getAttribute('version') || ''
  };

  // Extract hosts
  const hostElements = doc.querySelectorAll('host');
  const hosts: NmapHost[] = [];

  hostElements.forEach((hostEl) => {
    const host = parseHostElement(hostEl);
    if (host) {
      hosts.push(host);
    }
  });

  // Extract summary from runstats
  const runstats = doc.querySelector('runstats');
  const hostsEl = runstats?.querySelector('hosts');
  const finishedEl = runstats?.querySelector('finished');

  const summary = {
    hostsUp: parseInt(hostsEl?.getAttribute('up') || '0', 10),
    hostsDown: parseInt(hostsEl?.getAttribute('down') || '0', 10),
    hostsTotal: parseInt(hostsEl?.getAttribute('total') || '0', 10),
    elapsed: finishedEl?.getAttribute('elapsed') || ''
  };

  return { scanInfo, hosts, summary };
}

/**
 * Parses a single <host> element
 */
function parseHostElement(hostEl: Element): NmapHost | null {
  // Check host status
  const statusEl = hostEl.querySelector('status');
  const state = statusEl?.getAttribute('state');

  if (state !== 'up') {
    return null; // Skip hosts that are down
  }

  // Extract addresses
  const addressEls = hostEl.querySelectorAll('address');
  let ipAddress = '';
  let macAddress: string | undefined;
  let vendor: string | undefined;

  addressEls.forEach((addrEl) => {
    const addrType = addrEl.getAttribute('addrtype');
    const addr = addrEl.getAttribute('addr');

    if (addrType === 'ipv4' || addrType === 'ipv6') {
      ipAddress = addr || '';
    } else if (addrType === 'mac') {
      macAddress = addr || undefined;
      vendor = addrEl.getAttribute('vendor') || undefined;
    }
  });

  if (!ipAddress) {
    return null; // Skip hosts without IP address
  }

  // Extract hostname
  const hostnameEl = hostEl.querySelector('hostnames > hostname');
  let hostname = hostnameEl?.getAttribute('name') || undefined;

  // Don't use IP as hostname (nmap sometimes sets hostname to IP)
  if (hostname === ipAddress) {
    hostname = undefined;
  }

  // Extract ports
  const ports: NmapPort[] = [];
  const portEls = hostEl.querySelectorAll('ports > port');

  portEls.forEach((portEl) => {
    const port = parsePortElement(portEl);
    if (port && port.state === 'open') {
      ports.push(port);
    }
  });

  // Extract OS match (get the best one)
  const osMatchEl = hostEl.querySelector('os > osmatch');
  let osMatch: NmapOsMatch | undefined;

  if (osMatchEl) {
    const osclassEl = osMatchEl.querySelector('osclass');
    osMatch = {
      name: osMatchEl.getAttribute('name') || '',
      accuracy: parseInt(osMatchEl.getAttribute('accuracy') || '0', 10),
      type: osclassEl?.getAttribute('type') || undefined,
      vendor: osclassEl?.getAttribute('vendor') || undefined,
      osfamily: osclassEl?.getAttribute('osfamily') || undefined
    };
  }

  // Extract uptime
  const uptimeEl = hostEl.querySelector('uptime');
  let uptime: { seconds: number; lastBoot: string } | undefined;

  if (uptimeEl) {
    uptime = {
      seconds: parseInt(uptimeEl.getAttribute('seconds') || '0', 10),
      lastBoot: uptimeEl.getAttribute('lastboot') || ''
    };
  }

  return {
    ipAddress,
    macAddress,
    vendor,
    hostname,
    status: 'up',
    ports,
    osMatch,
    uptime
  };
}

/**
 * Parses a single <port> element
 */
function parsePortElement(portEl: Element): NmapPort | null {
  const portId = portEl.getAttribute('portid');
  const protocol = portEl.getAttribute('protocol');
  const stateEl = portEl.querySelector('state');
  const state = stateEl?.getAttribute('state');

  if (!portId || !protocol || !state) {
    return null;
  }

  const serviceEl = portEl.querySelector('service');
  let service: NmapPort['service'] | undefined;

  if (serviceEl) {
    const name = serviceEl.getAttribute('name');
    if (name) {
      service = {
        name,
        product: serviceEl.getAttribute('product') || undefined,
        version: serviceEl.getAttribute('version') || undefined,
        extrainfo: serviceEl.getAttribute('extrainfo') || undefined
      };
    }
  }

  return {
    port: parseInt(portId, 10),
    protocol,
    state,
    service
  };
}

/**
 * Converts parsed nmap data to a structured text format for AI analysis.
 * This format is compact but preserves all important information.
 */
export function nmapToStructuredText(result: NmapScanResult): string {
  const lines: string[] = [];

  lines.push('=== NMAP SCAN RESULTS ===');
  lines.push(`Scan Command: ${result.scanInfo.args}`);
  lines.push(`Scan Time: ${result.scanInfo.startTime}`);
  lines.push(`Hosts Discovered: ${result.summary.hostsUp} up, ${result.summary.hostsDown} down`);
  lines.push('');
  lines.push('=== DISCOVERED HOSTS ===');
  lines.push('');

  result.hosts.forEach((host, index) => {
    lines.push(`--- Host ${index + 1} ---`);
    lines.push(`IP Address: ${host.ipAddress}`);

    if (host.macAddress) {
      lines.push(`MAC Address: ${host.macAddress}`);
    }
    if (host.vendor) {
      lines.push(`Vendor: ${host.vendor}`);
    }
    if (host.hostname) {
      lines.push(`Hostname: ${host.hostname}`);
    }

    // OS Detection
    if (host.osMatch) {
      lines.push(`OS Detection: ${host.osMatch.name} (${host.osMatch.accuracy}% confidence)`);
      if (host.osMatch.type) {
        lines.push(`Device Type: ${host.osMatch.type}`);
      }
      if (host.osMatch.vendor) {
        lines.push(`OS Vendor: ${host.osMatch.vendor}`);
      }
    }

    // Open Ports with Services
    if (host.ports.length > 0) {
      lines.push(`Open Ports:`);
      host.ports.forEach((port) => {
        let portLine = `  - ${port.port}/${port.protocol}`;
        if (port.service) {
          portLine += ` (${port.service.name}`;
          if (port.service.product) {
            portLine += ` - ${port.service.product}`;
            if (port.service.version) {
              portLine += ` ${port.service.version}`;
            }
          }
          portLine += ')';
        }
        lines.push(portLine);
      });
    } else {
      lines.push('Open Ports: None detected');
    }

    // Uptime
    if (host.uptime) {
      const days = Math.floor(host.uptime.seconds / 86400);
      lines.push(`Uptime: ${days} days (since ${host.uptime.lastBoot})`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Checks if a file content appears to be nmap XML format
 */
export function isNmapXml(content: string): boolean {
  return content.includes('<nmaprun') && content.includes('scanner="nmap"');
}
