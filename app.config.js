// dynamic config so google-services.json can come from the EAS file env var (GOOGLE_SERVICES_JSON)
// on the build server, since the real file is gitignored and never uploaded to the builder.
// locally, EAS_BUILD isn't set, so it just falls back to the file sitting in the project root.
module.exports = {
  expo: {
    name: 'NoBounds-Android',
    slug: 'nobounds-android',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'noboundsandroid',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
    },
    android: {
      package: 'com.shashank.noboundsandroid',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
    },
    web: {
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#208AEF',
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      ],
      'expo-image',
      [
        'expo-camera',
        {
          cameraPermission: 'Take a quick photo to share with your partner.',
        },
      ],
      // without this plugin the android photo-library permissions never make it into the
      // manifest, so picking a Bound photo from the gallery fails on device
      [
        'expo-image-picker',
        {
          photosPermission: 'Choose a photo from your library to share with your partner.',
        },
      ],
      'expo-notifications',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'a380c0a8-56ac-4d18-8ebe-3127eaffdbf8',
      },
    },
    owner: 'shashankn0s-team',
  },
};
