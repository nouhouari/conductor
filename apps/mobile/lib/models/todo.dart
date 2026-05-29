class Todo {
  final String id;
  String title;
  String status;
  String priority;

  Todo({required this.id, required this.title, this.status = 'open', this.priority = 'not urgent'});

  bool get isDone => status == 'done';

  factory Todo.fromJson(Map<String, dynamic> json) {
    return Todo(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String,
      status: json['status'] as String? ?? 'open',
      priority: json['priority'] as String? ?? 'not urgent',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'status': status,
        'priority': priority,
      };

  Todo copyWith({String? title, String? status, String? priority}) {
    return Todo(
      id: id,
      title: title ?? this.title,
      status: status ?? this.status,
      priority: priority ?? this.priority,
    );
  }
}
