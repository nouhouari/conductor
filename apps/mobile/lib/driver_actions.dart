// Test-only action registry.
//
// Populated by HomeScreen._HomeScreenState.initState() when the app is
// built in test mode (DISABLE_SWIPE_GESTURES=true dart-define).
// Consumed by main_test.dart's enableFlutterDriverExtension handler.
//
// Using requestData lets Conductor bypass flutter_driver's hitTestable()
// check, which never resolves for widgets inside a Scrollable on macOS.

typedef DriverActionHandler = Future<String> Function(Map<String, dynamic> args);

final Map<String, DriverActionHandler> driverActions = {};
