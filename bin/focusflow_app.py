import os
import json
import time
from pathlib import Path
import streamlit as st

CONFIG_DIR = Path.home() / '.focusflow'
CONFIG_PATH = CONFIG_DIR / 'config.json'

DEFAULTS = {
    'work_minutes': 25,
    'break_minutes': 5,
    'theme': 'dark',
}

def load_config():
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        if not CONFIG_PATH.exists():
            CONFIG_PATH.write_text(json.dumps(DEFAULTS, indent=2))
            return DEFAULTS.copy()
        return { **DEFAULTS, **json.loads(CONFIG_PATH.read_text()) }
    except Exception:
        return DEFAULTS.copy()

def save_config(cfg):
    try:
        CONFIG_PATH.write_text(json.dumps(cfg, indent=2))
    except Exception:
        pass

st.set_page_config(page_title='FocusFlow', layout='centered')

if 'initialized' not in st.session_state:
    cfg = load_config()
    st.session_state.work_minutes = int(cfg.get('work_minutes', DEFAULTS['work_minutes']))
    st.session_state.break_minutes = int(cfg.get('break_minutes', DEFAULTS['break_minutes']))
    st.session_state.theme = cfg.get('theme', DEFAULTS['theme'])
    st.session_state.phase = 'work'  # 'work' | 'break'
    st.session_state.running = False
    st.session_state.end_time = 0.0
    st.session_state.initialized = True

def apply_theme(theme: str):
    if theme == 'light':
        st.markdown('''
            <style>
            body { background-color: #ffffff; color: #111111; }
            .center { text-align: center; }
            .timer { font-size: 6rem; font-weight: 700; margin: 1rem 0; }
            .muted { color: #666666; }
            </style>
        ''', unsafe_allow_html=True)
    else:
        st.markdown('''
            <style>
            body { background-color: #0f0f13; color: #eaeaea; }
            .center { text-align: center; }
            .timer { font-size: 6rem; font-weight: 700; margin: 1rem 0; }
            .muted { color: #9aa0a6; }
            </style>
        ''', unsafe_allow_html=True)

apply_theme(st.session_state.theme)

st.markdown('<div class="center"><h2>FocusFlow</h2></div>', unsafe_allow_html=True)

col1, col2, col3 = st.columns([1,1,1])
with col1:
    st.session_state.work_minutes = st.number_input('Работа (мин)', min_value=1, max_value=180, value=int(st.session_state.work_minutes), step=1)
with col2:
    st.session_state.break_minutes = st.number_input('Отдых (мин)', min_value=1, max_value=60, value=int(st.session_state.break_minutes), step=1)
with col3:
    theme_choice = st.selectbox('Тема', ['dark', 'light'], index=0 if st.session_state.theme=='dark' else 1)
    if theme_choice != st.session_state.theme:
        st.session_state.theme = theme_choice
        apply_theme(theme_choice)

# Persist settings
save_config({
    'work_minutes': int(st.session_state.work_minutes),
    'break_minutes': int(st.session_state.break_minutes),
    'theme': st.session_state.theme,
})

def start_timer():
    minutes = st.session_state.work_minutes if st.session_state.phase == 'work' else st.session_state.break_minutes
    st.session_state.end_time = time.time() + minutes * 60
    st.session_state.running = True

def pause_timer():
    st.session_state.running = False

def reset_timer():
    st.session_state.running = False
    st.session_state.phase = 'work'
    st.session_state.end_time = 0.0

btn_col1, btn_col2, btn_col3 = st.columns([1,1,1])
with btn_col1:
    if st.button('Start'):
        start_timer()
with btn_col2:
    if st.button('Pause'):
        pause_timer()
with btn_col3:
    if st.button('Reset'):
        reset_timer()

def format_mmss(seconds_left: int) -> str:
    m = seconds_left // 60
    s = seconds_left % 60
    return f"{m:02d}:{s:02d}"

placeholder = st.empty()

def beep():
    # Use WebAudio to generate a short beep without assets
    st.markdown('''
    <script>
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(880, ctx.currentTime);
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        o.start();
        setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2); o.stop(ctx.currentTime + 0.25); }, 200);
      } catch(e) {}
    </script>
    ''', unsafe_allow_html=True)

while True:
    now = time.time()
    remaining = max(0, int(st.session_state.end_time - now)) if st.session_state.running else 0

    with placeholder.container():
        phase_label = 'Фокус' if st.session_state.phase == 'work' else 'Отдых'
        st.markdown(f'<div class="center muted">{phase_label}</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="center timer">{format_mmss(remaining if st.session_state.running else (st.session_state.work_minutes*60 if st.session_state.phase=="work" else st.session_state.break_minutes*60))}</div>', unsafe_allow_html=True)

    if st.session_state.running and remaining <= 0:
        # Phase complete
        beep()
        if st.session_state.phase == 'work':
            st.session_state.phase = 'break'
        else:
            st.session_state.phase = 'work'
        start_timer()

    time.sleep(1)
    st.rerun()

