import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:todoapp/screens/home_screen.dart';

const _disableAnimations = bool.fromEnvironment('DISABLE_ANIMATIONS', defaultValue: false);

void main() {
  if (_disableAnimations) {
    timeDilation = 0.001;
  }
  runApp(const TodoApp());
}

class TodoApp extends StatelessWidget {
  const TodoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Todo App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      builder: (context, child) {
        if (!_disableAnimations || child == null) return child ?? const SizedBox.shrink();
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(disableAnimations: true),
          child: child,
        );
      },
      home: const HomeScreen(),
    );
  }
}
