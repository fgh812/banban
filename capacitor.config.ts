import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.banban.app',
  appName: '반반',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    FirebaseAuthentication: { skipNativeAuth: false, providers: ['google.com'] },
  },
}
export default config
