import { FFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = new FFmpeg();

const videoInput = document.getElementById('video');
const qualityInput = document.getElementById('quality');
const compressionInput = document.getElementById('compression');
const button = document.getElementById('compress');
const progress = document.getElementById('progress');
const status = document.getElementById('status');
const result = document.getElementById('result');
const download = document.getElementById('download');
const fileInfo = document.getElementById('fileInfo');

let loaded = false;
let previousURL = null;

function showStatus(message) {
  status.textContent = message;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

ffmpeg.on('progress', ({ progress: amount }) => {
  progress.value = Math.max(0, Math.min(100, amount * 100));
});

async function loadFFmpeg() {
  if (loaded) return;

  showStatus('Loading the video compression engine…');

  const folder = new URL('./ffmpeg/', window.location.href);

  await ffmpeg.load({
    coreURL: new URL('ffmpeg-core.js', folder).href,
    wasmURL: new URL('ffmpeg-core.wasm', folder).href
  });

  loaded = true;
}

button.addEventListener('click', async () => {
  const file = videoInput.files?.[0];

  if (!file) {
    showStatus('Please select a video first.');
    return;
  }

  if (!file.type.startsWith('video/')) {
    showStatus('Please choose a valid video file.');
    return;
  }

  button.disabled = true;
  progress.value = 0;
  result.classList.add('hidden');

  let outputCreated = false;

  try {
    await loadFFmpeg();

    showStatus('Preparing your video…');

    const inputName = 'input-video';
    const outputName = 'ibbyfx-compressed.mp4';

    await ffmpeg.writeFile(
      inputName,
      new Uint8Array(await file.arrayBuffer())
    );

    const setting = qualityInput.value;
    const height = setting.startsWith('720p') ? 720 : 1080;
    const fps = setting.endsWith('120') ? 120 :
                setting.endsWith('60') ? 60 : 30;
    const crf = compressionInput.value;

    showStatus(`Compressing video at up to ${height}p and ${fps} FPS…`);

    const exitCode = await ffmpeg.exec([
      '-i', inputName,
      '-vf',
      `scale=w=-2:h=${height}:force_original_aspect_ratio=decrease,fps=${fps}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', crf,
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputName
    ]);

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}.`);
    }

    showStatus('Preparing your download…');

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data], { type: 'video/mp4' });

    if (previousURL) URL.revokeObjectURL(previousURL);
    previousURL = URL.createObjectURL(blob);

    download.href = previousURL;
    download.download = outputName;
    fileInfo.textContent =
      `Original: ${formatSize(file.size)} · Compressed: ${formatSize(blob.size)}`;

    result.classList.remove('hidden');
    progress.value = 100;
    outputCreated = true;

    showStatus('Compression complete! Your video is ready to download.');
  } catch (error) {
    console.error(error);
    showStatus(
      'Compression failed: ' +
      (error?.message || String(error)) +
      '\nCheck that the GitHub Pages build completed and the FFmpeg files loaded.'
    );
  } finally {
    button.disabled = false;
  }
});
