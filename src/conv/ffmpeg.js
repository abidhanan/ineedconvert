import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { extOf, baseOf } from '../formats.js';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

let loading = null;
let queue = Promise.resolve();
let onProgress = null;

function getFFmpeg() {
  if (!loading) {
    loading = (async () => {
      const ff = new FFmpeg();
      ff.on('progress', ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress))));
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ff;
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

// Start downloading the engine early so the first media conversion feels instant.
export const preload = () => getFFmpeg().catch(() => {});

const MIME = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  gif: 'image/gif', tiff: 'image/tiff', png: 'image/png',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg',
};

const AUDIO = {
  mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
  wav: ['-c:a', 'pcm_s16le'],
  m4a: ['-c:a', 'aac', '-b:a', '192k'],
  aac: ['-c:a', 'aac', '-b:a', '192k', '-f', 'adts'],
  ogg: ['-c:a', 'libvorbis', '-q:a', '5'],
  flac: ['-c:a', 'flac'],
  opus: ['-c:a', 'libopus', '-b:a', '128k'],
};

const H264 = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];

const VIDEO = {
  mp4: [...H264, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'],
  mov: [...H264, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'],
  mkv: [...H264, '-c:a', 'aac', '-b:a', '128k'],
  avi: [...H264, '-c:a', 'libmp3lame', '-b:a', '192k'],
  webm: ['-c:v', 'libvpx', '-pix_fmt', 'yuv420p', '-auto-alt-ref', '0', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2M', '-c:a', 'libopus', '-b:a', '128k'],
  gif: ['-vf', "fps=12,scale='min(480,iw)':-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", '-loop', '0'],
};

// Containers that can usually take the source streams as-is (no re-encode = near instant).
const REMUX_FROM = ['mp4', 'mov', 'mkv', 'm4v', 'ts', 'mts', 'm2ts', '3gp', 'flv'];
const REMUX_TO = ['mp4', 'mov', 'mkv'];

function plans(srcExt, target) {
  if (AUDIO[target]) {
    const p = [];
    if ((target === 'm4a' || target === 'aac') && ['mp4', 'm4a', 'mov', 'aac', 'm4v'].includes(srcExt)) {
      p.push(['-vn', '-c:a', 'copy', ...(target === 'aac' ? ['-f', 'adts'] : [])]);
    }
    if (target === 'mp3' && srcExt === 'mp3') p.push(['-vn', '-c:a', 'copy']);
    p.push(['-vn', ...AUDIO[target]]);
    return p;
  }
  const p = [];
  if (REMUX_TO.includes(target) && REMUX_FROM.includes(srcExt)) {
    p.push(['-c', 'copy', '-map', '0', '-dn', ...(target !== 'mkv' ? ['-movflags', '+faststart'] : [])]);
  }
  if (VIDEO[target]) p.push(VIDEO[target]);
  if (!VIDEO[target] || target === 'gif') p.push([]); // still images (tiff, gif from png): ffmpeg defaults
  return p;
}

let seq = 0;

export function convertMedia(file, target, progress) {
  const job = queue.then(() => run(file, target, progress));
  queue = job.catch(() => {});
  return job;
}

async function run(file, target, progress) {
  const ff = await getFFmpeg();
  const srcExt = extOf(file.name) || 'bin';
  const id = ++seq;
  const dir = `/in${id}`;
  let input;
  try {
    await ff.createDir(dir);
    await ff.mount('WORKERFS', { files: [file] }, dir);
    input = `${dir}/${file.name}`;
  } catch {
    input = `in${id}.${srcExt}`;
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
  }
  const out = `out${id}.${target}`;
  onProgress = progress;
  let broken = false;
  try {
    for (const args of plans(srcExt, target)) {
      let code;
      try {
        code = await ff.exec(['-hide_banner', '-y', '-i', input, ...args, out]);
      } catch (e) {
        // The wasm engine crashed (usually out of memory on a big file). It cannot be reused.
        broken = true;
        throw new Error('err.media', { cause: e });
      }
      if (code === 0) {
        const data = await ff.readFile(out);
        if (data.length > 0) {
          return [{ name: `${baseOf(file.name)}.${target}`, blob: new Blob([data.buffer], { type: MIME[target] || 'application/octet-stream' }) }];
        }
      }
      await ff.deleteFile(out).catch(() => {});
    }
    throw new Error('err.media');
  } finally {
    onProgress = null;
    if (broken) {
      // Drop the crashed engine so the next file starts a fresh one instead of failing too.
      loading = null;
      try { ff.terminate(); } catch { /* already gone */ }
    } else {
      await ff.deleteFile(out).catch(() => {});
      if (input.startsWith(dir)) {
        await ff.unmount(dir).catch(() => {});
        await ff.deleteDir(dir).catch(() => {});
      } else {
        await ff.deleteFile(input).catch(() => {});
      }
    }
  }
}
