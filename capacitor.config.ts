import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.norahobbits.analogplayer',
  appName: 'Resonance',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
  },
}

export default config
