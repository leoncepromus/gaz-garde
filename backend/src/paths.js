/**
 * Firebase paths — v2.1 contract (NodeMCU firmware)
 *
 * WRITE  gas/sensor  ← device sends { ppm, status, threshold, lastUpdated }
 * READ   gas/relay   ← app/backend sends { state: "on"|"off" } for lamp only
 */
module.exports = {
  sensor: 'gas/sensor',
  relay: 'gas/relay',
  history: 'gas/history',
  incidents: 'incidents',
};
