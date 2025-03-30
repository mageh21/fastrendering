import fs from 'fs'
import path from 'path'
import { PassThrough } from 'stream'
import os from 'os'
import { parseMidi, parserInferHands } from '@/features/parsers'
import { render } from '@/features/SongVisualization/canvasRenderer'
import { getImages, waitForImages } from '@/features/SongVisualization/images'
import { PIXELS_PER_SECOND as pps } from '@/features/SongVisualization/utils'
import type { Song } from '@/types'
import ffmpeg from 'fluent-ffmpeg'
import { Canvas } from 'skia-canvas'

// Define interfaces for better type safety
interface ProgressDetails {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  percent?: number;
}

interface State {
  time: number;
  drawNotes: boolean;
  visualization: string;
  windowWidth: number;
  width: number;
  height: number;
  pps: number;
  hand: string;
  hands: Record<string, { hand: string }>;
  items: any[];
  constrictView: boolean;
  keySignature: string;
  timeSignature: { numerator: number, denominator: number };
  images: any;
  ctx: any;
  canvasRect: { left: number, top: number };
}

ffmpeg.setFfmpegPath("C:\\ffmpeg\\ffmpeg\\bin\\ffmpeg.exe") // Set the path to your ffmpeg executable

const inputDir = 'C:\\input'
const outputDir = 'C:/recordings'
const cpus = os.cpus().length // Use all available CPU cores
const fps = 30 // Still using 30fps for good balance
const viewport = { width: 1280, height: 720 } // Back to 720p for better quality
const density = 1
const maxSeconds = Infinity

/**
 * Ensures that necessary directories exist
 */
function ensureDirectoriesExist(): void {
  if (!fs.existsSync(inputDir)) {
    log(`Creating input directory: ${inputDir}`)
    fs.mkdirSync(inputDir, { recursive: true })
  }
  
  if (!fs.existsSync(outputDir)) {
    log(`Creating output directory: ${outputDir}`)
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Check FFmpeg is installed
  try {
    // ffmpeg.path doesn't exist, use the path we set instead
    const ffmpegPath = "C:\\ffmpeg\\ffmpeg\\bin\\ffmpeg.exe";
    if (!fs.existsSync(ffmpegPath)) {
      log(`Warning: FFmpeg executable not found at ${ffmpegPath}`)
      log('Please install FFmpeg or update the path in this script')
    }
  } catch (err: unknown) {
    log(`Error checking FFmpeg: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Parse the MIDI file at the given path into a {@link Song}.
 */
async function parse(path: string): Promise<Song> {
  var buf = new Uint8Array(fs.readFileSync(path)).buffer
  return parseMidi(buf)
}

/**
 * We need both a midi and an mp3 to render videos.
 * Verifies that all expected files are present.
 */
function verifyFiles(files: string[]) {
  const extensions = [`mp3`, `mid`]
  for (const file of files) {
    for (const extension of extensions) {
      const requirement = `${inputDir}/${file}/${file}.${extension}`
      if (!fs.existsSync(requirement)) {
        console.error(`Missing required file: ${requirement}`)
        process.exit(1)
      }
    }
    if (!fs.existsSync(`${outputDir}/${file}`)) {
      fs.mkdirSync(`${outputDir}/${file}`)
    }
  }
}

async function main() {
  // Check that all directories exist
  ensureDirectoriesExist();
  
  // Automatically grab all sub-directory names in your input folder
  // that contain both a MIDI and an MP3 file.
  const files: string[] = fs
    .readdirSync(inputDir)
    .filter((file) => {
      // Ensure it's a directory
      const fullPath = path.join(inputDir, file)
      const isDirectory = fs.lstatSync(fullPath).isDirectory()
      if (!isDirectory) return false

      // Check if both expected files exist.
      const midPath = `${inputDir}/${file}/${file}.mid`
      const mp3Path = `${inputDir}/${file}/${file}.mp3`
      return fs.existsSync(midPath) && fs.existsSync(mp3Path)
    })

  await step('file verification', () => {
    verifyFiles(files)
  })

  await step('render videos', async () => {
    for (const file of files) {
      // Skip if the video file already exists
      if (fs.existsSync(`${outputDir}/${file}/${file}.mp4`)) {
        log(`Skipping ${file}`)
        continue
      }

      await step(`render of ${file}`, () => renderVideo(file))
    }
  })
}

async function renderVideo(file: string): Promise<void> {
  const song: Song = await parse(`${inputDir}/${file}/${file}.mid`)
  const hands = parserInferHands(song)

  const images = await getImages()
  await waitForImages()

  const { items, duration } = song
  const end = Math.min(duration, maxSeconds)
  const deferred = new Deferred<void>()

  const passthrough = new PassThrough({
    highWaterMark: 1024 * 1024 * 20 // 20MB buffer for better performance
  })
  ffmpeg(passthrough)
    .inputFormat('image2pipe')
    .inputFPS(fps)
    .input(`${inputDir}/${file}/${file}.mp3`)
    .outputOptions([
      `-threads ${cpus}`,
      '-c:v libx264',
      '-preset veryfast',
      '-tune fastdecode',
      '-pix_fmt yuv420p',
      '-crf 28',
      '-vsync cfr',
      '-r ' + fps,
      '-async 1'
    ])
    .on('progress', (progressDetails: ProgressDetails) =>
      throttledLog(`FFMPEG Timemark: ${progressDetails.timemark}`)
    )
    .on('end', function () {
      deferred.resolve()
    })
    .on('error', function (err: Error) {
      deferred.reject(err)
      log('an error: ' + err.message + `\n happened while processing file: ${file}`)
    })
    .save(`${outputDir}/${file}/${file}.mp4`)

  await waitForImages()

  // Initialize the rendering state.
  const state: any = {
    time: 0,
    drawNotes: true,
    visualization: 'falling-notes',
    windowWidth: viewport.width,
    width: viewport.width,
    height: viewport.height,
    pps,
    hand: 'both',
    hands: { [hands.right]: { hand: 'right' }, [hands.left]: { hand: 'left' } },
    items: items,
    constrictView: true,
    keySignature: 'C',
    timeSignature: { numerator: 4, denominator: 4 },
    images: images,
    ctx: null,
    canvasRect: { left: 0, top: 0 },
  }

  // Render the falling notes animation immediately without any delay.
  let frameCount = 0;
  try {
    while (state.time < end + 1 / fps) {
      frameCount++;
      // Always render frames - no skipping to ensure correct video duration
      const shouldRender = true;
      
      if (shouldRender) {
        const canvas = new Canvas(viewport.width, viewport.height)
        state.ctx = canvas.getContext('2d')
        render(state)
        
        try {
          // Slightly better quality
          const jpg = await canvas.toBuffer('jpg', { quality: 0.8, density })
          passthrough.write(jpg)
        } catch (err: unknown) {
          log(`Error rendering frame at time ${state.time}: ${err instanceof Error ? err.message : String(err)}`)
          // Continue with next frame if one fails
        }
      }
      
      state.time += 1 / fps
      throttledLog(`Frame generation: ${Math.floor((100 * state.time) / end)}%`)
    }
  } catch (err: unknown) {
    log(`Fatal error in render loop: ${err instanceof Error ? err.message : String(err)}`)
    if (err instanceof Error) {
      deferred.reject(err);
    } else {
      deferred.reject(new Error(String(err)));
    }
  } finally {
    passthrough.end()
  }

  await deferred.promise
}

let stepDepth = 0

/**
 * Perform an arbitrary function and log the amount of time taken.
 */
async function step(name: string, fn: () => void) {
  log(`Beginning ${cyan(name)}`)
  const start = Date.now()
  stepDepth++
  await fn()
  stepDepth--
  log(`Completed ${cyan(name)} in ${Date.now() - start}ms`)
}

// Rate limit a function
function throttle(fn: Function, ms: number = 10000): (...args: any[]) => void {
  var lastFire = 0
  return (...args: any[]) => {
    if (Date.now() - lastFire >= ms) {
      fn(...args)
      lastFire = Date.now()
    }
  }
}

function log(s: string) {
  function pad(n: number): string {
    if (n < 10) {
      return '0' + n
    }
    return n.toString()
  }
  function formatTime(d: Date) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const indentation = '  '.repeat(stepDepth)
  const time = green(`[${formatTime(new Date())}]`)
  console.log(`${time} ${indentation}${s}`)
}
function cyan(s: string) {
  return `\x1b[36m${s}\x1b[0m`
}
function green(s: string) {
  return `\x1b[32m${s}\x1b[0m`
}

const throttledLog = throttle((s: string) => log(s))

class Deferred<T> {
  // @ts-ignore
  resolve: (v?: T) => void
  // @ts-ignore
  reject: (err: Error) => void
  promise: Promise<T>

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve as any
      this.reject = reject as any
    })
  }
}

main()
