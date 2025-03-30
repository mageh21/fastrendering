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

try {
  const jpg = await canvas.toBuffer('jpg', { density })
  passthrough.write(jpg)
} catch (err: unknown) {
  log(`Error rendering frame at time ${state.time}: ${err instanceof Error ? err.message : String(err)}`)
  // Continue with next frame if one fails
}

try {
  // ... existing code ...
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