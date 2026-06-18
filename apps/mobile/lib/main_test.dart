// Test entry point used by Conductor's FlutterDesktopDriver.
//
// Build with:
//   flutter build macos --profile -t lib/main_test.dart
//
// This entry enables the Flutter Driver extension and wires a requestData
// handler that dispatches JSON-encoded commands to app-side action handlers
// registered by HomeScreen.  This bypasses flutter_driver's hitTestable()
// check — which never resolves for widgets inside a Scrollable on macOS.

import 'dart:convert';

import 'package:flutter_driver/driver_extension.dart';
import 'package:todoapp/driver_actions.dart';

import 'main.dart' as app;

void main() {
  enableFlutterDriverExtension(handler: (message) async {
    if (message == null || message.isEmpty) return 'error: empty message';
    try {
      final Map<String, dynamic> cmd =
          jsonDecode(message) as Map<String, dynamic>;
      final action = cmd['action'] as String?;
      if (action == null) return 'error: missing "action" key';
      final handler = driverActions[action];
      if (handler == null) return 'error: unknown action "$action"';
      return await handler(cmd);
    } catch (e) {
      return 'error: $e';
    }
  });
  app.main();
}
