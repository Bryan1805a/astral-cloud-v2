export const FirewallProtocol = {
  TCP: "TCP",
  UDP: "UDP",
  ICMP: "ICMP",
  ALL: "ALL",
} as const;
export type FirewallProtocol = (typeof FirewallProtocol)[keyof typeof FirewallProtocol];

export const FirewallAction = {
  ALLOW: "ALLOW",
  DENY: "DENY",
} as const;
export type FirewallAction = (typeof FirewallAction)[keyof typeof FirewallAction];

export const DnsRecordType = {
  A: "A",
  AAAA: "AAAA",
  CNAME: "CNAME",
  MX: "MX",
  TXT: "TXT",
  PTR: "PTR",
} as const;
export type DnsRecordType = (typeof DnsRecordType)[keyof typeof DnsRecordType];
