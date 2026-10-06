import { useEffect, useState } from "react";
import { learningAPI, Reminder } from "./learning";
export default function ReminderSettings() {
  const [value, setValue] = useState<Reminder | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    learningAPI
      .reminder()
      .then(setValue)
      .catch(() =>
        setMessage(
          "Reminder settings could not be loaded. Reopen your profile to retry.",
        ),
      );
  }, []);
  async function save() {
    if (!value) return;
    setBusy(true);
    setMessage("");
    try {
      await learningAPI.saveReminder(value);
      setMessage(
        value.enabled ? "Daily reminder saved." : "Reminders are off.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save reminder");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reminder-settings">
      <h3>Study reminders</h3>
      {value ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={value.enabled}
              disabled={!value.telegram_linked}
              onChange={(e) =>
                setValue({ ...value, enabled: e.target.checked })
              }
            />{" "}
            Remind me in Telegram
          </label>
          {!value.telegram_linked && (
            <p>
              Open MockAI from @mockai_bot to use Telegram reminders for that
              account.
            </p>
          )}
          <div className="reminder-fields">
            <label>
              Time
              <input
                type="time"
                value={value.local_time}
                onChange={(e) =>
                  setValue({ ...value, local_time: e.target.value })
                }
              />
            </label>
            <label>
              Timezone
              <input
                list="timezones"
                value={value.timezone}
                onChange={(e) =>
                  setValue({ ...value, timezone: e.target.value })
                }
              />
              <datalist id="timezones">
                {[
                  ...new Set([
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    "Asia/Tashkent",
                    "Europe/London",
                    "UTC",
                  ]),
                ].map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </label>
          </div>
          <button
            className="secondary-action"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save reminder"}
          </button>
        </>
      ) : (
        !message && <p>Loading preferences…</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
