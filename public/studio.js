import { createFFmpeg, fetchFile } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js';

const ffmpeg = createFFmpeg({ log: true });
const $ = (s) => document.querySelector(s);
const uploader = $('#uploader');
const video = $('#preview');
const overlayPreview = $('#overlayPreview');
const overlayInput = $('#overlay');
const startInput = $('#start');
const endInput = $('#end');
const suggestions = $('#suggestions');

uploader.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  video.src = url;
  await video.play().catch(() => {});
  video.pause();
  video.currentTime = 0;
  endInput.value = video.duration.toFixed(1);
  analyzeAudio(file);
});

overlayInput.addEventListener('input', () => {
  overlayPreview.textContent = overlayInput.value;
});

async function ensureFFmpeg() {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }
}

$('#download').addEventListener('click', async () => {
  const file = uploader.files[0];
  if (!file) return alert('Upload a video');
  await ensureFFmpeg();
  const data = await fetchFile(file);
  ffmpeg.FS('writeFile', 'input.mp4', data);
  const start = parseFloat(startInput.value) || 0;
  const end = parseFloat(endInput.value) || 0;
  const overlay = overlayInput.value.replace(/:/g, '\\:');
  const filter = `crop=in_h*9/16:in_h:(in_w-in_h*9/16)/2:0,drawtext=text='${overlay}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-80`;
  await ffmpeg.run('-ss', String(start), '-to', String(end), '-i', 'input.mp4', '-vf', filter, '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '128k', 'out.mp4');
  const out = ffmpeg.FS('readFile', 'out.mp4');
  const url = URL.createObjectURL(new Blob([out.buffer], { type: 'video/mp4' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'output.mp4';
  a.click();
});

$('#exportSrt').addEventListener('click', () => {
  const text = overlayInput.value.trim();
  const dur = (parseFloat(endInput.value) - parseFloat(startInput.value)).toFixed(3);
  const srt = `1\n00:00:00,000 --> 00:00:${String(dur).padStart(6,'0')}\n${text}\n`;
  const blob = new Blob([srt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'captions.srt';
  a.click();
});

$('#presets').addEventListener('click', (e) => {
  const p = e.target.dataset.preset;
  if (!p) return;
  if (p === 'viral') {
    startInput.value = '0';
    endInput.value = Math.min(1.6, video.duration).toFixed(1);
  } else if (p === 'story') {
    startInput.value = '0';
    endInput.value = Math.min(30, video.duration).toFixed(1);
  } else if (p === 'before') {
    startInput.value = '0';
    endInput.value = video.duration.toFixed(1);
  }
});

async function analyzeAudio(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await file.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf);
  const data = audio.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length);
  const pace = data.length / audio.sampleRate / 60; // minutes
  suggestions.innerHTML = '';
  const opts = rms > 0.03 ? ['🔥 High energy', 'Big vibes', 'Epic moment'] : ['Chill story', 'Soft vibes', 'Calm talk'];
  opts.slice(0,3).forEach(t => {
    const b = document.createElement('button');
    b.textContent = t;
    b.addEventListener('click', () => { overlayInput.value = t; overlayPreview.textContent = t; });
    suggestions.appendChild(b);
  });
}
