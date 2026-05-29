import 'package:flutter_test/flutter_test.dart';
import 'package:todoapp/main.dart';

void main() {
  testWidgets('App shows My Todos title', (WidgetTester tester) async {
    await tester.pumpWidget(const TodoApp());
    expect(find.text('My Todos'), findsOneWidget);
  });
}
