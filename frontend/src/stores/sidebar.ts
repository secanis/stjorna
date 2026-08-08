import { createSignal } from 'solid-js';

const [version, setVersion] = createSignal(0);

export const sidebarStore = {
  get version() {
    return version();
  },
  bump() {
    setVersion(v => v + 1);
  },
};
