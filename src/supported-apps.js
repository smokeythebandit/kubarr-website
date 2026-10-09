// Catalog snapshot: kubarr-charts/{development,download-client,indexer,media-manager,
// media-server,monitoring}/*/Chart.yaml, read by Kubarr/code/api/src/services/catalog.rs.
// Include charts with kubarr.io/category and without kubarr.io/system: "true" or
// kubarr.io/hidden: "true". System observability agents/stores are infrastructure.
// Logos: matching kubarr-charts/*/*/icon.svg (Headlamp: upstream mark; Plex:
// authentic Plex mark). Depth controls relative logo size/opacity.
export const supportedApps = [
  { id: 'sonarr', depth: 1 },
  { id: 'plex', depth: 0 },
  { id: 'immich', depth: 2 },
  { id: 'radarr', depth: 0 },
  { id: 'jellyfin', depth: 1 },
  { id: 'qbittorrent', depth: 1 },
  { id: 'deluge', depth: 0 },
  { id: 'sabnzbd', depth: 2 },
  { id: 'frigate', depth: 2 },
  { id: 'headlamp', depth: 2 },
  { id: 'redmine', depth: 1 },
  { id: 'jellyseerr', depth: 2 },
  { id: 'jackett', depth: 2 },
  { id: 'transmission', depth: 2 },
  { id: 'rutorrent', depth: 2 },
  { id: 'jenkins', depth: 2 },
  { id: 'scm-manager', depth: 2 },
  { id: 'grafana', depth: 2 },
];
