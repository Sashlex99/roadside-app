export default {
  expo: {
    name: "roadside-assistance",
    slug: "roadside-assistance",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    scheme: "roadsideassistance",
    plugins: [
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.roadside.assistance.bg",
          enableGooglePay: true
        }
      ]
    ],
    developmentClient: {
      silentLaunch: true
    },
    updates: {
      checkAutomatically: "ON_ERROR_RECOVERY",
      fallbackToCacheTimeout: 0
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.roadside.assistance.bg",
      config: {
        usesNonExemptEncryption: false,
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || "AIzaSyA_95_WMGV4IsaMVOs_aDQD98x-7dL6IAQ"
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Приложението използва вашата локация за да покаже най-близките шофьори.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Приложението използва вашата локация за да покаже най-близките шофьори.",
        NSCameraUsageDescription: "Приложението използва камерата за да снимате повредата.",
        NSPhotoLibraryUsageDescription: "Приложението има нужда от достъп до галерията за да качите снимки."
      }
    },
    android: {
      package: "com.roadside.assistance.bg",
      versionCode: 1,
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || "AIzaSyAuDJGJE-nmZYSgZ_a98bXs_LiWFAkWKuY"
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK",
        "FOREGROUND_SERVICE",
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.POST_NOTIFICATIONS"
      ],
      blockedPermissions: [
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "0279cba4-55bd-4db9-acad-d0bbc458acfb"
      },
      environment: process.env.NODE_ENV || "development",
      projectEnv: process.env.NODE_ENV === "production" ? "prod" : "dev",
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      stripe: {
        publishableKey: "pk_test_51RYV77D3wb1vOChaKh0dvgk9pSVuijYe57qI8klwnDjLDBosuLbmYdmCLQLwpzCSzBdj37PzBq8BDU3yhQF4ByEy00bjXjn9jg"
      },
      smsApiKey: process.env.SMS_API_KEY,
      smsUsername: process.env.SMS_USERNAME,
      smsProvider: process.env.EXPO_PUBLIC_SMS_PROVIDER,
      smsMode: process.env.EXPO_PUBLIC_SMS_MODE
    },
    owner: "sashlex"
  }
};
