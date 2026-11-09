/**
 * QuickJsSandboxEngine.cpp
 * QuickJS Embedded C Native Engine wrapper.
 * Provides a sandboxed JavaScript runtime with strict 4MB RAM limits and 500ms interrupt timeouts.
 * Evaluates dynamic grading formulas, proctoring heuristics, and anti-cheat algorithms safely.
 */

#include <jni.h>
#include <string>
#include <chrono>
#include <android/log.h>
#include "quickjs/quickjs.h"

#define LOG_TAG "QuickJsSandbox"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

struct ExecutionGuard {
    std::chrono::steady_clock::time_point start_time;
    int64_t max_duration_ms;
};

// QuickJS interrupt handler to enforce 500ms execution timeout
static int js_interrupt_handler(JSRuntime* /* rt */, void* opaque) {
    auto* guard = static_cast<ExecutionGuard*>(opaque);
    if (!guard) return 0;

    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - guard->start_time).count();
    if (elapsed > guard->max_duration_ms) {
        return 1; // Terminate execution with interrupt
    }
    return 0;
}

// Native helper exposed to JS: getTimestampMs()
static JSValue js_get_timestamp_ms(JSContext* ctx, JSValueConst /* this_val */, int /* argc */, JSValueConst* /* argv */) {
    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
    return JS_NewInt64(ctx, now_ms);
}

} // namespace

extern "C" {

JNIEXPORT jstring JNICALL
Java_com_edusync_academy_runtime_DynamicExamRuleEngine_evaluateRule(
        JNIEnv* env,
        jobject /* thiz */,
        jstring jsBytecodeScript,
        jstring inputJson) {
    if (!jsBytecodeScript) {
        return env->NewStringUTF("{\"error\":\"Empty JavaScript rule script\"}");
    }

    const char* script_cstr = env->GetStringUTFChars(jsBytecodeScript, nullptr);
    const char* input_cstr = inputJson ? env->GetStringUTFChars(inputJson, nullptr) : "{}";

    JSRuntime* rt = JS_NewRuntime();
    if (!rt) {
        env->ReleaseStringUTFChars(jsBytecodeScript, script_cstr);
        if (inputJson) env->ReleaseStringUTFChars(inputJson, input_cstr);
        return env->NewStringUTF("{\"error\":\"Failed to initialize QuickJS runtime\"}");
    }

    // Set 4MB memory limit as specified in Section 3
    JS_SetMemoryLimit(rt, 4 * 1024 * 1024);

    // Set 500ms timeout interrupt handler
    ExecutionGuard guard{
        .start_time = std::chrono::steady_clock::now(),
        .max_duration_ms = 500
    };
    JS_SetInterruptHandler(rt, js_interrupt_handler, &guard);

    JSContext* ctx = JS_NewContext(rt);
    if (!ctx) {
        JS_FreeRuntime(rt);
        env->ReleaseStringUTFChars(jsBytecodeScript, script_cstr);
        if (inputJson) env->ReleaseStringUTFChars(inputJson, input_cstr);
        return env->NewStringUTF("{\"error\":\"Failed to initialize QuickJS context\"}");
    }

    // Expose global helper functions & input data
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, global_obj, "getTimestampMs", JS_NewCFunction(ctx, js_get_timestamp_ms, "getTimestampMs", 0));

    // Parse input JSON into global object 'input'
    JSValue input_val = JS_ParseJSON(ctx, input_cstr, strlen(input_cstr), "<input>");
    JS_SetPropertyStr(ctx, global_obj, "input", input_val);
    JS_FreeValue(ctx, global_obj);

    // Evaluate user script
    JSValue eval_res = JS_Eval(ctx, script_cstr, strlen(script_cstr), "<dynamic_rule>", JS_EVAL_TYPE_GLOBAL);

    std::string result_str;
    if (JS_IsException(eval_res)) {
        JSValue exception_val = JS_GetException(ctx);
        const char* exc_str = JS_ToCString(ctx, exception_val);
        result_str = std::string("{\"error\":\"") + (exc_str ? exc_str : "Unknown QuickJS exception") + "\"}";
        if (exc_str) JS_FreeCString(ctx, exc_str);
        JS_FreeValue(ctx, exception_val);
    } else {
        // Stringify result
        JSValue json_val = JS_JSONStringify(ctx, eval_res, JS_UNDEFINED, JS_UNDEFINED);
        const char* res_cstr = JS_ToCString(ctx, json_val);
        if (res_cstr) {
            result_str = res_cstr;
            JS_FreeCString(ctx, res_cstr);
        } else {
            const char* fallback = JS_ToCString(ctx, eval_res);
            result_str = fallback ? fallback : "{}";
            if (fallback) JS_FreeCString(ctx, fallback);
        }
        JS_FreeValue(ctx, json_val);
    }

    JS_FreeValue(ctx, eval_res);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);

    env->ReleaseStringUTFChars(jsBytecodeScript, script_cstr);
    if (inputJson) env->ReleaseStringUTFChars(inputJson, input_cstr);

    return env->NewStringUTF(result_str.c_str());
}

// Unified package alias
JNIEXPORT jstring JNICALL
Java_com_waqarinstitute_erp_runtime_DynamicExamRuleEngine_evaluateRule(
        JNIEnv* env, jobject thiz, jstring jsBytecodeScript, jstring inputJson) {
    return Java_com_edusync_academy_runtime_DynamicExamRuleEngine_evaluateRule(env, thiz, jsBytecodeScript, inputJson);
}

} // extern "C"
