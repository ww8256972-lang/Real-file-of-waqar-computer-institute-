#ifndef QUICKJS_H
#define QUICKJS_H

#include <stdio.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;
typedef struct JSValueConst {
    uint64_t u;
} JSValueConst;
typedef struct JSValue {
    uint64_t u;
} JSValue;

#define JS_EVAL_TYPE_GLOBAL   (0 << 0)
#define JS_EVAL_TYPE_MODULE   (1 << 0)
#define JS_EVAL_FLAG_STRICT   (1 << 3)

#define JS_UNDEFINED (JSValue){0}

typedef JSValue JSCFunction(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv);
typedef int JSInterruptHandler(JSRuntime *rt, void *opaque);

JSRuntime *JS_NewRuntime(void);
void JS_SetMemoryLimit(JSRuntime *rt, size_t limit);
void JS_SetInterruptHandler(JSRuntime *rt, JSInterruptHandler *cb, void *opaque);
void JS_FreeRuntime(JSRuntime *rt);

JSContext *JS_NewContext(JSRuntime *rt);
void JS_FreeContext(JSContext *ctx);

JSValue JS_GetGlobalObject(JSContext *ctx);
int JS_SetPropertyStr(JSContext *ctx, JSValueConst this_obj, const char *prop, JSValue val);
JSValue JS_NewCFunction(JSContext *ctx, JSCFunction *func, const char *name, int length);
JSValue JS_NewInt64(JSContext *ctx, int64_t v);

JSValue JS_ParseJSON(JSContext *ctx, const char *buf, size_t buf_len, const char *filename);
JSValue JS_JSONStringify(JSContext *ctx, JSValueConst obj, JSValueConst replacer, JSValueConst space0);

JSValue JS_Eval(JSContext *ctx, const char *input, size_t input_len, const char *filename, int eval_flags);
int JS_IsException(JSValueConst v);
JSValue JS_GetException(JSContext *ctx);

const char *JS_ToCString(JSContext *ctx, JSValueConst val);
void JS_FreeCString(JSContext *ctx, const char *ptr);
void JS_FreeValue(JSContext *ctx, JSValue v);

#ifdef __cplusplus
}
#endif

#endif /* QUICKJS_H */
