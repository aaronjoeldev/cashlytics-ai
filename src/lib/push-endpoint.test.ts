import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedPushEndpoint } from "./push-endpoint";

test("accepts known push services", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/abc:123",
    "https://updates.push.services.mozilla.com/wpush/v2/xyz",
    "https://autopush.push.services.mozilla.com/x",
    "https://web.push.apple.com/QAbc",
    "https://api.push.apple.com/3/device/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://FCM.GoogleAPIs.com/fcm/send/abc",
    "https://fcm.googleapis.com:443/fcm/send/abc",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), true, url);
  }
});

test("rejects suffix and lookalike host tricks", () => {
  for (const url of [
    "https://evilfcm.googleapis.com/x",
    "https://fcm.googleapis.com.attacker.com/x",
    "https://attacker.com/fcm.googleapis.com",
    "https://attacker.com/?h=fcm.googleapis.com",
    "https://attacker.com#fcm.googleapis.com",
    "https://notify.windows.com/x",
    "https://evilnotify.windows.com/x",
    "https://push.apple.com/x",
    "https://evil.push.apple.com.attacker.com/x",
    "https://fcm.googleapis.com./x",
    "https://sub.fcm.googleapis.com/x",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), false, url);
  }
});

test("rejects non-https schemes", () => {
  for (const url of [
    "http://fcm.googleapis.com/x",
    "ftp://fcm.googleapis.com/x",
    "javascript:alert(1)",
    "//fcm.googleapis.com/x",
    "fcm.googleapis.com/x",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), false, url);
  }
});

test("rejects userinfo", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com@attacker.com/x"), false);
  assert.equal(isAllowedPushEndpoint("https://attacker.com@fcm.googleapis.com/x"), false);
  assert.equal(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/x"), false);
});

test("rejects IP literals and internal hosts", () => {
  for (const url of [
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/x",
    "https://2130706433/x",
    "https://localhost/x",
    "https://10.0.0.1/x",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), false, url);
  }
});

test("rejects explicit non-default ports", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x"), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com:80/x"), false);
});

test("rejects non-strings, empty and oversized input", () => {
  assert.equal(isAllowedPushEndpoint(undefined), false);
  assert.equal(isAllowedPushEndpoint(null), false);
  assert.equal(isAllowedPushEndpoint(42), false);
  assert.equal(isAllowedPushEndpoint(""), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/" + "a".repeat(3000)), false);
});
