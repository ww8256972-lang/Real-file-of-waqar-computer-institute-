import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val keystorePathProp = System.getenv("KEYSTORE_FILE") ?: project.findProperty("KEYSTORE_FILE")?.toString()
val keystoreFile = keystorePathProp?.let { File(it) }
val hasValidReleaseKeystore = keystoreFile != null && keystoreFile.exists() && keystoreFile.length() > 0L

val isReleaseTaskRequested = gradle.startParameter.taskNames.any { taskName ->
    taskName.contains("Release", ignoreCase = true)
}

android {
    namespace = "com.waqarinstitute.erp"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.waqarinstitute.erp"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "2.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }

        externalNativeBuild {
            cmake {
                cppFlags += listOf("-std=c++20", "-O3", "-fvisibility=hidden", "-fstack-protector-strong")
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    signingConfigs {
        create("release") {
            if (hasValidReleaseKeystore && keystoreFile != null) {
                storeFile = keystoreFile
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                    ?: project.findProperty("KEYSTORE_PASSWORD")?.toString()
                    ?: throw GradleException("KEYSTORE_PASSWORD is required for release signing.")
                keyAlias = System.getenv("KEY_ALIAS")
                    ?: project.findProperty("KEY_ALIAS")?.toString()
                    ?: throw GradleException("KEY_ALIAS is required for release signing.")
                keyPassword = System.getenv("KEY_PASSWORD")
                    ?: project.findProperty("KEY_PASSWORD")?.toString()
                    ?: throw GradleException("KEY_PASSWORD is required for release signing.")
            } else if (isReleaseTaskRequested) {
                throw GradleException(
                    "Release build requested without a valid KEYSTORE_FILE. " +
                        "Never sign release APKs with the debug keystore or hardcoded 'android' credentials. " +
                        "Provide KEYSTORE_FILE, KEYSTORE_PASSWORD, KEY_ALIAS, and KEY_PASSWORD."
                )
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasValidReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }

    lint {
        checkReleaseBuilds = true
        abortOnError = false
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "/META-INF/DEPENDENCIES"
            excludes += "/META-INF/INDEX.LIST"
            excludes += "META-INF/versions/9/OSGI-INF/MANIFEST.MF"
        }
        jniLibs {
            useLegacyPackaging = false
        }
    }
}

dependencies {
    // 1. Jetpack Compose & Material 3 (120 FPS UI Architecture)
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.8")
    implementation("androidx.collection:collection-ktx:1.4.5")

    // 2. Hardware Security, Google Tink 1.15.0, Conscrypt TLS 1.3, libsodium & Encrypted DataStore Vault
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("com.google.crypto.tink:tink-android:1.15.0")
    implementation("org.conscrypt:conscrypt-android:2.5.3")
    implementation("com.github.joshjdevl.libsodiumjni:libsodium-jni-aar:2.0.2")
    implementation("com.google.android.play:integrity:1.4.0")

    // 3. Offline-First Room, SQLCipher 256-Bit Encrypted Database & Paging 3 (100k+ Records)
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    implementation("androidx.room:room-paging:$roomVersion")
    implementation("net.zetetic:android-database-sqlcipher:4.5.4")
    implementation("androidx.sqlite:sqlite-ktx:2.4.0")
    implementation("androidx.paging:paging-runtime-ktx:3.3.2")
    implementation("androidx.paging:paging-compose:3.3.2")

    // 4. Zero-Copy FlatBuffers, Protobuf / gRPC-Kotlin & Realm Exam Cache
    implementation("com.google.flatbuffers:flatbuffers-java:24.3.25")
    implementation("com.google.protobuf:protobuf-javalite:4.28.3")
    implementation("com.google.protobuf:protobuf-kotlin-lite:4.28.3")
    implementation("io.grpc:grpc-okhttp:1.68.1")
    implementation("io.grpc:grpc-protobuf-lite:1.68.1")
    implementation("io.grpc:grpc-stub:1.68.1")
    implementation("io.grpc:grpc-kotlin-stub:1.4.1")
    implementation("io.realm.kotlin:library-base:2.0.0")

    // 5. Koin Dependency Injection, AndroidX Startup, Perfetto Tracing, Baseline Profile
    implementation("io.insert-koin:koin-android:3.5.6")
    implementation("io.insert-koin:koin-androidx-compose:3.5.6")
    implementation("androidx.startup:startup-runtime:1.2.0")
    implementation("androidx.tracing:tracing-ktx:1.2.0")
    implementation("androidx.profileinstaller:profileinstaller:1.4.1")

    // 6. Chucker (Debug Inspector + Release No-Op) & LeakCanary (Debug Heap + Release Plumber)
    debugImplementation("com.github.chuckerteam.chucker:library:4.0.0")
    releaseImplementation("com.github.chuckerteam.chucker:library-no-op:4.0.0")
    debugImplementation("com.squareup.leakcanary:leakcanary-android:2.14")
    implementation("com.squareup.leakcanary:plumber-android:2.14")

    // 7. WorkManager Background Synchronization
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // 8. CameraX, Google ML Kit Barcode Scanning, ZXing QR & Play Services Location
    val cameraxVersion = "1.4.0"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // 9. Networking (OkHttp 4.12 + Retrofit 2.11), Timber Logging & Coil Image Loader
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.jakewharton.timber:timber:5.0.1")
    implementation("io.coil-kt:coil-compose:2.7.0")

    // 10. Firebase Enterprise Suite (Auth, Firestore, Storage, Functions, AppCheck, Config)
    val firebaseBom = platform("com.google.firebase:firebase-bom:33.5.1")
    implementation(firebaseBom)
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.firebase:firebase-storage-ktx")
    implementation("com.google.firebase:firebase-functions-ktx")
    implementation("com.google.firebase:firebase-appcheck-ktx")
    implementation("com.google.firebase:firebase-appcheck-debug")
    implementation("com.google.firebase:firebase-config-ktx")
    implementation("com.google.firebase:firebase-analytics-ktx")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // 11. Unit & Instrumented Testing Suite
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("io.insert-koin:koin-test:3.5.6")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
