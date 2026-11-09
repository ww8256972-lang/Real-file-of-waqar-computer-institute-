import React, { useState } from 'react';
import { X, Copy, Check, Download, Code2, GitBranch, Smartphone } from 'lucide-react';

interface KotlinCiModalProps {
  onClose: () => void;
}

const GITHUB_WORKFLOW_YAML = `name: Android CI Build & APK Artifact

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    name: Build & Test WAQAR INSTITUTE Android APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Set up Android SDK & Accept All Licenses
        uses: android-actions/setup-android@v3
        continue-on-error: true
        with:
          packages: 'platform-tools'
          accept-android-sdk-licenses: true
          log-accepted-android-sdk-licenses: false

      - name: Write & Accept All Android SDK Licenses
        run: |
          export ANDROID_SDK_ROOT="\${ANDROID_HOME:-/usr/local/lib/android/sdk}"
          mkdir -p "$ANDROID_SDK_ROOT/licenses"
          printf "\\n8933bad161af4178b1185d1a37fbf41ea5269c55\\nd56f5187479451eabf01fb78af6dfcb131a6481e\\n24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$ANDROID_SDK_ROOT/licenses/android-sdk-license"
          printf "\\n84831b9409646a918e30573bab4c9c91346d8abd\\n504667f4c0de7af1a06de9f4b1727b84351f2910" > "$ANDROID_SDK_ROOT/licenses/android-sdk-preview-license"
          printf "\\nd975f751698a77b662f1254ddbeed3901e976f5a" > "$ANDROID_SDK_ROOT/licenses/intel-android-extra-license"
          printf "\\n33b6a2b64607f11b759f320ef9dff4ae5c47d97a" > "$ANDROID_SDK_ROOT/licenses/google-gdk-license"
          printf "\\n601085b94cd77f0b54ff86406957099ebe79c4d6" > "$ANDROID_SDK_ROOT/licenses/android-googletv-license"
          printf "\\n859f317696f67ef3d7f30a50a5560e7834b43903" > "$ANDROID_SDK_ROOT/licenses/android-sdk-arm-dbt-license"
          yes | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || yes | sdkmanager --licenses >/dev/null 2>&1 || true

      - name: Set up Gradle 8.7 & Cache
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: '8.7'
          cache-read-only: false

      - name: Generate & Grant Execute Permission for gradlew
        run: |
          if [ -d "android-kotlin" ]; then cd android-kotlin; fi
          if [ ! -f "./gradlew" ]; then
            gradle wrapper --gradle-version 8.7
          fi
          chmod +x gradlew

      - name: Run Android Lint
        run: |
          if [ -d "android-kotlin" ]; then cd android-kotlin; fi
          ./gradlew lintDebug --no-daemon

      - name: Run Unit Tests
        run: |
          if [ -d "android-kotlin" ]; then cd android-kotlin; fi
          ./gradlew testDebugUnitTest --no-daemon

      - name: Assemble Debug APK
        env:
          AGORA_APP_ID: \${{ secrets.AGORA_APP_ID }}
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
        run: |
          if [ -d "android-kotlin" ]; then cd android-kotlin; fi
          ./gradlew assembleDebug --no-daemon --stacktrace

      - name: Prepare Debug APK in app/build/outputs/apk/debug/
        run: |
          mkdir -p app/build/outputs/apk/debug
          if [ -d "android-kotlin/app/build/outputs/apk/debug" ]; then
            cp -f android-kotlin/app/build/outputs/apk/debug/*.apk app/build/outputs/apk/debug/ || true
          fi
          ls -lh app/build/outputs/apk/debug/
          echo "### WAQAR INSTITUTE Android Debug APK Ready" >> $GITHUB_STEP_SUMMARY
          echo "- **Artifact Name:** \`WAQAR-INSTITUTE-Debug-APK\`" >> $GITHUB_STEP_SUMMARY
          echo "- **Output Path:** \`app/build/outputs/apk/debug/app-debug.apk\`" >> $GITHUB_STEP_SUMMARY
          echo "- Scroll down to the **Artifacts** section on this Summary page to download your APK." >> $GITHUB_STEP_SUMMARY

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: WAQAR-INSTITUTE-Debug-APK
          path: app/build/outputs/apk/debug/*.apk
          if-no-files-found: error
          retention-days: 30`;

const KOTLIN_REPOSITORY_CODE = `// File: android-kotlin/app/src/main/java/com/waqarinstitute/erp/data/WaqarFirebaseRepository.kt
package com.waqarinstitute.erp.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

/**
 * WAQAR INSTITUTE Real Firebase Cloud Firestore + Agora RTC Repository
 * Project ID: adroit-graph-h2w8r
 * Firestore Database ID: ai-studio-988a7681-f0d0-4922-93ac-38c131c1cc37
 */
class WaqarFirebaseRepository {
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance("ai-studio-988a7681-f0d0-4922-93ac-38c131c1cc37")

    fun currentUid(): String? = auth.currentUser?.uid
}`;

export const KotlinCiModal: React.FC<KotlinCiModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'workflow' | 'kotlin'>('workflow');
  const [copied, setCopied] = useState(false);

  const currentCode = tab === 'workflow' ? GITHUB_WORKFLOW_YAML : KOTLIN_REPOSITORY_CODE;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tab === 'workflow' ? 'android.yml' : 'WaqarFirebaseRepository.kt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0A184E] border border-blue-400/30 text-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15 bg-[#081238]">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-display font-bold text-lg">
                Kotlin Android &amp; GitHub Actions APK Workflow
              </h3>
              <p className="text-xs text-blue-200">
                Saved in workspace at /.github/workflows/android.yml &amp; /android-kotlin/
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between px-6 py-3 bg-[#0D2167] border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('workflow')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'workflow' ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-white/10'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>.github/workflows/android.yml</span>
            </button>
            <button
              onClick={() => setTab('kotlin')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'kotlin' ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-white/10'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Kotlin Jetpack Compose + Agora + Firebase</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-[#050B24] font-mono text-xs text-blue-100 leading-relaxed">
          <pre className="whitespace-pre-wrap">{currentCode}</pre>
        </div>
      </div>
    </div>
  );
};
