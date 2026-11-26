package expo.modules.resttimerlive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.util.Log

/** Plays the end-of-rest countdown beep, fired by the exact alarm set in [RestTimerLive]. */
class RestTimerSoundReceiver : BroadcastReceiver() {
  companion object {
    private val mainHandler = Handler(Looper.getMainLooper())

    // The beep being played (main thread only): the rest end it counts down to, and how to stop it.
    private var playingEndAtMs = 0L
    private var stopPlaying: (() -> Unit)? = null

    /**
     * Stops the beep being played when it no longer matches the rest: the rest end moved
     * (+15 / −15 pressed while the countdown is heard) or the rest was cut short (skip). A beep
     * that is just finishing at the end of the rest is left alone.
     */
    fun stopIfStale(endAtMs: Long?) {
      mainHandler.post {
        val stop = stopPlaying ?: return@post
        val stale = if (endAtMs != null) {
          endAtMs != playingEndAtMs
        } else {
          System.currentTimeMillis() < playingEndAtMs - 500
        }
        if (stale) stop()
      }
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val volume = intent.getFloatExtra(RestTimerLive.EXTRA_VOLUME, 1f).coerceIn(0f, 1f)
    val endAtMs = intent.getLongExtra(RestTimerLive.EXTRA_END_AT_MS, 0L)
    val audio = context.getSystemService(AudioManager::class.java)

    // Media stream, like the in-app sound: heard in headphones even on silent/vibrate,
    // and music playing at the same time is ducked instead of paused.
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_MEDIA)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(attributes)
      .build()

    stopPlaying?.invoke()

    val player = MediaPlayer()
    var finished = false
    lateinit var finish: () -> Unit
    finish = {
      if (!finished) {
        finished = true
        if (stopPlaying === finish) {
          stopPlaying = null
          playingEndAtMs = 0L
        }
        runCatching { player.stop() }
        runCatching { player.release() }
        runCatching { audio.abandonAudioFocusRequest(focus) }
        pending.finish()
      }
    }

    try {
      audio.requestAudioFocus(focus)
      context.resources.openRawResourceFd(R.raw.rest_timer_beep).use { fd ->
        player.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
      }
      player.setAudioAttributes(attributes)
      player.setVolume(volume, volume)
      player.setOnCompletionListener { finish() }
      player.setOnErrorListener { _, _, _ ->
        finish()
        true
      }
      player.prepare()
      player.start()
      playingEndAtMs = endAtMs
      stopPlaying = finish
      // Safety net: a broadcast must finish within ~10 s.
      mainHandler.postDelayed({ finish() }, 8000)
    } catch (e: Exception) {
      Log.w("RestTimerLive", "Failed to play rest beep", e)
      finish()
    }
  }
}
