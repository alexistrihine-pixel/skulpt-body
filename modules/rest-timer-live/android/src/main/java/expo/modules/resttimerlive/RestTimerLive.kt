package expo.modules.resttimerlive

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle

/**
 * Ongoing "rest" notification whose countdown is drawn by the system (chronometer), so it
 * keeps ticking while the app is in the background, plus an exact alarm that plays the
 * end-of-rest beep on the media stream (heard in headphones even when the phone is muted).
 */
object RestTimerLive {
  private const val CHANNEL_ID = "rest-live"
  private const val NOTIFICATION_ID = 41071
  private const val SOUND_REQUEST_CODE = 41072
  internal const val EXTRA_VOLUME = "volume"
  private const val EXTRA_REQUEST_PROMOTED_ONGOING = "android.requestPromotedOngoing"

  fun show(
    context: Context,
    endAtMs: Long,
    title: String,
    body: String?,
    soundAtMs: Long,
    volume: Float,
    color: Int,
  ) {
    val now = System.currentTimeMillis()
    if (endAtMs <= now) {
      hide(context)
      return
    }

    val manager = context.getSystemService(NotificationManager::class.java)
    ensureChannel(manager)

    val builder = Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.rest_timer_notification_icon)
      .setContentTitle(title)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setLocalOnly(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setWhen(endAtMs)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      // Gone by itself when the rest is over (the "next set" alert takes over).
      .setTimeoutAfter(endAtMs - now)
    if (!body.isNullOrEmpty()) builder.setContentText(body)
    if (color != 0) builder.setColor(color)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setCategory(Notification.CATEGORY_STOPWATCH)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
      // Live Update (status bar chip). Same extra as Notification.Builder#setRequestPromotedOngoing,
      // which isn't in the compile SDK yet (androidx NotificationCompat sets it this way too).
      builder.addExtras(Bundle().apply { putBoolean(EXTRA_REQUEST_PROMOTED_ONGOING, true) })
    }
    launchIntent(context)?.let { builder.setContentIntent(it) }

    manager.notify(NOTIFICATION_ID, builder.build())
    scheduleSound(context, soundAtMs, volume)
  }

  fun hide(context: Context) {
    context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    context.getSystemService(AlarmManager::class.java).cancel(soundIntent(context, 1f))
  }

  private fun ensureChannel(manager: NotificationManager) {
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Chrono de repos",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Compte à rebours du repos pendant une séance"
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  private fun scheduleSound(context: Context, soundAtMs: Long, volume: Float) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val intent = soundIntent(context, volume)
    alarms.cancel(intent)
    if (soundAtMs <= System.currentTimeMillis()) return

    val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    if (canExact) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, soundAtMs, intent)
    } else {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, soundAtMs, intent)
    }
  }

  private fun soundIntent(context: Context, volume: Float): PendingIntent {
    val intent = Intent(context, RestTimerSoundReceiver::class.java)
      .putExtra(EXTRA_VOLUME, volume)
    return PendingIntent.getBroadcast(
      context,
      SOUND_REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun launchIntent(context: Context): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    return PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
