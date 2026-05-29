import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:todoapp/models/todo.dart';

class TodoServiceException implements Exception {
  final String message;
  TodoServiceException(this.message);

  @override
  String toString() => message;
}

class TodoService {
  final String baseUrl;

  TodoService({required this.baseUrl});

  Future<List<Todo>> fetchTodos() async {
    final response = await _request(() =>
        http.get(Uri.parse('$baseUrl/todos')).timeout(_timeout));
    final List<dynamic> data = jsonDecode(response.body) as List<dynamic>;
    return data
        .map((e) => Todo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Todo> createTodo(String title, {String priority = 'not urgent'}) async {
    final response = await _request(() => http
        .post(Uri.parse('$baseUrl/todos'),
            headers: _jsonHeaders,
            body: jsonEncode({'title': title, 'status': 'open', 'priority': priority}))
        .timeout(_timeout));
    return Todo.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<Todo> updateTodo(String id, {String? title, String? status, String? priority}) async {
    final body = <String, dynamic>{};
    if (title != null) body['title'] = title;
    if (status != null) body['status'] = status;
    if (priority != null) body['priority'] = priority;
    final response = await _request(() => http
        .put(Uri.parse('$baseUrl/todos/$id'),
            headers: _jsonHeaders, body: jsonEncode(body))
        .timeout(_timeout));
    return Todo.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<void> deleteTodo(String id) async {
    await _request(() =>
        http.delete(Uri.parse('$baseUrl/todos/$id')).timeout(_timeout));
  }

  static const _timeout = Duration(seconds: 10);
  static const _jsonHeaders = {'Content-Type': 'application/json'};

  Future<http.Response> _request(
      Future<http.Response> Function() fn) async {
    try {
      final response = await fn();
      if (response.statusCode >= 400) {
        throw TodoServiceException(
            'Server error ${response.statusCode}: ${response.reasonPhrase}');
      }
      return response;
    } on TodoServiceException {
      rethrow;
    } on TimeoutException {
      throw TodoServiceException(
          'Connection timed out. Is the server running at $baseUrl?');
    } on SocketException {
      throw TodoServiceException(
          'Could not connect to server at $baseUrl');
    } on HttpException {
      throw TodoServiceException(
          'Could not connect to server at $baseUrl');
    } on http.ClientException {
      throw TodoServiceException(
          'Could not connect to server at $baseUrl');
    }
  }
}
