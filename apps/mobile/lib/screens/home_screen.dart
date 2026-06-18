import 'package:flutter/material.dart';
import 'package:todoapp/driver_actions.dart';
import 'package:todoapp/models/todo.dart';
import 'package:todoapp/services/todo_service.dart';

const _disableAnimations = bool.fromEnvironment('DISABLE_ANIMATIONS', defaultValue: false);
// Disables Dismissible swipe gestures so flutter_driver can tap list buttons
// without gesture-arena contention on desktop.
const _disableSwipeGestures = bool.fromEnvironment('DISABLE_SWIPE_GESTURES', defaultValue: false);

Color _priorityColor(String priority) {
  switch (priority) {
    case 'critical':
      return Colors.red.shade100;
    case 'urgent':
      return Colors.amber.shade100;
    case 'not urgent':
      return Colors.green.shade100;
    default:
      return Colors.white;
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TodoService _service = TodoService(
    baseUrl: const String.fromEnvironment('API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000/api'),
  );

  List<Todo> _todos = [];
  bool _loading = true;
  String? _error;
  // Holds the active dialog's TextEditingController so that the
  // 'setDialogText' requestData action can inject text without needing
  // flutter_driver's TestTextInput mock (whose _client stays null on macOS
  // because autofocus establishes the connection before the mock registers).
  TextEditingController? _activeDialogController;

  @override
  void initState() {
    super.initState();
    _loadTodos();
    if (_disableSwipeGestures) _registerDriverActions();
  }

  void _registerDriverActions() {
    driverActions['toggleTodo'] = (args) async {
      final title = args['title'] as String;
      final todo = _todos.firstWhere(
        (t) => t.title == title,
        orElse: () => throw StateError('Todo "$title" not found'),
      );
      await _toggleTodo(todo);
      return 'ok';
    };

    driverActions['editTodoTitle'] = (args) async {
      final currentTitle = args['currentTitle'] as String;
      final newTitle = (args['newTitle'] as String).trim();
      if (newTitle.isEmpty || newTitle == currentTitle) return 'skipped';
      final todo = _todos.firstWhere(
        (t) => t.title == currentTitle,
        orElse: () => throw StateError('Todo "$currentTitle" not found'),
      );
      final updated = await _service.updateTodo(todo.id, title: newTitle);
      if (mounted) {
        setState(() {
          final idx = _todos.indexWhere((t) => t.id == todo.id);
          if (idx != -1) _todos[idx] = updated;
        });
      }
      return 'ok';
    };

    driverActions['deleteTodo'] = (args) async {
      final title = args['title'] as String;
      final todo = _todos.firstWhere(
        (t) => t.title == title,
        orElse: () => throw StateError('Todo "$title" not found'),
      );
      await _service.deleteTodo(todo.id);
      if (mounted) {
        setState(() => _todos.removeWhere((t) => t.id == todo.id));
      }
      return 'ok';
    };

    // Directly sets text on the currently-open dialog's TextEditingController.
    // Avoids the TestTextInput mock path where _client is null on macOS because
    // autofocus establishes the connection before the mock is registered.
    driverActions['setDialogText'] = (args) async {
      final text = args['text'] as String;
      if (_activeDialogController == null) {
        return 'error: no active dialog controller';
      }
      _activeDialogController!.text = text;
      return 'ok';
    };

    // Directly calls _loadTodos() and waits for it to complete.
    // Avoids relying on the Refresh IconButton tap which may not fire onPressed
    // via flutter_driver touch events on macOS desktop.
    driverActions['refresh'] = (args) async {
      await _loadTodos();
      if (_error != null) return 'error: load failed: $_error';
      return 'ok';
    };

    // Polls until _loading is false. Useful after a tap-based refresh to
    // ensure _todos is fully populated before acting on it.
    driverActions['waitUntilLoaded'] = (args) async {
      while (_loading) {
        await Future.delayed(const Duration(milliseconds: 50));
      }
      return 'ok';
    };
  }

  @override
  void dispose() {
    if (_disableSwipeGestures) {
      driverActions.remove('toggleTodo');
      driverActions.remove('editTodoTitle');
      driverActions.remove('deleteTodo');
      driverActions.remove('setDialogText');
      driverActions.remove('refresh');
      driverActions.remove('waitUntilLoaded');
    }
    super.dispose();
  }

  Future<void> _loadTodos() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final todos = await _service.fetchTodos();
      setState(() {
        _todos = todos;
        _loading = false;
      });
    } on TodoServiceException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _addTodo() async {
    final result = await _showAddDialog();
    if (result == null) return;

    try {
      final todo = await _service.createTodo(result.title, priority: result.priority);
      setState(() => _todos.insert(0, todo));
    } on TodoServiceException catch (e) {
      _showError(e.message);
    }
  }

  Future<void> _editTodo(Todo todo) async {
    final title = await _showTitleDialog('Edit Todo', todo.title);
    if (title == null || title.trim().isEmpty || title.trim() == todo.title) {
      return;
    }

    try {
      final updated = await _service.updateTodo(todo.id, title: title.trim());
      setState(() {
        final idx = _todos.indexWhere((t) => t.id == todo.id);
        if (idx != -1) _todos[idx] = updated;
      });
    } on TodoServiceException catch (e) {
      _showError(e.message);
    }
  }

  Future<void> _toggleTodo(Todo todo) async {
    final newStatus = todo.isDone ? 'open' : 'done';
    try {
      final updated = await _service.updateTodo(todo.id, status: newStatus);
      setState(() {
        final idx = _todos.indexWhere((t) => t.id == todo.id);
        if (idx != -1) _todos[idx] = updated;
      });
    } on TodoServiceException catch (e) {
      _showError(e.message);
    }
  }

  Future<void> _deleteTodo(Todo todo) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Todo'),
        content: Text('Delete "${todo.title}"?'),
        actions: [
          Semantics(
            identifier: 'dialog-cancel',
            child: TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
          ),
          Semantics(
            identifier: 'dialog-confirm-delete',
            child: FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await _service.deleteTodo(todo.id);
      setState(() => _todos.removeWhere((t) => t.id == todo.id));
    } on TodoServiceException catch (e) {
      _showError(e.message);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade700,
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Retry',
          textColor: Colors.white,
          onPressed: _loadTodos,
        ),
      ),
    );
  }

  Future<({String title, String priority})?> _showAddDialog() {
    final titleController = TextEditingController();
    _activeDialogController = titleController;
    String selectedPriority = 'not urgent';
    return showDialog<({String title, String priority})>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('New Todo'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                identifier: 'dialog-title-input',
                child: TextField(
                  key: const ValueKey('dialog-title-input'),
                  controller: titleController,
                  autofocus: false,
                  showCursor: !_disableAnimations,
                  decoration: const InputDecoration(
                    hintText: 'Enter todo title',
                    labelText: 'Title',
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Semantics(
                identifier: 'dialog-priority-select',
                child: DropdownButtonFormField<String>(
                  initialValue: selectedPriority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: const [
                    DropdownMenuItem(value: 'not urgent', child: Text('Not Urgent')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                    DropdownMenuItem(value: 'critical', child: Text('Critical')),
                  ],
                  onChanged: (v) {
                    if (v != null) setDialogState(() => selectedPriority = v);
                  },
                ),
              ),
            ],
          ),
          actions: [
            Semantics(
              identifier: 'dialog-cancel',
              child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel')),
            ),
            Semantics(
              identifier: 'dialog-save',
              child: FilledButton(
                  onPressed: () {
                    final title = titleController.text.trim();
                    if (title.isEmpty) return;
                    _activeDialogController = null;
                    Navigator.pop(ctx, (title: title, priority: selectedPriority));
                  },
                  child: const Text('Save')),
            ),
          ],
        ),
      ),
    );
  }

  Future<String?> _showTitleDialog(String heading, String initial) {
    final controller = TextEditingController(text: initial);
    _activeDialogController = controller;
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, _) => AlertDialog(
          title: Text(heading),
          content: Semantics(
            identifier: 'dialog-title-input',
            child: TextField(
              key: const ValueKey('dialog-title-input'),
              controller: controller,
              autofocus: false,
              showCursor: !_disableAnimations,
              decoration: const InputDecoration(
                hintText: 'Enter todo title',
                labelText: 'Title',
              ),
              onSubmitted: (v) => Navigator.pop(ctx, v),
            ),
          ),
          actions: [
            Semantics(
              identifier: 'dialog-cancel',
              child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel')),
            ),
            Semantics(
              identifier: 'dialog-save',
              child: FilledButton(
                  onPressed: () => Navigator.pop(ctx, controller.text),
                  child: const Text('Save')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, color: Colors.red),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _loadTodos,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Todos'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          if (_disableSwipeGestures)
            IconButton(
              key: const ValueKey('add-todo-fab'),
              icon: const Icon(Icons.add),
              onPressed: _addTodo,
              tooltip: 'Add Todo',
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTodos,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorView()
              : _todos.isEmpty
                  ? const Center(
                      child: Text(
                        'No todos yet',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadTodos,
                      child: ListView.builder(
                        // NeverScrollableScrollPhysics prevents the scroll recognizer
                        // from entering the gesture arena and blocking IconButton taps
                        // when flutter_driver sends touch events on macOS desktop.
                        physics: _disableSwipeGestures
                            ? const NeverScrollableScrollPhysics()
                            : null,
                        itemCount: _todos.length,
                        itemBuilder: (context, index) {
                          final todo = _todos[index];
                          return Dismissible(
                            key: ValueKey(todo.id),
                            direction: _disableSwipeGestures
                                ? DismissDirection.none
                                : DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              color: Colors.red,
                              child: const Icon(Icons.delete,
                                  color: Colors.white),
                            ),
                            confirmDismiss: (_) async {
                              await _deleteTodo(todo);
                              return false;
                            },
                            child: Container(
                              color: _priorityColor(todo.priority),
                              child: ListTile(
                                leading: IconButton(
                                  key: ValueKey('toggle-${todo.title}'),
                                  tooltip: 'Toggle ${todo.title}',
                                  icon: Icon(
                                    todo.isDone
                                        ? Icons.check_circle
                                        : Icons.circle_outlined,
                                    color: todo.isDone
                                        ? Colors.green
                                        : Colors.grey,
                                  ),
                                  onPressed: () => _toggleTodo(todo),
                                ),
                                title: Semantics(
                                  label: todo.title,
                                  excludeSemantics: true,
                                  child: Text(
                                    todo.title,
                                    style: todo.isDone
                                        ? const TextStyle(
                                            decoration:
                                                TextDecoration.lineThrough,
                                            color: Colors.grey)
                                        : null,
                                  ),
                                ),
                                subtitle: ExcludeSemantics(
                                  child: Text('${todo.priority} · ${todo.status}'),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      key: ValueKey('edit-${todo.title}'),
                                      tooltip: 'Edit ${todo.title}',
                                      icon: const Icon(Icons.edit, size: 20),
                                      onPressed: () => _editTodo(todo),
                                    ),
                                    IconButton(
                                      key: ValueKey('delete-${todo.title}'),
                                      tooltip: 'Delete ${todo.title}',
                                      icon: const Icon(Icons.delete,
                                          size: 20, color: Colors.red),
                                      onPressed: () => _deleteTodo(todo),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
      // In test mode, the "Add Todo" action is exposed as an AppBar IconButton
      // (same pattern as Refresh). The FAB is hidden to avoid duplicate keys.
      floatingActionButton: _disableSwipeGestures ? null : Semantics(
        identifier: 'add-todo-fab',
        child: FloatingActionButton(
          key: const ValueKey('add-todo-fab'),
          onPressed: _addTodo,
          tooltip: 'Add Todo',
          child: const Icon(Icons.add),
        ),
      ),
    );
  }
}
