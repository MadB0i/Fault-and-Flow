import type { Mode } from '../shared/types.js';
import type { AtlasCopy } from '../shared/i18n/atlas.js';

/** Local download only. Include the notice and mandatory adapted-DEM credit. */
export async function saveAtlasImage(
  png: string,
  mode: Mode,
  copy: AtlasCopy,
  context: { attribution: string; note: string },
) {
  const img = new Image();
  img.src = png;
  await img.decode();
  const style = getComputedStyle(document.documentElement);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(img.width, 1000);
  canvas.height = Math.round((img.height * canvas.width) / img.width) + 230;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = style.getPropertyValue('--bg').trim();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mapHeight = canvas.height - 230;
  ctx.drawImage(img, 0, 0, canvas.width, mapHeight);
  ctx.fillStyle = style.getPropertyValue('--text').trim();
  ctx.font = `${style.getPropertyValue('--step-0').trim()} ${style.getPropertyValue('--font-ui').trim()}`;
  const lines = [
    `Fault & Flow · ${copy[mode]}`,
    copy.disclaimer,
    mode === 'fault'
      ? `${copy.noPrediction} ${copy.quakeNote} ${copy.motionNote}`
      : mode === 'plates'
        ? copy.platesNote
        : copy.scenarioNote,
    context.note,
    context.attribution,
    `${copy.riverCredit} ${copy.usgsCredit}`,
    mode === 'fault' ? copy.catalogueNote : copy.riverNote,
  ];
  lines.forEach((line, i) =>
    ctx.fillText(line, 24, mapHeight + 30 + i * 28, canvas.width - 48),
  );
  const link = document.createElement('a');
  link.download = `fault-and-flow-${mode}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
