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
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val volume = intent.getFloatExtra(RestTimerLive.EXTRA_VOLUME, 1f).coerceIn(0f, 1f)
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

    val player = MediaPlayer()
    var finished = false
    val finish = {
      if (!finished) {
        finished = true
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
      // Safety net: a broadcast must finish within ~10 s.
      Handler(Looper.getMainLooper()).postDelayed({ finish() }, 8000)
    } catch (e: Exception) {
      Log.w("RestTimerLive", "Failed to play rest beep", e)
      finish()
    }
  }
}
