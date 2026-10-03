/** Source-linked historical reading, deliberately independent of scenario parameters. */
export const FLOOD_HISTORY = [
  {
    year: 2007,
    title: 'flood2007',
    body: 'flood2007Body',
    url: 'https://science.nasa.gov/earth/earth-observatory/flooding-in-india-and-bangladesh-19049/',
  },
  {
    year: 2008,
    title: 'flood2008',
    body: 'flood2008Body',
    url: 'https://science.nasa.gov/earth/earth-observatory/the-brahmaputra-river-floods-northeast-india-20484/',
  },
  {
    year: 2020,
    title: 'flood2020',
    body: 'flood2020Body',
    url: 'https://science.nasa.gov/earth/earth-observatory/excessive-monsoon-rains-flood-asia-147006/',
  },
] as const;
export const GEOLOGY_SOURCE =
  'https://www.usgs.gov/publications/seismicity-earth-1900-2010-himalaya-and-vicinity';
/** Dated context only; no local hazard layer is redistributed. */
export const ASSAM_PLAN_SOURCE =
  'https://asdma.assam.gov.in/sites/default/files/swf_utility_folder/departments/asdma_revenue_uneecopscloud_com_oid_70/this_comm/asdmp_vol-_i.pdf';
