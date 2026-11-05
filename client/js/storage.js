// Shared browser persistence. Failed writes leave the current session usable.
export const SAVE_KEY = 'leo_game_save_v1';
export const PREFERENCE_KEY = 'leo_menu_settings_v1';

export function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
