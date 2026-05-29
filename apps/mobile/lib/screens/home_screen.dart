import 'package:flutter/material.dart';
import 'package:todoapp/models/todo.dart';
import 'package:todoapp/services/todo_service.dart';

const _disableAnimations = bool.fromEnvironment('DISABLE_ANIMATIONS', defaultValue: false);

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

  @override
  void initState() {
    super.initState();
    _loadTodos();
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
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, _) => AlertDialog(
          title: Text(heading),
          content: Semantics(
            identifier: 'dialog-title-input',
            child: TextField(
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
                        itemCount: _todos.length,
                        itemBuilder: (context, index) {
                          final todo = _todos[index];
                          return Dismissible(
                            key: ValueKey(todo.id),
                            direction: DismissDirection.endToStart,
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
                                      tooltip: 'Edit ${todo.title}',
                                      icon: const Icon(Icons.edit, size: 20),
                                      onPressed: () => _editTodo(todo),
                                    ),
                                    IconButton(
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
      floatingActionButton: Semantics(
        identifier: 'add-todo-fab',
        child: FloatingActionButton(
          onPressed: _addTodo,
          tooltip: 'Add Todo',
          child: const Icon(Icons.add),
        ),
      ),
    );
  }
}
