package expo.modules.resttimerlive

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class RestTimerLiveOptions : Record {
  /** When the rest ends (Unix ms). */
  @Field val endAtMs: Double = 0.0

  @Field val title: String = ""

  @Field val body: String? = null

  /** When to play the countdown beep (Unix ms); 0 = no sound. */
  @Field val soundAtMs: Double = 0.0

  /** Beep volume, 0..1. */
  @Field val volume: Double = 1.0

  /** Notification accent colour (ARGB int), 0 = default. */
  @Field val color: Double = 0.0
}

class RestTimerLiveModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RestTimerLive")

    Function("show") { options: RestTimerLiveOptions ->
      RestTimerLive.show(
        context,
        endAtMs = options.endAtMs.toLong(),
        title = options.title,
        body = options.body,
        soundAtMs = options.soundAtMs.toLong(),
        volume = options.volume.toFloat(),
        color = options.color.toLong().toInt(),
      )
    }

    Function("hide") {
      RestTimerLive.hide(context)
    }
  }
}
