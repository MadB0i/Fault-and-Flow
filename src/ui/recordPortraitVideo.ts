/** Local, silent recording of the host's canvas. The story supplies fixed labels/credits. */
const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export function canRecordPortraitVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    VIDEO_TYPES.some((type) => MediaRecorder.isTypeSupported(type))
  );
}

export async function recordPortraitVideo(
  source: HTMLCanvasElement,
  story: string,
  stamp: string,
  onReady: (finish: () => void) => void,
): Promise<Blob> {
  const mimeType = VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('Video recording unavailable');
  const template = new Image();
  template.src = story;
  await template.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Video composition unavailable');
  const input = source.captureStream(24);
  const style = getComputedStyle(document.documentElement);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = input;
  let output: MediaStream | null = null;
  let frame = 0;
  let timer = 0;
  let finish = () => {};
  const hidden = () => {
    if (document.hidden) finish();
  };
  try {
    await video.play();
    const draw = () => {
      context.setTransform(2 / 3, 0, 0, 2 / 3, 0, 0);
      context.drawImage(template, 0, 0, 1080, 1920);
      context.fillStyle = style.getPropertyValue('--bg').trim();
      context.fillRect(0, 1176, 1080, 64);
      context.fillStyle = style.getPropertyValue('--text-muted').trim();
      context.font = `${template.width / 54}px ${style.getPropertyValue('--font-ui').trim()}`;
      context.fillText(stamp, 72, 1216, 936);
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const scale = Math.max(1080 / video.videoWidth, 688 / video.videoHeight);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        context.save();
        context.beginPath();
        context.rect(0, 480, 1080, 688);
        context.clip();
        context.drawImage(
          video,
          (1080 - width) / 2,
          480 + (688 - height) / 2,
          width,
          height,
        );
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    output = canvas.captureStream(24);
    const recorder = new MediaRecorder(output, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });
    const chunks: Blob[] = [];
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('Recording failed'));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size) resolve(blob);
        else reject(new Error('Empty recording'));
      };
    });
    finish = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };
    recorder.start(500);
    onReady(finish);
    document.addEventListener('visibilitychange', hidden);
    timer = window.setTimeout(finish, 8000);
    return await done;
  } finally {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', hidden);
    input.getTracks().forEach((track) => track.stop());
    output?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }
}
