// Test entry point used by Conductor's FlutterDesktopDriver.
//
// Build with:
//   flutter build macos --profile -t lib/main_test.dart
//   flutter build windows --profile -t lib/main_test.dart
//
// This entry enables the Flutter Driver extension (a Dart VM service
// extension) so that an external process — Conductor's FlutterDesktopDriver
// over WebSocket — can drive the running app.
//
// It is otherwise identical to lib/main.dart and uses the same widget tree.

import 'package:flutter_driver/driver_extension.dart';

import 'main.dart' as app;

void main() {
  enableFlutterDriverExtension();
  app.main();
}
