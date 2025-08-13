import os
import sys
import time
import json
import threading
from pathlib import Path

try:
    import gi
    gi.require_version('Gtk', '3.0')
    gi.require_version('AppIndicator3', '0.1')
    from gi.repository import Gtk, AppIndicator3, GLib
except Exception as e:
    print('❌ GTK/AppIndicator not available. Install libappindicator-gtk3 and python3-gi')
    sys.exit(1)

CONFIG_DIR = Path.home() / '.focusflow'
CONFIG_PATH = CONFIG_DIR / 'config.json'

def load_config():
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        if not CONFIG_PATH.exists():
            CONFIG_PATH.write_text(json.dumps({'work_minutes':25,'break_minutes':5,'theme':'dark'}, indent=2))
        return json.loads(CONFIG_PATH.read_text())
    except Exception:
        return {'work_minutes':25,'break_minutes':5,'theme':'dark'}

class FocusFlowTray:
    def __init__(self):
        self.cfg = load_config()
        self.phase = 'work'
        self.running = False
        self.end_ts = 0.0
        self.icon_name = 'preferences-system-time'
        self.ind = AppIndicator3.Indicator.new("focusflow-tray", self.icon_name, AppIndicator3.IndicatorCategory.APPLICATION_STATUS)
        self.ind.set_status(AppIndicator3.IndicatorStatus.ACTIVE)
        self.menu = Gtk.Menu()

        self.start_item = Gtk.MenuItem(label='Start')
        self.start_item.connect('activate', self.start)
        self.menu.append(self.start_item)

        self.pause_item = Gtk.MenuItem(label='Pause')
        self.pause_item.connect('activate', self.pause)
        self.menu.append(self.pause_item)

        self.reset_item = Gtk.MenuItem(label='Reset')
        self.reset_item.connect('activate', self.reset)
        self.menu.append(self.reset_item)

        self.quit_item = Gtk.MenuItem(label='Quit')
        self.quit_item.connect('activate', self.quit)
        self.menu.append(self.quit_item)

        self.menu.show_all()
        self.ind.set_menu(self.menu)

        # Use GLib idle loop for ticking
        GLib.timeout_add_seconds(1, self.tick)

    def notify(self, title: str, body: str):
        try:
            # Use notify-send if available
            os.system(f"notify-send '{title}' '{body}' -u normal -i {self.icon_name}")
        except Exception:
            pass
        # Try to play a short system beep
        try:
            os.system("paplay /usr/share/sounds/freedesktop/stereo/complete.oga >/dev/null 2>&1 || aplay -q /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null || printf '\a'")
        except Exception:
            pass

    def start(self, *_):
        minutes = self.cfg['work_minutes'] if self.phase == 'work' else self.cfg['break_minutes']
        self.end_ts = time.time() + minutes * 60
        self.running = True
        if self.phase == 'work':
            self.notify('Фокус', 'Можете приступать к работе! Будьте сфокусированы.')
        else:
            self.notify('Отдых', 'Сделайте перерыв. Восстановите силы.')

    def pause(self, *_):
        self.running = False

    def reset(self, *_):
        self.running = False
        self.phase = 'work'
        self.end_ts = 0.0

    def quit(self, *_):
        Gtk.main_quit()

    def tick(self):
        # Update label to show remaining time
        if self.running:
            remain = max(0, int(self.end_ts - time.time()))
        else:
            remain = 0
        minutes = remain // 60
        seconds = remain % 60
        state = 'F' if self.phase == 'work' else 'B'
        self.ind.set_label(f"{state} {minutes:02d}:{seconds:02d}", "")

        if self.running and remain <= 0:
            self.notify('Этап завершён', 'Отличная работа! Переходим к следующему этапу.')
            self.phase = 'break' if self.phase == 'work' else 'work'
            self.start()
        return True

def main():
    FocusFlowTray()
    Gtk.main()

if __name__ == '__main__':
    main()

